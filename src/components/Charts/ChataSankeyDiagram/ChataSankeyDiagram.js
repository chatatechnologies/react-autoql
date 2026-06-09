import React, { useEffect, useRef, useState, useMemo, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { scaleOrdinal } from 'd3-scale'
import { zoom, zoomIdentity } from 'd3-zoom'
import { MdOutlineFitScreen } from 'react-icons/md'

import {
  getChartColorVars,
  isColumnNumberType,
  findNetworkColumns,
  formatElement,
  getDataFormatting,
  getAutoQLConfig,
} from 'autoql-fe-utils'
import { DataLimitWarning } from '../../DataLimitWarning'
import { Tooltip } from '../../Tooltip'
import SankeyColumnSelector from './SankeyColumnSelector'

import './ChataSankeyDiagram.scss'

const MAX_FLOWS = 100 // Maximum number of flows to display
const MAX_PATH_COLUMNS = 6

const escapeHtml = (value = '') => {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const areNumberArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

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
          ...link,
        })
      } else if (!cleanLinks.some((l) => l.source === reverseLink.source && l.target === reverseLink.target)) {
        // Don't add if reverse was already added
        removedLinks.push(link)
      }
    } else if (!circularNodes.has(link.source) && !circularNodes.has(link.target)) {
      cleanLinks.push({
        ...link,
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
  const persistedPathColumnIndices = Array.isArray(props.initialChartControls?.sankeyPathColumnIndices)
    ? props.initialChartControls.sankeyPathColumnIndices
    : []
  const persistedValueColumnIndex = props.initialChartControls?.sankeyValueColumnIndex

  const categoricalColumnIndices = useMemo(
    () =>
      (props.columns || [])
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => !isColumnNumberType(col))
        .map(({ index }) => index),
    [props.columns],
  )

  const getInitialPathColumnIndices = (columns, detectedSource, detectedTarget, persistedPath = []) => {
    if (!columns?.length) return []

    const validPersisted = Array.from(new Set((persistedPath || []).filter((index) => columns.includes(index))))
    if (validPersisted.length >= 2) {
      return validPersisted.slice(0, MAX_PATH_COLUMNS)
    }

    const hasDetectedSource = detectedSource >= 0 && columns.includes(detectedSource)
    const hasDetectedTarget = detectedTarget >= 0 && columns.includes(detectedTarget)
    if (hasDetectedSource && hasDetectedTarget && detectedSource !== detectedTarget) {
      return [detectedSource, detectedTarget]
    }

    return columns.slice(0, 2)
  }

  // Column selection state
  const [pathColumnIndices, setPathColumnIndices] = useState(() =>
    getInitialPathColumnIndices(
      categoricalColumnIndices,
      detectedSourceIndex,
      detectedTargetIndex,
      persistedPathColumnIndices,
    ),
  )
  const [valueColumnIndex, setValueColumnIndex] = useState(() => {
    if (persistedValueColumnIndex >= 0 && isColumnNumberType(props.columns?.[persistedValueColumnIndex])) {
      return persistedValueColumnIndex
    }
    return detectedWeightIndex !== -1 ? detectedWeightIndex : 2
  })

  // Dropdown state
  const [showPathDropdown, setShowPathDropdown] = useState(false)
  const [showValueDropdown, setShowValueDropdown] = useState(false)

  const persistSankeyControls = (updates) => {
    if (!props.onChartControlsChange) return

    const nextControls = {
      ...(props.initialChartControls || {}),
      ...updates,
    }
    if (
      areNumberArraysEqual(
        nextControls?.sankeyPathColumnIndices || [],
        props.initialChartControls?.sankeyPathColumnIndices || [],
      ) &&
      nextControls?.sankeyValueColumnIndex === props.initialChartControls?.sankeyValueColumnIndex
    ) {
      return
    }

    props.onChartControlsChange(nextControls)
  }

  const handlePathChange = (nextPathColumnIndices) => {
    if (areNumberArraysEqual(nextPathColumnIndices || [], pathColumnIndices || [])) {
      return
    }
    setPathColumnIndices(nextPathColumnIndices)
    persistSankeyControls({ sankeyPathColumnIndices: nextPathColumnIndices })
  }

  const handleValueColumnChange = (nextValueColumnIndex) => {
    if (nextValueColumnIndex === valueColumnIndex) {
      return
    }
    setValueColumnIndex(nextValueColumnIndex)
    persistSankeyControls({ sankeyValueColumnIndex: nextValueColumnIndex })
  }

  const buttonSize = 35
  const buttonGap = 5
  const totalChartWidth = props.width || 600
  const buttonStartX = totalChartWidth - buttonSize - 10
  const buttonIconSize = 20
  const buttonIconOffset = (buttonSize - buttonIconSize) / 2
  const enableDrilldowns = getAutoQLConfig(props.autoQLConfig).enableDrilldowns
  // Keep Sankey drawing area clear of right-side controls.
  const chartRightBound = buttonStartX - 10

  useEffect(() => {
    setPathColumnIndices((prev) => {
      const validPrev = Array.from(new Set((prev || []).filter((index) => categoricalColumnIndices.includes(index))))
      const nextPath =
        validPrev.length >= 2
          ? validPrev.slice(0, MAX_PATH_COLUMNS)
          : getInitialPathColumnIndices(
              categoricalColumnIndices,
              detectedSourceIndex,
              detectedTargetIndex,
              persistedPathColumnIndices,
            )
      if (areNumberArraysEqual(prev || [], nextPath || [])) {
        return prev
      }
      return nextPath
    })
  }, [categoricalColumnIndices, detectedSourceIndex, detectedTargetIndex, persistedPathColumnIndices])

  useEffect(() => {
    const firstNumberColumnIndex = (props.columns || []).findIndex((col) => isColumnNumberType(col))
    if (
      firstNumberColumnIndex >= 0 &&
      !isColumnNumberType(props.columns?.[valueColumnIndex]) &&
      firstNumberColumnIndex !== valueColumnIndex
    ) {
      // Auto-correct invalid value column locally without persisting (prevents dashboard update loops).
      setValueColumnIndex(firstNumberColumnIndex)
    }
  }, [props.columns, valueColumnIndex])

  const processedData = useMemo(() => {
    const { data, columns } = props

    if (!data || !data.length || !columns || !columns.length || pathColumnIndices.length < 2) {
      return { nodes: [], links: [], isDataTruncated: false, totalFlows: 0 }
    }

    const formattingConfig = getDataFormatting(
      props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting,
    )

    // Aggregate flows across adjacent path steps
    const flowMap = new Map()

    data.forEach((row) => {
      const value = parseFloat(row[valueColumnIndex]) || 0

      if (value <= 0) return

      for (let i = 0; i < pathColumnIndices.length - 1; i++) {
        const source = String(row[pathColumnIndices[i]] ?? '').trim()
        const target = String(row[pathColumnIndices[i + 1]] ?? '').trim()
        if (!source || !target) continue
        const sourceColumn = columns[pathColumnIndices[i]]
        const targetColumn = columns[pathColumnIndices[i + 1]]
        const sourceDisplayValue = formatElement({
          element: row[pathColumnIndices[i]],
          column: sourceColumn,
          config: formattingConfig,
        })
        const targetDisplayValue = formatElement({
          element: row[pathColumnIndices[i + 1]],
          column: targetColumn,
          config: formattingConfig,
        })
        const sourceDisplay = sourceDisplayValue == null ? '' : String(sourceDisplayValue)
        const targetDisplay = targetDisplayValue == null ? '' : String(targetDisplayValue)

        const sourceId = `${i}|||${source}`
        const targetId = `${i + 1}|||${target}`
        const key = `${sourceId}>>>>${targetId}`
        const existing = flowMap.get(key)
        flowMap.set(key, {
          sourceId,
          targetId,
          sourceName: source,
          targetName: target,
          sourceRawValue: row[pathColumnIndices[i]],
          targetRawValue: row[pathColumnIndices[i + 1]],
          sourceDisplay,
          targetDisplay,
          sourceStage: i,
          targetStage: i + 1,
          value: (existing?.value || 0) + value,
        })
      }
    })

    // Create links array and sort by value (descending)
    const allLinks = Array.from(flowMap.values())

    allLinks.sort((a, b) => b.value - a.value)

    const totalFlowsCount = allLinks.length
    const isTruncated = totalFlowsCount > MAX_FLOWS
    let displayLinks = allLinks

    // Keep stage coverage when truncating: reserve slots per stage first, then fill remaining by global value.
    if (isTruncated) {
      const numStages = Math.max(1, pathColumnIndices.length - 1)
      const perStageQuota = Math.max(1, Math.floor(MAX_FLOWS / numStages))
      const selectedKeys = new Set()
      const stageBuckets = new Map()

      allLinks.forEach((link) => {
        const bucket = stageBuckets.get(link.sourceStage) || []
        bucket.push(link)
        stageBuckets.set(link.sourceStage, bucket)
      })

      for (let stage = 0; stage < numStages; stage++) {
        const bucket = stageBuckets.get(stage) || []
        bucket.slice(0, perStageQuota).forEach((link) => {
          selectedKeys.add(`${link.sourceId}>>>>${link.targetId}`)
        })
      }

      for (const link of allLinks) {
        if (selectedKeys.size >= MAX_FLOWS) break
        selectedKeys.add(`${link.sourceId}>>>>${link.targetId}`)
      }

      displayLinks = allLinks.filter((link) => selectedKeys.has(`${link.sourceId}>>>>${link.targetId}`))
    }

    // Create nodes array from displayed links only
    const displayNodeMap = new Map()
    displayLinks.forEach((link) => {
      if (!displayNodeMap.has(link.sourceId)) {
        displayNodeMap.set(link.sourceId, {
          id: link.sourceId,
          name: link.sourceName,
          rawValue: link.sourceRawValue,
          displayName: link.sourceDisplay ?? link.sourceName,
          stage: link.sourceStage,
        })
      }
      if (!displayNodeMap.has(link.targetId)) {
        displayNodeMap.set(link.targetId, {
          id: link.targetId,
          name: link.targetName,
          rawValue: link.targetRawValue,
          displayName: link.targetDisplay ?? link.targetName,
          stage: link.targetStage,
        })
      }
    })
    const nodes = Array.from(displayNodeMap.values())
    const nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]))

    // Convert links to indices
    const linksWithIndices = displayLinks.map((link) => {
      const sourceIndex = nodeIndexById.get(link.sourceId)
      const targetIndex = nodeIndexById.get(link.targetId)
      return {
        source: sourceIndex,
        target: targetIndex,
        value: link.value,
        sourceName: link.sourceName,
        targetName: link.targetName,
        sourceRawValue: link.sourceRawValue,
        targetRawValue: link.targetRawValue,
        sourceStage: link.sourceStage,
        targetStage: link.targetStage,
        sourceDisplay: link.sourceDisplay ?? link.sourceName,
        targetDisplay: link.targetDisplay ?? link.targetName,
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
    pathColumnIndices,
    valueColumnIndex,
    props.dataFormatting,
    props.autoQLConfig,
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
  }, [props.width, props.height, processedData, props.themeConfig, enableDrilldowns])

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
    const fontSize = '0.75rem'
    const inverseScale = 1 / scale

    // First pass: Update all labels and make them all visible initially
    labelsRef.current.style('display', 'block')

    labelsRef.current.each(function (d, i) {
      const node = nodesDataRef.current.find((n) => n.id === d.id)
      if (!node) return

      const textElement = select(this)
      const isLeftSide = node.x0 < chartWidth / 2
      const fullText = d.displayName || d.name

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
      textElement.style('font-size', fontSize)

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
      const node = nodesDataRef.current.find((n) => n.id === d.id)
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

    const { height } = props
    const margin = { top: 10, right: 10, bottom: 10, left: 10 }
    const chartWidth = Math.max(120, chartRightBound - margin.left - margin.right)
    const chartHeight = height - margin.top - margin.bottom
    const valueColumn = props.columns?.[valueColumnIndex]
    const valueFormattingConfig = getDataFormatting(
      props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting,
    )
    const formatTooltipNumber = (value) => {
      if (!valueColumn) {
        return escapeHtml(`${value?.toLocaleString?.() ?? value}`)
      }
      return escapeHtml(
        `${formatElement({
          element: value,
          column: valueColumn,
          config: valueFormattingConfig,
        })}`,
      )
    }

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
    const maxStage = (processedData.nodes || []).reduce((max, node) => Math.max(max, node.stage || 0), 0)
    const sankey = d3Sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .nodeAlign((node) => {
        // Lock horizontal placement by selected path stage so categories from different
        // path columns never collapse into the same visual column.
        const stage = Math.max(0, Math.min(Math.floor(node.stage || 0), maxStage))
        return stage
      })
      .extent([
        [1, 1],
        [chartWidth - 1, chartHeight - 5],
      ])

    // Generate sankey data (circular links already removed in processedData)
    const { nodes, links } = sankey(processedData)

    // Store nodes data and chart width for label updates
    nodesDataRef.current = nodes
    chartWidthRef.current = chartWidth

    // Color scale: use global chart palette when available.
    const fallbackColors = ['#5C7AFF', '#00C1D4', '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f']
    const chartPalette = getChartColorVars()?.chartColors?.filter(Boolean) || []
    const sankeyColors = (chartPalette.length ? chartPalette : fallbackColors).concat(fallbackColors).filter(Boolean)
    const colorScale = scaleOrdinal().range(sankeyColors)

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
      .style('cursor', enableDrilldowns ? 'pointer' : 'default')
      .attr('data-tooltip-id', props.chartTooltipID)
      .attr(
        'data-tooltip-html',
        (d) =>
          `<strong>${escapeHtml(d.source.displayName || d.source.name)} → ${escapeHtml(
            d.target.displayName || d.target.name,
          )}</strong><br/>Value: ${formatTooltipNumber(d.value)}`,
      )
      .on('mouseover', function (event, d) {
        select(this).attr('opacity', 0.7)
      })
      .on('mouseout', function (event, d) {
        select(this).attr('opacity', 0.5)
      })
      .on('click', (event, d) => {
        if (!enableDrilldowns || !props.onChartClick) return

        const sourceColumnIndex = pathColumnIndices[d.source?.stage]
        const targetColumnIndex = pathColumnIndices[d.target?.stage]
        if (sourceColumnIndex === undefined || targetColumnIndex === undefined) return

        const sourceRawValue = d.sourceRawValue
        const targetRawValue = d.targetRawValue
        if (
          sourceRawValue === null ||
          sourceRawValue === undefined ||
          targetRawValue === null ||
          targetRawValue === undefined
        ) {
          return
        }

        // Close open Sankey selectors before drilldown transition.
        setShowPathDropdown(false)
        setShowValueDropdown(false)

        const sourceColumn = props.columns?.[sourceColumnIndex]
        const targetColumn = props.columns?.[targetColumnIndex]
        if (!sourceColumn?.name || !targetColumn?.name) return
        const sourceGroupBy = {
          name: sourceColumn.name,
          drill_down: sourceColumn.drill_down,
          value: `${sourceRawValue}`,
        }
        const targetGroupBy = {
          name: targetColumn.name,
          drill_down: targetColumn.drill_down,
          value: `${targetRawValue}`,
        }

        props.onChartClick({
          groupBys: [sourceGroupBy, targetGroupBy],
          activeKey: `link-${d.source?.id}-${d.target?.id}`,
        })
      })

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
      .style('cursor', enableDrilldowns ? 'pointer' : 'default')
      .attr('data-tooltip-id', props.chartTooltipID)
      .attr(
        'data-tooltip-html',
        (d) => `<strong>${escapeHtml(d.displayName || d.name)}</strong><br/>Total: ${formatTooltipNumber(d.value)}`,
      )
      .on('mouseover', function (event, d) {
        select(this).attr('opacity', 1)
      })
      .on('mouseout', function (event, d) {
        select(this).attr('opacity', 0.8)
      })
      .on('click', (event, d) => {
        if (!enableDrilldowns || !props.onChartClick) return

        const stringColumnIndex = pathColumnIndices[d.stage]
        if (stringColumnIndex === undefined) return

        const rawValue = d.rawValue
        if (rawValue === null || rawValue === undefined) return

        // Close open Sankey selectors before drilldown transition.
        setShowPathDropdown(false)
        setShowValueDropdown(false)

        const rowForFilter = new Array(props.columns.length).fill(null)
        rowForFilter[stringColumnIndex] = rawValue

        props.onChartClick({
          row: rowForFilter,
          columnIndex: stringColumnIndex,
          columns: props.columns,
          stringColumnIndex,
          activeKey: `node-${d.id}`,
        })
      })

    // Add labels with max width and truncation
    const maxLabelWidth = chartWidth / 3
    const labels = nodeGroup
      .append('text')
      .attr('x', (d) => (d.x0 < chartWidth / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr('y', (d) => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.x0 < chartWidth / 2 ? 'start' : 'end'))
      .attr('class', 'sankey-node-label')
      .text((d) => d.displayName || d.name)
      .style('font-size', '0.75rem')
      .style('font-weight', 'bold')

    // Truncate labels that are too long and add tooltips
    labels.each(function (d) {
      const textElement = select(this)
      const fullText = d.displayName || d.name
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
      message = `Only the top ${MAX_FLOWS} flows (out of ${totalFlows}) are displayed. Consider narrowing your query to see more specific flows.`
    } else if (hasCircularLinks) {
      message = `${circularLinksCount} circular or bidirectional flow${
        circularLinksCount > 1 ? 's were' : ' was'
      } detected and handled. For bidirectional flows, only the larger direction is shown.`
    }

    return <DataLimitWarning tooltipID={props.tooltipID} isTruncated={isDataTruncated} customMessage={message} />
  }

  return (
    <g>
      {renderWarning()}
      <svg
        ref={chartRef}
        className='react-autoql-sankey-chart'
        width={totalChartWidth}
        height={props.height || 400}
        viewBox={`0 0 ${totalChartWidth} ${props.height || 400}`}
        style={{
          background: 'var(--react-autoql-background-color-secondary, #f9f9f9)',
          cursor: 'grab',
        }}
        onClick={() => {
          // Close all dropdowns when clicking on chart
          setShowPathDropdown(false)
          setShowValueDropdown(false)
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
        type='path'
        pathColumnIndices={pathColumnIndices}
        onPathChange={handlePathChange}
        maxPathColumns={MAX_PATH_COLUMNS}
        showDropdown={showPathDropdown}
        setShowDropdown={setShowPathDropdown}
        buttonX={buttonStartX}
        buttonY={10}
        buttonSize={buttonSize}
        chartTooltipID={props.chartTooltipID}
      />
      <SankeyColumnSelector
        columns={props.columns}
        selectedIndex={valueColumnIndex}
        onSelect={handleValueColumnChange}
        type='value'
        showDropdown={showValueDropdown}
        setShowDropdown={setShowValueDropdown}
        buttonX={buttonStartX}
        buttonY={10 + (buttonSize + buttonGap) * 1}
        buttonSize={buttonSize}
        chartTooltipID={props.chartTooltipID}
      />

      {/* Reset Zoom Button */}
      <g
        className='sankey-reset-zoom-button'
        transform={`translate(${buttonStartX}, ${10 + (buttonSize + buttonGap) * 2})`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          if (chartRef.current && zoomBehaviorRef.current) {
            select(chartRef.current).transition().duration(750).call(zoomBehaviorRef.current.transform, zoomIdentity)
          }
        }}
        data-tooltip-id={props.chartTooltipID}
        data-tooltip-html='Fit to screen'
      >
        <rect
          className='sankey-reset-zoom-button-rect'
          width={buttonSize}
          height={buttonSize}
          rx='4'
          strokeWidth='1'
          opacity={0}
        />
        <g transform={`translate(${buttonIconOffset}, ${buttonIconOffset})`}>
          <MdOutlineFitScreen className='sankey-reset-zoom-button-icon' size={buttonIconSize} style={{ opacity: 0 }} />
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
