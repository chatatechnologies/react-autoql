import React, { useEffect, useRef, useState, useMemo, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { scaleOrdinal } from 'd3-scale'
import { zoom, zoomIdentity } from 'd3-zoom'
import _isEqual from 'lodash.isequal'

import { getAutoQLConfig, getThemeValue, isColumnNumberType, findNetworkColumns } from 'autoql-fe-utils'
import { DataLimitWarning } from '../../DataLimitWarning'
import { Tooltip } from '../../Tooltip'
import SankeyColumnSelector from './SankeyColumnSelector'
import SankeyFilterButton from './SankeyFilterButton'

import './ChataSankeyDiagram.scss'

const MAX_FLOWS = 100 // Maximum number of flows to display

// Helper function to detect and remove circular links
const removeCircularLinks = (links, nodes) => {
  // Build adjacency list
  const graph = new Map()
  nodes.forEach((node, i) => graph.set(i, []))

  links.forEach((link) => {
    const list = graph.get(link.source)
    if (list) list.push(link.target)
  })

  // Detect cycles using DFS
  const visited = new Set()
  const recursionStack = new Set()
  const circularNodes = new Set()

  const hasCycle = (nodeIdx) => {
    visited.add(nodeIdx)
    recursionStack.add(nodeIdx)

    const neighbors = graph.get(nodeIdx) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) {
          circularNodes.add(nodeIdx)
          circularNodes.add(neighbor)
          return true
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        circularNodes.add(nodeIdx)
        circularNodes.add(neighbor)
        return true
      }
    }

    recursionStack.delete(nodeIdx)
    return false
  }

  // Check all nodes
  nodes.forEach((node, i) => {
    if (!visited.has(i)) {
      hasCycle(i)
    }
  })

  // Filter out links that involve circular nodes
  const cleanLinks = []
  const removedLinks = []

  links.forEach((link) => {
    // Check if this specific link creates a reverse path (bidirectional flow)
    const hasReverse = links.some((l) => l.source === link.target && l.target === link.source && l !== link)

    // If there's a bidirectional flow, keep only the larger one
    if (hasReverse) {
      const reverseLink = links.find((l) => l.source === link.target && l.target === link.source)
      // Keep the link with larger value, or if equal, keep the one with lower source index
      if (link.value > reverseLink.value || (link.value === reverseLink.value && link.source < reverseLink.source)) {
        cleanLinks.push({
          source: link.source,
          target: link.target,
          value: link.value,
        })
      } else if (!cleanLinks.some((l) => l.source === reverseLink.source && l.target === reverseLink.target)) {
        // Don't add if reverse was already added
        removedLinks.push(link)
      }
    } else if (!circularNodes.has(link.source) && !circularNodes.has(link.target)) {
      cleanLinks.push({
        source: link.source,
        target: link.target,
        value: link.value,
      })
    } else {
      removedLinks.push(link)
    }
  })

  return {
    cleanLinks,
    circularCount: removedLinks.length,
  }
}

const ChataSankeyDiagram = forwardRef((props, forwardedRef) => {
  const chartRef = useRef()
  const zoomBehaviorRef = useRef()
  const labelsRef = useRef()
  const nodesDataRef = useRef([])
  const chartWidthRef = useRef(0)
  const [isDataTruncated, setIsDataTruncated] = useState(false)
  const [totalFlows, setTotalFlows] = useState(0)
  const [hasCircularLinks, setHasCircularLinks] = useState(false)
  const [circularLinksCount, setCircularLinksCount] = useState(0)
  const [currentZoomScale, setCurrentZoomScale] = useState(1)

  // Use findNetworkColumns to intelligently detect default columns
  const {
    sourceColumnIndex: detectedSourceIndex,
    targetColumnIndex: detectedTargetIndex,
    weightColumnIndex: detectedWeightIndex,
  } = useMemo(() => findNetworkColumns(props.columns || []), [props.columns])

  // Column selection state
  const [sourceColumnIndex, setSourceColumnIndex] = useState(detectedSourceIndex !== -1 ? detectedSourceIndex : 0)
  const [targetColumnIndex, setTargetColumnIndex] = useState(detectedTargetIndex !== -1 ? detectedTargetIndex : 1)
  const [valueColumnIndex, setValueColumnIndex] = useState(detectedWeightIndex !== -1 ? detectedWeightIndex : 2)

  // Dropdown state
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [showTargetDropdown, setShowTargetDropdown] = useState(false)
  const [showValueDropdown, setShowValueDropdown] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Get all unique source and target values for filtering
  const allUniqueValues = useMemo(() => {
    const sources = new Set()
    const targets = new Set()

    props.data?.forEach((row) => {
      const source = String(row[sourceColumnIndex] ?? '')
      const target = String(row[targetColumnIndex] ?? '')
      if (source) sources.add(source)
      if (target) targets.add(target)
    })

    return {
      sources: Array.from(sources).sort(),
      targets: Array.from(targets).sort(),
    }
  }, [props.data, sourceColumnIndex, targetColumnIndex])

  // Filter state - start with all values selected
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedTargets, setSelectedTargets] = useState([])

  // Initialize filters when unique values change
  useEffect(() => {
    setSelectedSources(allUniqueValues.sources)
    setSelectedTargets(allUniqueValues.targets)
  }, [allUniqueValues.sources.join(','), allUniqueValues.targets.join(',')])

  const processedData = useMemo(() => {
    const { data, columns } = props

    if (!data || !data.length || !columns || !columns.length) {
      return { nodes: [], links: [], isDataTruncated: false, totalFlows: 0 }
    }

    // Aggregate flows
    const flowMap = new Map()
    const nodeSet = new Set()

    data.forEach((row) => {
      const source = String(row[sourceColumnIndex] ?? '')
      const target = String(row[targetColumnIndex] ?? '')
      const value = parseFloat(row[valueColumnIndex]) || 0

      if (!source || !target || value <= 0) return

      // Apply filters
      if (!selectedSources.includes(source) || !selectedTargets.includes(target)) return

      nodeSet.add(source)
      nodeSet.add(target)

      const key = `${source}|||${target}`
      flowMap.set(key, (flowMap.get(key) || 0) + value)
    })

    // Create links array and sort by value (descending)
    const allLinks = []
    flowMap.forEach((value, key) => {
      const [sourceName, targetName] = key.split('|||')
      allLinks.push({ sourceName, targetName, value })
    })

    allLinks.sort((a, b) => b.value - a.value)

    const totalFlowsCount = allLinks.length
    const isTruncated = totalFlowsCount > MAX_FLOWS
    const displayLinks = isTruncated ? allLinks.slice(0, MAX_FLOWS) : allLinks

    // Create nodes array from displayed links only
    const displayNodeSet = new Set()
    displayLinks.forEach((link) => {
      displayNodeSet.add(link.sourceName)
      displayNodeSet.add(link.targetName)
    })
    const nodes = Array.from(displayNodeSet).map((name) => ({ name }))

    // Convert links to indices
    const linksWithIndices = displayLinks.map((link) => {
      const sourceIndex = nodes.findIndex((n) => n.name === link.sourceName)
      const targetIndex = nodes.findIndex((n) => n.name === link.targetName)
      return {
        source: sourceIndex,
        target: targetIndex,
        value: link.value,
        sourceName: link.sourceName,
        targetName: link.targetName,
      }
    })

    // Detect and remove circular links
    const { cleanLinks, circularCount } = removeCircularLinks(linksWithIndices, nodes)

    return {
      nodes,
      links: cleanLinks,
      isDataTruncated: isTruncated,
      totalFlows: totalFlowsCount,
      hasCircularLinks: circularCount > 0,
      circularLinksCount: circularCount,
    }
  }, [
    props.data,
    props.columns,
    sourceColumnIndex,
    targetColumnIndex,
    valueColumnIndex,
    selectedSources,
    selectedTargets,
  ])

  useEffect(() => {
    setIsDataTruncated(processedData.isDataTruncated)
    setTotalFlows(processedData.totalFlows)
    setHasCircularLinks(processedData.hasCircularLinks)
    setCircularLinksCount(processedData.circularLinksCount)
  }, [processedData])

  useEffect(() => {
    if (!chartRef.current || !processedData.nodes.length || !processedData.links.length) {
      return
    }

    renderChart()
  }, [props.width, props.height, processedData, props.themeConfig])

  // Throttle function
  const throttle = (func, limit) => {
    let inThrottle
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  }

  // Update label positions and visibility based on zoom
  const updateLabelsForZoom = (scale) => {
    if (!labelsRef.current || !nodesDataRef.current.length) return

    const chartWidth = chartWidthRef.current
    const maxLabelWidth = chartWidth / 3 // Max width in world coordinates
    const fontSize = 12
    const inverseScale = 1 / scale

    // First pass: Update all labels and make them all visible initially
    labelsRef.current.style('display', 'block')

    labelsRef.current.each(function (d, i) {
      const node = nodesDataRef.current.find((n) => n.name === d.name)
      if (!node) return

      const textElement = select(this)
      const isLeftSide = node.x0 < chartWidth / 2
      const fullText = d.name

      // Position in world coordinates
      const xOffset = 6
      const x = isLeftSide ? node.x1 + xOffset : node.x0 - xOffset
      const y = (node.y1 + node.y0) / 2

      // Position the text
      textElement.attr('x', x)
      textElement.attr('y', y)

      // Apply counter-scale for vertical only around the text's Y position
      // Parent scales as scale(1, k), so we counter with scale(1, 1/k)
      // Use translate to set the transform origin to the text's Y position
      textElement.attr('transform', `translate(0, ${y}) scale(1, ${inverseScale}) translate(0, ${-y})`)

      // Update font size to base size
      textElement.style('font-size', `${fontSize}px`)

      // Recalculate truncation
      textElement.text(fullText)

      // Remove existing title if any
      textElement.selectAll('title').remove()

      if (this.getComputedTextLength() > maxLabelWidth) {
        // Binary search for the right length
        let low = 0
        let high = fullText.length
        let truncatedText = fullText

        while (low < high) {
          const mid = Math.floor((low + high + 1) / 2)
          const currentText = fullText.substring(0, mid) + '...'
          textElement.text(currentText)

          if (this.getComputedTextLength() <= maxLabelWidth) {
            low = mid
            truncatedText = currentText
          } else {
            high = mid - 1
          }
        }

        // Set final truncated text
        textElement.text(truncatedText)

        // Add tooltip with full text
        textElement.append('title').text(fullText)
      }
    })

    // Second pass: Recalculate overlap detection
    // Sort labels by Y position to ensure consistent hiding behavior
    const labelData = []
    labelsRef.current.each(function (d) {
      const node = nodesDataRef.current.find((n) => n.name === d.name)
      if (node) {
        labelData.push({
          element: this,
          y: (node.y1 + node.y0) / 2,
          data: d,
        })
      }
    })

    // Sort by Y position
    labelData.sort((a, b) => a.y - b.y)

    // Check overlaps in sorted order
    const labelBounds = []
    labelData.forEach(({ element }) => {
      try {
        const bbox = element.getBBox()
        const bounds = {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        }

        // Fixed padding in screen space (not scaled)
        const padding = 2

        // Check if this label overlaps with any previous visible labels
        const hasOverlap = labelBounds.some((otherBounds) => {
          return !(
            bounds.x + bounds.width + padding < otherBounds.x ||
            bounds.x > otherBounds.x + otherBounds.width + padding ||
            bounds.y + bounds.height + padding < otherBounds.y ||
            bounds.y > otherBounds.y + otherBounds.height + padding
          )
        })

        if (hasOverlap) {
          select(element).style('display', 'none')
        } else {
          select(element).style('display', 'block')
          labelBounds.push(bounds)
        }
      } catch (error) {
        // Ignore errors from getBBox
      }
    })
  }

  // Throttled version - call at most once every 100ms
  const throttledUpdateLabels = useRef(throttle(updateLabelsForZoom, 100)).current

  const renderChart = () => {
    const svg = select(chartRef.current)
    svg.selectAll('*').remove()

    const { width, height } = props
    const margin = { top: 10, right: 10, bottom: 10, left: 10 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Create zoom behavior - vertical only, no horizontal movement
    const zoomBehavior = zoom()
      .scaleExtent([0.5, 5]) // Allow zoom from 50% to 500%
      .filter((event) => {
        // Prevent default browser scroll for wheel events
        if (event.type === 'wheel') {
          event.preventDefault()
          event.stopPropagation()
          return true
        }
        // Allow drag for panning (mousedown, mousemove)
        if (event.type === 'mousedown' || event.type === 'mousemove') {
          return event.button === 0 // Only left mouse button
        }
        // Disable double-click zoom
        return event.type !== 'dblclick'
      })
      .on('zoom', (event) => {
        const transform = event.transform
        // Lock X position at 0, only allow vertical translation and scale
        zoomableGroup.attr('transform', `translate(0,${transform.y}) scale(1,${transform.k})`)

        // Update labels (throttled)
        throttledUpdateLabels(transform.k)

        setCurrentZoomScale(transform.k)
      })

    zoomBehaviorRef.current = zoomBehavior

    // Apply zoom to SVG
    svg.call(zoomBehavior)

    // Create container group with margin
    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Add transparent background rectangle in container to capture all events
    // This stays fixed and doesn't transform with zoom
    container
      .append('rect')
      .attr('class', 'sankey-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')

    // Create zoomable group inside container
    const zoomableGroup = container.append('g')

    // Create sankey layout
    const sankey = d3Sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([
        [1, 1],
        [chartWidth - 1, chartHeight - 5],
      ])

    // Generate sankey data (circular links already removed in processedData)
    const { nodes, links } = sankey(processedData)

    // Store nodes data and chart width for label updates
    nodesDataRef.current = nodes
    chartWidthRef.current = chartWidth

    // Color scale
    const primary = getThemeValue('primary', props.themeConfig)
    const accent = getThemeValue('accent', props.themeConfig)

    const themeColors = [
      primary || '#5C7AFF',
      accent || '#00C1D4',
      '#66c2a5',
      '#fc8d62',
      '#8da0cb',
      '#e78ac3',
      '#a6d854',
      '#ffd92f',
      '#e5c494',
      '#b3b3b3',
    ].filter(Boolean)

    const colorScale = scaleOrdinal().range(themeColors)

    // Add links
    zoomableGroup
      .append('g')
      .attr('class', 'sankey-links')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'sankey-link')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke-width', (d) => Math.max(1, d.width))
      .attr('stroke', (d) => colorScale(d.source.name))
      .attr('fill', 'none')
      .attr('opacity', 0.5)
      .on('mouseover', function (event, d) {
        select(this).attr('opacity', 0.7)
      })
      .on('mouseout', function (event, d) {
        select(this).attr('opacity', 0.5)
      })
      .append('title')
      .text((d) => `${d.source.name} → ${d.target.name}\nValue: ${d.value.toLocaleString()}`)

    // Add nodes
    const nodeGroup = zoomableGroup
      .append('g')
      .attr('class', 'sankey-nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'sankey-node')

    nodeGroup
      .append('rect')
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('fill', (d) => colorScale(d.name))
      .attr('opacity', 0.8)
      .on('mouseover', function (event, d) {
        select(this).attr('opacity', 1)
      })
      .on('mouseout', function (event, d) {
        select(this).attr('opacity', 0.8)
      })
      .append('title')
      .text((d) => `${d.name}\nTotal: ${d.value.toLocaleString()}`)

    // Add labels with max width and truncation
    const maxLabelWidth = chartWidth / 3
    const labels = nodeGroup
      .append('text')
      .attr('x', (d) => (d.x0 < chartWidth / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr('y', (d) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 < chartWidth / 2 ? 'start' : 'end'))
      .attr('class', 'sankey-node-label')
      .text((d) => d.name)
      .style('font-size', '12px')
      .style('font-weight', 'bold')

    // Truncate labels that are too long and add tooltips
    labels.each(function (d) {
      const textElement = select(this)
      const fullText = d.name
      let currentText = fullText

      // Check if text is too wide
      if (this.getComputedTextLength() > maxLabelWidth) {
        // Binary search for the right length
        let low = 0
        let high = fullText.length
        let truncatedText = fullText

        while (low < high) {
          const mid = Math.floor((low + high + 1) / 2)
          currentText = fullText.substring(0, mid) + '...'
          textElement.text(currentText)

          if (this.getComputedTextLength() <= maxLabelWidth) {
            low = mid
            truncatedText = currentText
          } else {
            high = mid - 1
          }
        }

        // Set final truncated text
        textElement.text(truncatedText)

        // Add tooltip with full text
        textElement.append('title').text(fullText)
      }
    })

    // Store labels reference for zoom updates
    labelsRef.current = labels

    // Initialize labels at scale 1 (this will handle overlap detection)
    updateLabelsForZoom(1)
  }

  const renderWarning = () => {
    if (!isDataTruncated && !hasCircularLinks) {
      return null
    }

    let message = ''
    if (isDataTruncated && hasCircularLinks) {
      message = `Only the top ${MAX_FLOWS} flows (out of ${totalFlows}) are displayed. ${circularLinksCount} circular/bidirectional flow${
        circularLinksCount > 1 ? 's were' : ' was'
      } removed or merged.`
    } else if (isDataTruncated) {
      message = `Only the top ${MAX_FLOWS} flows (out of ${totalFlows}) are displayed. Consider filtering your data to see more specific flows.`
    } else if (hasCircularLinks) {
      message = `${circularLinksCount} circular or bidirectional flow${
        circularLinksCount > 1 ? 's were' : ' was'
      } detected and handled. For bidirectional flows, only the larger direction is shown.`
    }

    return <DataLimitWarning tooltipID={props.tooltipID} isTruncated={isDataTruncated} customMessage={message} />
  }

  const buttonSize = 35
  const buttonGap = 5
  const chartWidth = props.width || 600
  const buttonStartX = chartWidth - buttonSize - 10

  return (
    <g>
      {renderWarning()}
      <svg
        ref={chartRef}
        className='react-autoql-sankey-chart'
        width={chartWidth}
        height={props.height || 400}
        viewBox={`0 0 ${chartWidth} ${props.height || 400}`}
        style={{
          background: 'var(--react-autoql-background-color-secondary, #f9f9f9)',
          cursor: 'grab',
        }}
        onClick={() => {
          // Close all dropdowns when clicking on chart
          setShowSourceDropdown(false)
          setShowTargetDropdown(false)
          setShowValueDropdown(false)
          setShowFilterDropdown(false)
        }}
        onWheel={(e) => {
          // Prevent page scroll when zooming
          e.preventDefault()
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          // Change cursor when panning starts
          if (chartRef.current) {
            chartRef.current.style.cursor = 'grabbing'
          }
        }}
        onMouseUp={(e) => {
          // Reset cursor when panning ends
          if (chartRef.current) {
            chartRef.current.style.cursor = 'grab'
          }
        }}
        onMouseLeave={(e) => {
          // Reset cursor when leaving
          if (chartRef.current) {
            chartRef.current.style.cursor = 'grab'
          }
        }}
      />

      {/* Column Selectors - rendered outside the D3-controlled SVG */}
      <SankeyColumnSelector
        columns={props.columns}
        selectedIndex={sourceColumnIndex}
        onSelect={setSourceColumnIndex}
        type='source'
        showDropdown={showSourceDropdown}
        setShowDropdown={setShowSourceDropdown}
        buttonX={buttonStartX}
        buttonY={10}
        buttonSize={buttonSize}
        chartTooltipID={props.chartTooltipID}
      />
      <SankeyColumnSelector
        columns={props.columns}
        selectedIndex={targetColumnIndex}
        onSelect={setTargetColumnIndex}
        type='target'
        showDropdown={showTargetDropdown}
        setShowDropdown={setShowTargetDropdown}
        buttonX={buttonStartX}
        buttonY={10 + (buttonSize + buttonGap) * 1}
        buttonSize={buttonSize}
        chartTooltipID={props.chartTooltipID}
      />
      <SankeyColumnSelector
        columns={props.columns}
        selectedIndex={valueColumnIndex}
        onSelect={setValueColumnIndex}
        type='value'
        showDropdown={showValueDropdown}
        setShowDropdown={setShowValueDropdown}
        buttonX={buttonStartX}
        buttonY={10 + (buttonSize + buttonGap) * 2}
        buttonSize={buttonSize}
        chartTooltipID={props.chartTooltipID}
      />

      {/* Filter Button */}
      <SankeyFilterButton
        sourceValues={allUniqueValues.sources}
        targetValues={allUniqueValues.targets}
        selectedSources={selectedSources}
        selectedTargets={selectedTargets}
        onSourcesChange={setSelectedSources}
        onTargetsChange={setSelectedTargets}
        showDropdown={showFilterDropdown}
        setShowDropdown={setShowFilterDropdown}
        buttonX={buttonStartX}
        buttonY={10 + (buttonSize + buttonGap) * 3}
        chartTooltipID={props.chartTooltipID}
      />

      {/* Reset Zoom Button */}
      <g
        className='sankey-reset-zoom-button'
        transform={`translate(${buttonStartX}, ${10 + (buttonSize + buttonGap) * 4})`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          if (chartRef.current && zoomBehaviorRef.current) {
            select(chartRef.current).transition().duration(750).call(zoomBehaviorRef.current.transform, zoomIdentity)
          }
        }}
        data-tooltip-id={props.chartTooltipID}
        data-tooltip-content='Reset zoom'
        data-tooltip-place='left'
      >
        <rect
          className='sankey-reset-zoom-button-rect'
          width={buttonSize}
          height={buttonSize}
          rx='4'
          fill='var(--react-autoql-background-color-primary, #fff)'
          stroke='var(--react-autoql-border-color, #ccc)'
          strokeWidth='1'
        />
        <g transform={`translate(${buttonSize / 2}, ${buttonSize / 2})`}>
          {/* Magnifying glass with minus icon */}
          <circle cx='0' cy='-2' r='7' fill='none' stroke='currentColor' strokeWidth='2' />
          <line x1='5' y1='3' x2='9' y2='7' stroke='currentColor' strokeWidth='2' />
          <line x1='-3' y1='-2' x2='3' y2='-2' stroke='currentColor' strokeWidth='2' />
          <line x1='0' y1='-5' x2='0' y2='1' stroke='currentColor' strokeWidth='2' />
        </g>
      </g>

      {/* Tooltip for buttons */}
      {props.chartTooltipID && <Tooltip tooltipId={props.chartTooltipID} />}
    </g>
  )
})

ChataSankeyDiagram.displayName = 'ChataSankeyDiagram'

ChataSankeyDiagram.propTypes = {
  data: PropTypes.arrayOf(PropTypes.array),
  columns: PropTypes.arrayOf(PropTypes.shape({})),
  width: PropTypes.number,
  height: PropTypes.number,
  onChartClick: PropTypes.func,
  themeConfig: PropTypes.shape({}),
  dataFormatting: PropTypes.shape({}),
  autoQLConfig: PropTypes.shape({}),
  onErrorCallback: PropTypes.func,
  tooltipID: PropTypes.string,
  chartTooltipID: PropTypes.string,
}

ChataSankeyDiagram.defaultProps = {
  data: [],
  columns: [],
  width: 800,
  height: 600,
  onChartClick: () => {},
  onErrorCallback: () => {},
  themeConfig: {},
  dataFormatting: {},
  autoQLConfig: {},
  tooltipID: undefined,
  chartTooltipID: undefined,
}

export default ChataSankeyDiagram
