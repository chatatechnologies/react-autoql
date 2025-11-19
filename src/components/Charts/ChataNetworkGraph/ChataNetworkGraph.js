import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { zoom, zoomIdentity } from 'd3-zoom'
import { MdOutlineFitScreen, MdFilterList } from 'react-icons/md'
import { findNetworkColumns, formatElement, getAutoQLConfig } from 'autoql-fe-utils'
import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'
import { Tooltip } from '../../Tooltip'
import { Popover } from '../../Popover'
import ColumnSelector from './ColumnSelector'

import './ChataNetworkGraph.scss'

const ChataNetworkGraph = forwardRef((props, forwardedRef) => {
  const chartRef = useRef()
  const simulationRef = useRef()
  const zoomBehaviorRef = useRef()
  // After the simulation is stopped once, disable further auto-stops for the lifetime of this component
  const earlyStopDisabledRef = useRef(false)
  const radiusScaleRef = useRef(() => 6)

  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])
  const [simulation, setSimulation] = useState(null)
  const [showSenders, setShowSenders] = useState(true)
  const [showReceivers, setShowReceivers] = useState(true)
  const [showBoth, setShowBoth] = useState(true)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [showTargetDropdown, setShowTargetDropdown] = useState(false)

  // Initialize selected columns from detected network columns
  const { sourceColumnIndex: detectedSourceIndex, targetColumnIndex: detectedTargetIndex } = findNetworkColumns(
    props.columns || [],
  )
  const [selectedSourceColumnIndex, setSelectedSourceColumnIndex] = useState(
    detectedSourceIndex !== -1 ? detectedSourceIndex : null,
  )
  const [selectedTargetColumnIndex, setSelectedTargetColumnIndex] = useState(
    detectedTargetIndex !== -1 ? detectedTargetIndex : null,
  )

  const nodeSelectionRef = useRef(null)
  const linkSelectionRef = useRef(null)

  // Suppress ResizeObserver loop errors (harmless warnings)
  useEffect(() => {
    const handleError = (e) => {
      if (
        e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
        e.message === 'ResizeObserver loop limit exceeded'
      ) {
        e.stopImmediatePropagation()
        return false
      }
    }

    window.addEventListener('error', handleError)
    return () => {
      window.removeEventListener('error', handleError)
    }
  }, [])

  // Recenter function to fit all nodes in view
  const recenter = useCallback(() => {
    if (!nodes.length || !chartRef.current) return

    const { innerHeight, innerWidth, deltaX, deltaY } = props
    const chartWidth = innerWidth || props.width
    const chartHeight = innerHeight || props.height

    // Calculate bounds of all nodes
    const bounds = {
      xMin: Math.min(...nodes.map((d) => d.x)),
      xMax: Math.max(...nodes.map((d) => d.x)),
      yMin: Math.min(...nodes.map((d) => d.y)),
      yMax: Math.max(...nodes.map((d) => d.y)),
    }

    const nodeSpread = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin)

    // Calculate scale to fit nodes in view with padding
    const padding = 50
    const scale = Math.min(
      (chartWidth - padding) / nodeSpread,
      (chartHeight - padding) / nodeSpread,
      1, // Don't zoom in beyond 1x
    )

    // Calculate center position
    const centerX = (bounds.xMin + bounds.xMax) / 2
    const centerY = (bounds.yMin + bounds.yMax) / 2
    const translateX = chartWidth / 2 - centerX * scale
    const translateY = chartHeight / 2 - centerY * scale

    // Apply transform with deltaX/deltaY offsets
    const finalTranslateX = translateX + (deltaX || 0)
    const finalTranslateY = translateY + (deltaY || 0)

    const container = select(chartRef.current).select('g')
    container.attr('transform', `translate(${finalTranslateX}, ${finalTranslateY}) scale(${scale})`)

    // Update zoom behavior's state to match the recenter transform
    const svg = select(chartRef.current)
    if (zoomBehaviorRef.current) {
      // Update the currentTransform tracking
      if (window.currentTransform) {
        window.currentTransform.x = finalTranslateX
        window.currentTransform.y = finalTranslateY
        window.currentTransform.k = scale
      }

      const recenterTransform = zoomIdentity.translate(finalTranslateX, finalTranslateY).scale(scale)
      svg.call(zoomBehaviorRef.current.transform, recenterTransform)
    }

    // Disable dynamic zooming after manual recenter
    if (window.userInteracting !== undefined) {
      window.userInteracting = true
      window.initialZooming = false
    }
  }, [nodes, props])

  // Generate tooltip HTML for network links
  const generateLinkTooltipHTML = useCallback(
    (d) => {
      // Use selected columns or fall back to auto-detected
      const detected = findNetworkColumns(props.columns)
      const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
      const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex
      const { weightColumnIndex } = detected

      const sourceColName =
        sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex]?.display_name || 'Source' : 'Source'
      const targetColName =
        targetColumnIndex !== -1 ? props.columns[targetColumnIndex]?.display_name || 'Target' : 'Target'
      const weightColName =
        weightColumnIndex !== -1 ? props.columns[weightColumnIndex]?.display_name || 'Weight' : 'Weight'

      const formattingConfig = props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting
      const weightColumn = weightColumnIndex !== -1 ? props.columns[weightColumnIndex] : null
      const formattedWeight = weightColumn
        ? formatElement({
            element: d.weight || 0,
            column: weightColumn,
            config: formattingConfig,
          })
        : new Intl.NumberFormat(formattingConfig?.languageCode || 'en-US', {
            maximumFractionDigits: 4,
          }).format(Number(d.weight || 0))

      return `
       <div>
         <strong>Relationship:</strong><br/>
         ${d.source.name} → ${d.target.name}<br/>
         <br/>
         <strong>Column Mapping:</strong><br/>
         ${sourceColName} → ${targetColName}<br/>
         <br/>
         <strong>Weight Details:</strong><br/>
         Total ${weightColName}: ${formattedWeight}<br/>
         Category: ${d.weight_category}<br/>
         Type: ${d.edge_type.replace(/_/g, ' ')}
       </div>
     `
    },
    [props.columns, props.dataFormatting, props.autoQLConfig, selectedSourceColumnIndex, selectedTargetColumnIndex],
  )

  // Generate tooltip HTML for network nodes
  const generateNodeTooltipHTML = useCallback(
    (d) => {
      // Get column info for proper formatting and labels - use selected columns or fall back to auto-detected
      const detected = findNetworkColumns(props.columns)
      const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
      const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex
      const { weightColumnIndex } = detected

      const sourceColumn = sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex] : null
      const targetColumn = targetColumnIndex !== -1 ? props.columns[targetColumnIndex] : null
      const weightColumn = weightColumnIndex !== -1 ? props.columns[weightColumnIndex] : null

      const formattingConfig = props.dataFormatting || getAutoQLConfig(props.autoQLConfig)?.dataFormatting
      const formattedAmountSent = weightColumn
        ? formatElement({
            element: d.amountSent || 0,
            column: weightColumn,
            config: formattingConfig,
          })
        : new Intl.NumberFormat(formattingConfig?.languageCode || 'en-US', {
            maximumFractionDigits: 4,
          }).format(Number(d.amountSent || 0))

      const formattedAmountReceived = weightColumn
        ? formatElement({
            element: d.amountReceived || 0,
            column: weightColumn,
            config: formattingConfig,
          })
        : new Intl.NumberFormat(formattingConfig?.languageCode || 'en-US', {
            maximumFractionDigits: 4,
          }).format(Number(d.amountReceived || 0))

      const weightColumnName = weightColumn?.display_name || 'Amount'
      const senderColumnName = sourceColumn?.display_name || 'Sender'
      const receiverColumnName = targetColumn?.display_name || 'Receiver'
      const senderLabel = senderColumnName
      const receiverLabel = receiverColumnName

      let tooltipContent = `
       <div>
         <strong>${d?.name || 'Unknown'}</strong><br/>
         <br/>
         <strong>Roles:</strong><br/>
         ${d?.isSender ? `✓ ${senderLabel}` : `✗ ${senderLabel}`}<br/>
         ${d?.isReceiver ? `✓ ${receiverLabel}` : `✗ ${receiverLabel}`}<br/>
         <br/>
      `

      // Add amount sent if node is a sender
      if (d?.isSender && d?.amountSent > 0) {
        tooltipContent += `<strong>Total ${weightColumnName} (${senderColumnName}):</strong><br/>
         ${formattedAmountSent}<br/>
         <br/>`
      }

      // Add amount received if node is a receiver
      if (d?.isReceiver && d?.amountReceived > 0) {
        tooltipContent += `<strong>Total ${weightColumnName} (${receiverColumnName}):</strong><br/>
         ${formattedAmountReceived}<br/>
         <br/>`
      }

      tooltipContent += `<strong>Network Stats:</strong><br/>
         Unique Connections: ${d?.connections || 0}<br/>
         Total Records: ${d?.totalTransfers || 0}
       </div>
     `

      return tooltipContent
    },
    [props.columns, props.dataFormatting, props.autoQLConfig, selectedSourceColumnIndex, selectedTargetColumnIndex],
  )

  // Process network data from tabular data
  const processNetworkData = useCallback((data, columns, sourceColIndex, targetColIndex) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { nodes: [], links: [] }
    }

    // Use provided column indices or fall back to auto-detection
    let sourceColumnIndex = sourceColIndex
    let targetColumnIndex = targetColIndex

    if (
      sourceColumnIndex === null ||
      sourceColumnIndex === undefined ||
      targetColumnIndex === null ||
      targetColumnIndex === undefined
    ) {
      const detected = findNetworkColumns(columns)
      sourceColumnIndex = sourceColumnIndex ?? detected.sourceColumnIndex
      targetColumnIndex = targetColumnIndex ?? detected.targetColumnIndex
    }

    // Get weight column index (always auto-detect this)
    const { weightColumnIndex } = findNetworkColumns(columns)

    if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
      return { nodes: [], links: [] }
    }

    // Create nodes and links from data with aggregation to remove duplicates
    const nodeMap = new Map()
    const linkMap = new Map() // Use Map to aggregate duplicate edges
    const connectionCounts = new Map()
    const nodeRoles = new Map() // Track actual roles nodes play in the data

    data.forEach((row, index) => {
      const source = formatNodeName(row[sourceColumnIndex])
      const target = formatNodeName(row[targetColumnIndex])
      const weight = weightColumnIndex !== -1 ? parseFloat(row[weightColumnIndex]) || 1 : 1

      // Track roles
      if (!nodeRoles.has(source)) {
        nodeRoles.set(source, { isSender: false, isReceiver: false })
      }
      if (!nodeRoles.has(target)) {
        nodeRoles.set(target, { isSender: false, isReceiver: false })
      }

      // Mark source as sender and target as receiver
      nodeRoles.get(source).isSender = true
      nodeRoles.get(target).isReceiver = true

      // Store raw values for drilldown filtering (exact values from data, no formatting)
      const rawSourceValue = row[sourceColumnIndex]
      const rawTargetValue = row[targetColumnIndex]

      // Add source node
      if (!nodeMap.has(source)) {
        nodeMap.set(source, {
          id: source,
          name: source,
          rawValue: rawSourceValue, // Store raw value for exact filter matching
          connections: 0,
          totalTransfers: 0,
          amountSent: 0,
          amountReceived: 0,
          isSender: false, // Will be updated based on actual data
        })
        connectionCounts.set(source, new Set())
      }

      // Add target node
      if (!nodeMap.has(target)) {
        nodeMap.set(target, {
          id: target,
          name: target,
          rawValue: rawTargetValue, // Store raw value for exact filter matching
          connections: 0,
          totalTransfers: 0,
          amountSent: 0,
          amountReceived: 0,
          isSender: false, // Will be updated based on actual data
        })
        connectionCounts.set(target, new Set())
      }

      // Count unique connections
      connectionCounts.get(source).add(target)
      connectionCounts.get(target).add(source)

      // Aggregate duplicate edges by combining weights
      const edgeKey = `${source}->${target}`
      if (linkMap.has(edgeKey)) {
        // Aggregate weights for duplicate edges
        linkMap.get(edgeKey).weight += weight
        linkMap.get(edgeKey).count += 1
      } else {
        // Store raw values for drilldown filtering (exact values from data, no formatting)
        const sourceNode = nodeMap.get(source)
        const targetNode = nodeMap.get(target)
        linkMap.set(edgeKey, {
          source,
          target,
          sourceRawValue: sourceNode?.rawValue, // Store raw value for exact filter matching
          targetRawValue: targetNode?.rawValue, // Store raw value for exact filter matching
          weight,
          count: 1,
          weight_category: getWeightCategory(weight),
          edge_type: getEdgeType(source, target, sourceNode, targetNode),
        })
      }

      // Track amount sent per node
      nodeMap.get(source).amountSent += weight

      // Track amount received per node
      nodeMap.get(target).amountReceived += weight

      // Track total transfers (count of individual transactions)
      nodeMap.get(source).totalTransfers += 1
      nodeMap.get(target).totalTransfers += 1
    })

    // Set final connection counts and roles based on actual data
    nodeMap.forEach((node, nodeId) => {
      node.connections = connectionCounts.get(nodeId).size
      const roles = nodeRoles.get(nodeId)
      if (roles) {
        node.isSender = roles.isSender
        node.isReceiver = roles.isReceiver
      }
    })

    const nodes = Array.from(nodeMap.values())
    const links = Array.from(linkMap.values())

    return { nodes, links }
  }, [])

  // Helper function to handle node click (drilldown)
  const handleNodeClick = useCallback(
    (event, nodeData) => {
      // Close any open popovers when clicking on a node
      setShowFilterDropdown(false)
      setShowSourceDropdown(false)
      setShowTargetDropdown(false)

      // Validate nodeData
      if (!nodeData || !nodeData.id) {
        return
      }

      if (!props.onChartClick) {
        return
      }

      // Use selected columns or fall back to auto-detected
      const detected = findNetworkColumns(props.columns)
      const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
      const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex

      if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
        return
      }

      // Use the raw value stored in the node data (exact value from original data, no formatting)
      // This ensures the filter matches exactly with the database values
      const rawNodeValue = nodeData.rawValue

      if (rawNodeValue === null || rawNodeValue === undefined) {
        console.warn('[ChataNetworkGraph] handleNodeClick: node missing rawValue', {
          nodeId: nodeData.id,
          nodeData,
        })
        return
      }

      // Special case: node is both sender and receiver - use OR filter
      if (nodeData.isSender && nodeData.isReceiver) {
        // Create two rows: one for source column, one for target column
        const sourceRow = new Array(props.columns.length).fill(null)
        sourceRow[sourceColumnIndex] = rawNodeValue

        const targetRow = new Array(props.columns.length).fill(null)
        targetRow[targetColumnIndex] = rawNodeValue

        // Pass filters with OR flag to indicate they should be combined with OR logic
        props.onChartClick({
          stringColumnIndices: [sourceColumnIndex, targetColumnIndex],
          rows: [sourceRow, targetRow],
          columns: props.columns,
          activeKey: `node-${nodeData.id}`,
          useOrLogic: true, // Flag to indicate OR logic should be used
        })
        return
      }

      // Determine which column to use based on node role
      let stringColumnIndex = -1
      if (nodeData.isSender && !nodeData.isReceiver) {
        // Node is only a sender - filter by source column
        stringColumnIndex = sourceColumnIndex
      } else if (nodeData.isReceiver && !nodeData.isSender) {
        // Node is only a receiver - filter by target column
        stringColumnIndex = targetColumnIndex
      }

      if (stringColumnIndex === -1) {
        return
      }

      // Create a row with the exact raw node value at the correct column index
      // No formatting, no trimming - use the exact value from the original data
      const row = new Array(props.columns.length).fill(null)
      row[stringColumnIndex] = rawNodeValue

      // Use standard onChartClick pattern
      props.onChartClick({
        row,
        columnIndex: stringColumnIndex,
        columns: props.columns,
        stringColumnIndex,
        activeKey: `node-${nodeData.id}`,
      })
    },
    [
      props.columns,
      props.onChartClick,
      props.data,
      selectedSourceColumnIndex,
      selectedTargetColumnIndex,
      setShowFilterDropdown,
      setShowSourceDropdown,
      setShowTargetDropdown,
    ],
  )

  // Helper function to handle link click (drilldown)
  const handleLinkClick = useCallback(
    (event, linkData) => {
      // Close any open popovers when clicking on a link
      setShowFilterDropdown(false)
      setShowSourceDropdown(false)
      setShowTargetDropdown(false)

      if (!props.onChartClick) {
        return
      }

      // Use selected columns or fall back to auto-detected
      const detected = findNetworkColumns(props.columns)
      const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
      const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex

      if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
        return
      }

      const sourceValue = typeof linkData.source === 'object' ? linkData.source.id : linkData.source
      const targetValue = typeof linkData.target === 'object' ? linkData.target.id : linkData.target

      // Use the raw values stored in the link data (exact values from original data, no formatting)
      // This ensures the filter matches exactly with the database values
      const sourceNode = typeof linkData.source === 'object' ? linkData.source : null
      const targetNode = typeof linkData.target === 'object' ? linkData.target : null

      const rawSourceValue = sourceNode?.rawValue || linkData.sourceRawValue
      const rawTargetValue = targetNode?.rawValue || linkData.targetRawValue

      if (
        rawSourceValue === null ||
        rawSourceValue === undefined ||
        rawTargetValue === null ||
        rawTargetValue === undefined
      ) {
        console.warn('[ChataNetworkGraph] handleLinkClick: missing raw values', {
          sourceValue,
          targetValue,
          sourceNode,
          targetNode,
          linkData,
        })
        return
      }

      // Create rows with the exact raw values at the correct column indices
      // No formatting, no trimming - use the exact values from the original data
      const sourceRowForFilter = new Array(props.columns.length).fill(null)
      sourceRowForFilter[sourceColumnIndex] = rawSourceValue

      const targetRowForFilter = new Array(props.columns.length).fill(null)
      targetRowForFilter[targetColumnIndex] = rawTargetValue

      props.onChartClick({
        stringColumnIndices: [sourceColumnIndex, targetColumnIndex],
        rows: [sourceRowForFilter, targetRowForFilter],
        columns: props.columns,
        activeKey: `link-${sourceValue}-${targetValue}`,
      })
    },
    [
      props.columns,
      props.onChartClick,
      props.data,
      selectedSourceColumnIndex,
      selectedTargetColumnIndex,
      setShowFilterDropdown,
      setShowSourceDropdown,
      setShowTargetDropdown,
    ],
  )

  // Helper functions
  const formatNodeName = useCallback((name) => {
    if (typeof name === 'string') {
      return name.trim()
    }
    return String(name || 'Unknown')
  }, [])

  const getWeightCategory = useCallback((weight) => {
    if (weight > 1000) return 'large'
    if (weight > 100) return 'medium'
    return 'small'
  }, [])

  const getEdgeType = useCallback((source, target, sourceNode, targetNode) => {
    // Use actual node roles from the data instead of keyword matching
    if (sourceNode?.isSender && targetNode?.isSender) return 'sender-to-sender'
    if (sourceNode?.isSender && targetNode?.isReceiver) return 'sender-to-receiver'
    if (sourceNode?.isReceiver && targetNode?.isReceiver) return 'receiver-to-receiver'
    return 'standard'
  }, [])

  const getNodeRadius = useCallback((d) => {
    const scaleFn = radiusScaleRef.current
    try {
      return Math.max(2, scaleFn(d?.amountSent || 0))
    } catch (e) {
      return 6
    }
  }, [])

  const getNodeColor = useCallback((d) => {
    // Add null check
    if (!d) return '#28A745'
    // Nodes that are both sender and receiver get blue color
    if (d.isSender && d.isReceiver) return '#28A8E0' // Blue for both sender and receiver
    if (d.isSender) return '#DC3545' // Red for sender only
    return '#28A745' // Green for other nodes (receivers)
  }, [])

  // Track drag state to distinguish clicks from drags
  const dragStateRef = useRef({ isDragging: false, startPos: null, nodeData: null })

  // Drag event handlers
  const dragstarted = useCallback((event, d) => {
    // Track drag start position and node data
    dragStateRef.current = {
      isDragging: false,
      startPos: { x: event.x, y: event.y },
      nodeData: d,
    }

    // Disable dynamic zooming when user starts dragging
    if (window.userInteracting !== undefined) {
      window.userInteracting = true
      window.initialZooming = false
    }

    // Disable all tooltips during drag (only remove tooltip-id, keep HTML to avoid regeneration)
    const svg = select(chartRef.current)
    svg.selectAll('[data-tooltip-id]').attr('data-tooltip-id', null).style('pointer-events', 'none')

    if (!event.active) simulationRef.current?.alphaTarget(0.4).restart()
    d.fx = d.x
    d.fy = d.y
  }, [])

  const dragged = useCallback((event, d) => {
    // Check if mouse moved more than 5 pixels (indicating a drag, not a click)
    if (dragStateRef.current.startPos) {
      const moveDistance = Math.sqrt(
        Math.pow(event.x - dragStateRef.current.startPos.x, 2) + Math.pow(event.y - dragStateRef.current.startPos.y, 2),
      )
      if (moveDistance > 5) {
        dragStateRef.current.isDragging = true
      }
    }
    d.fx = event.x
    d.fy = event.y
  }, [])

  const dragended = useCallback(
    (event, d) => {
      if (!event.active) simulationRef.current?.alphaTarget(0)

      // Use the node data from the event (d) instead of dragStateRef
      // If this was a click (not a drag), trigger drilldown
      if (!dragStateRef.current.isDragging && d && d.id) {
        // Stop event propagation to prevent link click handlers from firing
        if (event.sourceEvent) {
          event.sourceEvent.stopPropagation()
        }
        // Use setTimeout to ensure this happens after drag handlers complete
        setTimeout(() => {
          handleNodeClick(event, d)
        }, 0)
      }

      // Reset drag state
      dragStateRef.current = { isDragging: false, startPos: null, nodeData: null }

      // Re-enable all tooltips after drag (restore tooltip-id, HTML was preserved)
      const svg = select(chartRef.current)
      svg.selectAll('.node').attr('data-tooltip-id', props.chartTooltipID).style('pointer-events', 'all')
      svg.selectAll('.link.hover-layer').attr('data-tooltip-id', props.chartTooltipID).style('pointer-events', 'all')

      // Mark user interaction complete so future auto-stop applies only to initial animation
      if (window.userInteracting !== undefined) {
        window.userInteracting = false
      }
    },
    [props.chartTooltipID, handleNodeClick],
  )

  // Function to calculate initial scale based on node count and available space
  const calculateInitialScale = useCallback((nodes, links, width, height) => {
    if (!nodes.length) return 1

    // Estimate the space needed based on node count and connections
    const nodeCount = nodes.length
    const linkCount = links.length

    // Calculate estimated radius needed for the network (more conservative)
    const estimatedRadius = Math.sqrt(nodeCount) * 40 + linkCount * 3 // Reduced multipliers

    // Calculate scale needed to fit in viewport
    const availableRadius = Math.min(width, height) * 0.35 // Reduced from 0.4
    const scale = Math.min(availableRadius / estimatedRadius, 1)

    return Math.max(scale, 0.4) // Increased minimum scale from 0.3
  }, [])

  // Create boundary force to keep nodes within chart bounds
  const createBoundaryForce = useCallback(
    (width, height) => {
      const padding = 30 // Increased padding

      return (alpha) => {
        nodes.forEach((d) => {
          const radius = getNodeRadius(d)
          const minX = padding + radius
          const maxX = width - padding - radius
          const minY = padding + radius
          const maxY = height - padding - radius

          // Keep nodes within horizontal bounds
          if (d.x < minX) {
            d.x = minX
            d.vx = 0
          } else if (d.x > maxX) {
            d.x = maxX
            d.vx = 0
          }

          // Keep nodes within vertical bounds
          if (d.y < minY) {
            d.y = minY
            d.vy = 0
          } else if (d.y > maxY) {
            d.y = maxY
            d.vy = 0
          }
        })
      }
    },
    [getNodeRadius],
  )

  // Update visibility of nodes and links based on filters without recreating
  const updateVisibility = useCallback(() => {
    if (!nodeSelectionRef.current || !linkSelectionRef.current) {
      return
    }

    const visibleNodeIds = new Set()

    // Update node visibility
    nodeSelectionRef.current.each(function (d) {
      // Add null check
      if (!d) return
      const isSenderOnly = d.isSender && !d.isReceiver
      const isReceiverOnly = d.isReceiver && !d.isSender
      const isBoth = d.isSender && d.isReceiver

      let shouldShow = false
      if (isBoth) shouldShow = showBoth
      else if (isSenderOnly) shouldShow = showSenders
      else if (isReceiverOnly) shouldShow = showReceivers

      const nodeElement = select(this)
      if (shouldShow) {
        nodeElement.style('display', null)
        visibleNodeIds.add(d.id)
      } else {
        nodeElement.style('display', 'none')
      }
    })

    // Update link visibility (both hover layer and visible links)
    const svg = select(chartRef.current)
    if (svg) {
      svg.selectAll('line.link').each(function (d) {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source
        const targetId = typeof d.target === 'object' ? d.target.id : d.target
        const shouldShow = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)

        const linkElement = select(this)
        if (shouldShow) {
          linkElement.style('display', null)
        } else {
          linkElement.style('display', 'none')
        }
      })
    }

    // Don't restart simulation - just hide/show nodes to keep them still
  }, [showSenders, showReceivers, showBoth])

  // Create network visualization
  const createNetworkVisualization = useCallback(() => {
    const { height, width, deltaX, deltaY, innerHeight, innerWidth } = props

    if (!nodes.length || !links.length) {
      return
    }

    // Use requestAnimationFrame to ensure DOM is ready (like pie chart)
    requestAnimationFrame(() => {
      // Remove any existing visualization
      destroyVisualization()

      // Get our SVG element
      const svgElement = chartRef.current
      if (!svgElement) {
        return
      }

      const svg = select(svgElement)

      // Create container for links and nodes with zoom support
      const container = svg.append('g')

      // Add arrow definitions for directed edges
      svg
        .append('defs')
        .append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', 'var(--react-autoql-text-color-placeholder)')
        .style('stroke', 'none')

      // Add zoom behavior
      let isProgrammaticZoom = false // Flag to track programmatic zoom updates
      let currentTransform = { x: deltaX || 0, y: deltaY || 0, k: 1.0 } // Track current transform for smooth interpolation
      const zoomBehavior = zoom()

      // Store zoom behavior reference for recenter function
      zoomBehaviorRef.current = zoomBehavior
        .scaleExtent([0.001, 32]) // Allow zooming out/in much further to see all networks
        .filter((event) => {
          // Allow wheel, mouse, and touch events for zoom and pan (mobile support)
          return (
            event.type === 'wheel' ||
            event.type === 'mousedown' ||
            event.type === 'mousemove' ||
            event.type === 'touchstart' ||
            event.type === 'touchmove'
          )
        })
        .on('zoom', (event) => {
          // Only disable dynamic zooming if this is a user interaction, not a programmatic update
          if (!isProgrammaticZoom) {
            userInteracting = true
            initialZooming = false
            window.userInteracting = true
            window.initialZooming = false
          }

          // Update the current transform tracking
          currentTransform.x = event.transform.x
          currentTransform.y = event.transform.y
          currentTransform.k = event.transform.k

          // Simply apply the D3 zoom transform directly
          container.attr('transform', event.transform)

          // Ensure nodes have minimum visual size of 1px radius
          // Visual radius = actualRadius * zoomScale
          // If visualRadius < 1, we need actualRadius >= 1 / zoomScale
          const minVisualRadius = 1.0 // 1px radius
          const zoomScale = event.transform.k
          if (nodeSelectionRef.current) {
            nodeSelectionRef.current.attr('r', (d) => {
              const originalRadius = d.originalRadius || getNodeRadius(d)
              const visualRadius = originalRadius * zoomScale
              // If visual size would be less than minimum, increase actual radius
              if (visualRadius < minVisualRadius) {
                return minVisualRadius / zoomScale
              }
              return originalRadius
            })
          }

          // Ensure links have minimum visual stroke width of 0.5px
          // Visual stroke width = actualStrokeWidth * zoomScale
          // If visualStrokeWidth < 0.5, we need actualStrokeWidth >= 0.5 / zoomScale
          const minVisualStrokeWidth = 0.5 // 0.5px stroke width
          if (linkSelectionRef.current) {
            linkSelectionRef.current.style('stroke-width', (d) => {
              const originalStrokeWidth = d.originalStrokeWidth || 1
              const visualStrokeWidth = originalStrokeWidth * zoomScale
              // If visual size would be less than minimum, increase actual stroke width
              if (visualStrokeWidth < minVisualStrokeWidth) {
                return `${minVisualStrokeWidth / zoomScale}px`
              }
              return `${originalStrokeWidth}px`
            })
          }

          // Keep hover layer stroke width constant at 8 pixels regardless of zoom
          // Actual stroke width = desired visual width / zoom scale
          const hoverLayerVisualWidth = 8 // Always 8 pixels on screen
          const svg = select(chartRef.current)
          if (svg) {
            svg.selectAll('line.hover-layer').style('stroke-width', `${hoverLayerVisualWidth / zoomScale}px`)
          }
        })

      // Prevent scroll from bubbling to outer window
      svg
        .style('touch-action', 'none')
        .on('wheel', (event) => {
          event.preventDefault()
          event.stopPropagation()
        })
        .on('touchstart', (event) => {
          event.preventDefault()
        })
        .on('touchmove', (event) => {
          event.preventDefault()
        })
        .call(zoomBehavior)

      // Use inner dimensions for proper centering (like pie chart)
      const chartWidth = innerWidth || width
      const chartHeight = innerHeight || height
      const centerX = chartWidth / 2
      const centerY = chartHeight / 2

      // Create simulation
      const simulation = forceSimulation(nodes)
        .alpha(1) // start "hotter" so nodes move faster initially
        .alphaDecay(0.04) // cool faster to settle sooner
        .velocityDecay(0.2) // less friction than default (0.4) -> snappier motion
        .force(
          'link',
          forceLink(links)
            .id((d) => d.id)
            .distance(80)
            .strength(0.2),
        )
        .force('charge', forceManyBody().strength(-600))
        .force('center', forceCenter(centerX, centerY))
        .force(
          'collision',
          forceCollide()
            .radius((d) => getNodeRadius(d) * 1.2)
            .strength(1),
        )
        .force('boundary', createBoundaryForce(chartWidth, chartHeight))

      simulationRef.current = simulation
      setSimulation(simulation)

      // Create links
      const linkGroup = container.append('g').attr('class', 'links')

      // Store original stroke width in link data
      links.forEach((d) => {
        d.originalStrokeWidth = 1
      })

      // Create invisible hover layer for easier hovering when zoomed out
      linkGroup
        .selectAll('line.hover-layer')
        .data(links)
        .enter()
        .append('line')
        .attr('class', (d) => `link hover-layer ${d.edge_type}`)
        .style('stroke', 'transparent')
        .style('stroke-width', '8') // Thicker invisible stroke for easier hovering
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .style('outline', 'none')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-float', true)
        .attr('data-tooltip-html', generateLinkTooltipHTML)
        .on('click', function (event, d) {
          // Check if the click target is actually a node (nodes should take priority)
          const target = event.target
          // If the click target is a circle (node), don't handle the link click
          if (target.tagName === 'circle' || target.classList.contains('node')) {
            return
          }
          event.stopPropagation()
          handleLinkClick(event, d)
        })

      // Create visible links on top
      const linkSelection = linkGroup
        .selectAll('line.visible-link')
        .data(links)
        .enter()
        .append('line')
        .attr('class', (d) => `link visible-link ${d.edge_type}`)
        .style('stroke', (d) => 'var(--react-autoql-text-color-placeholder)')
        .style('stroke-width', (d) => d.originalStrokeWidth)
        .style('outline', 'none')
        .style('pointer-events', 'none') // Let hover layer handle pointer events
        .attr('marker-end', 'url(#arrowhead)')

      linkSelectionRef.current = linkSelection

      // Create nodes
      const nodeGroup = container.append('g').attr('class', 'nodes')

      // Store original radius in node data
      nodes.forEach((d) => {
        d.originalRadius = getNodeRadius(d)
      })

      const nodeSelection = nodeGroup
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', (d) => d.originalRadius)
        .style('fill', (d) => getNodeColor(d))
        .style('stroke', '#fff')
        .style('stroke-width', '1.5px')
        .style('cursor', (d) => {
          // Only show pointer cursor for nodes that can be clicked (not both sender and receiver)
          if (!d) return 'move'
          if (d.isSender && d.isReceiver) {
            return 'move'
          }
          return 'pointer'
        })
        .style('outline', 'none')
        .style('pointer-events', 'all')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', generateNodeTooltipHTML)
        .on('click', function (event, d) {
          // Stop propagation to prevent link clicks from firing
          event.stopPropagation()
        })
        .call(drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))

      nodeSelectionRef.current = nodeSelection

      // Set initial positions spread out in a reasonable area
      const spreadRadius = Math.min(chartWidth, chartHeight) * 0.2 // Reasonable spread

      nodes.forEach((d, i) => {
        // Spread nodes in a circle initially
        const angle = (i / nodes.length) * 2 * Math.PI
        const radius = spreadRadius * (0.5 + Math.random() * 0.5) // Add some randomness
        d.x = centerX + radius * Math.cos(angle)
        d.y = centerY + radius * Math.sin(angle)
      })

      // Start with a reasonable scale to see the network (will be adjusted dynamically)
      const initialScale = 1.0 // Start at normal scale, let dynamic zooming handle the rest
      const initialTransform = `translate(${deltaX || 0}, ${deltaY || 0}) scale(${initialScale})`
      container.attr('transform', initialTransform)

      // Initialize zoom behavior's state to match the initial transform
      // This prevents jumps on the first zoom
      const initialZoomTransform = zoomIdentity.translate(deltaX || 0, deltaY || 0).scale(initialScale)
      svg.call(zoomBehavior.transform, initialZoomTransform)

      // Set initial visibility based on filters
      updateVisibility()

      // Add background rectangle for panning (after positioning is set)
      const background = svg
        .insert('rect', ':first-child') // Insert as first child so it's behind everything
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'grab')
        .style('pointer-events', 'all') // Ensure it can receive events

      // Update positions on simulation tick with dynamic zooming
      let initialZooming = true
      let userInteracting = false

      // Make variables accessible to drag handlers
      window.initialZooming = initialZooming
      window.userInteracting = userInteracting
      window.currentTransform = currentTransform

      // Early-stop controls to prevent sluggish simulations from hogging the browser
      const simulationStartMs = Date.now()
      let consecutiveSlowTicks = 0
      const MAX_SIMULATION_RUNTIME_MS = 10000 // hard cap
      const SLOW_SPEED_EPSILON = 0.01 // avg |vx| + |vy| per node considered "slow"
      const MAX_CONSECUTIVE_SLOW_TICKS = 60 // e.g., ~1s at 60fps

      simulation.on('tick', () => {
        if (!linkSelectionRef.current) return

        // Function to calculate link endpoints
        const getLinkCoords = (d) => {
          const sourceRadius = getNodeRadius(d.source)
          const targetRadius = getNodeRadius(d.target)
          const dx = d.target.x - d.source.x
          const dy = d.target.y - d.source.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance === 0) {
            return {
              x1: d.source.x,
              y1: d.source.y,
              x2: d.target.x,
              y2: d.target.y,
            }
          }

          const sourceRatio = sourceRadius / distance
          const targetRatio = targetRadius / distance

          return {
            x1: d.source.x + dx * sourceRatio,
            y1: d.source.y + dy * sourceRatio,
            x2: d.target.x - dx * targetRatio,
            y2: d.target.y - dy * targetRatio,
          }
        }

        // Update hover layer (invisible, thicker for easier hovering)
        linkGroup
          .selectAll('line.hover-layer')
          .attr('x1', (d) => {
            const coords = getLinkCoords(d)
            return coords.x1
          })
          .attr('y1', (d) => {
            const coords = getLinkCoords(d)
            return coords.y1
          })
          .attr('x2', (d) => {
            const coords = getLinkCoords(d)
            return coords.x2
          })
          .attr('y2', (d) => {
            const coords = getLinkCoords(d)
            return coords.y2
          })

        // Update visible links
        linkSelectionRef.current
          .attr('x1', (d) => {
            const coords = getLinkCoords(d)
            return coords.x1
          })
          .attr('y1', (d) => {
            const coords = getLinkCoords(d)
            return coords.y1
          })
          .attr('x2', (d) => {
            const coords = getLinkCoords(d)
            return coords.x2
          })
          .attr('y2', (d) => {
            const coords = getLinkCoords(d)
            return coords.y2
          })

        if (!nodeSelectionRef.current) return
        nodeSelectionRef.current.attr('cx', (d) => d.x).attr('cy', (d) => d.y)

        // Dynamic zooming during initial simulation to keep everything in view
        if (window.initialZooming && !window.userInteracting && simulation.alpha() > 0.1) {
          // Calculate bounds of all nodes
          const bounds = {
            xMin: Math.min(...nodes.map((d) => d.x)),
            xMax: Math.max(...nodes.map((d) => d.x)),
            yMin: Math.min(...nodes.map((d) => d.y)),
            yMax: Math.max(...nodes.map((d) => d.y)),
          }

          const nodeSpread = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin)

          // Calculate scale to fit nodes in view with some padding
          const padding = 50
          const targetScale = Math.min(
            (chartWidth - padding) / nodeSpread,
            (chartHeight - padding) / nodeSpread,
            1, // Don't zoom in beyond 1x
          )

          // Apply zoom if nodes are spreading out of view
          if (targetScale < 0.8) {
            const centerX = (bounds.xMin + bounds.xMax) / 2
            const centerY = (bounds.yMin + bounds.yMax) / 2
            const targetTranslateX = chartWidth / 2 - centerX * targetScale
            const targetTranslateY = chartHeight / 2 - centerY * targetScale

            // Preserve the initial deltaX and deltaY offsets
            const finalTargetX = targetTranslateX + (deltaX || 0)
            const finalTargetY = targetTranslateY + (deltaY || 0)

            // Smooth interpolation to make zooming slower (interpolation factor: 0.15 makes it slower)
            const interpolationFactor = 0.15
            currentTransform.x += (finalTargetX - currentTransform.x) * interpolationFactor
            currentTransform.y += (finalTargetY - currentTransform.y) * interpolationFactor
            currentTransform.k += (targetScale - currentTransform.k) * interpolationFactor

            container.attr(
              'transform',
              `translate(${currentTransform.x}, ${currentTransform.y}) scale(${currentTransform.k})`,
            )

            // Update zoom behavior's state to match the dynamic zooming (without triggering user interaction)
            if (zoomBehavior && svg) {
              isProgrammaticZoom = true
              const dynamicZoomTransform = zoomIdentity
                .translate(currentTransform.x, currentTransform.y)
                .scale(currentTransform.k)
              svg.call(zoomBehavior.transform, dynamicZoomTransform)
              isProgrammaticZoom = false
            }
          }
        }

        // Stop dynamic zooming when simulation settles
        if (simulation.alpha() < 0.1) {
          initialZooming = false
          window.initialZooming = false

          // Update zoom behavior's state to match the final dynamic zooming state
          if (zoomBehavior && svg) {
            isProgrammaticZoom = true
            const finalZoomTransform = zoomIdentity
              .translate(currentTransform.x, currentTransform.y)
              .scale(currentTransform.k)
            svg.call(zoomBehavior.transform, finalZoomTransform)
            isProgrammaticZoom = false
          }
        }

        // Early-stop if the graph is barely moving for a while or we exceed max runtime
        const avgSpeed = nodes.length
          ? nodes.reduce((sum, n) => sum + Math.abs(n.vx || 0) + Math.abs(n.vy || 0), 0) / nodes.length
          : 0
        if (avgSpeed < SLOW_SPEED_EPSILON) {
          consecutiveSlowTicks += 1
        } else {
          consecutiveSlowTicks = 0
        }
        const ranTooLong = Date.now() - simulationStartMs > MAX_SIMULATION_RUNTIME_MS
        const movingTooSlow = consecutiveSlowTicks >= MAX_CONSECUTIVE_SLOW_TICKS
        if ((ranTooLong || movingTooSlow) && !earlyStopDisabledRef.current) {
          initialZooming = false
          window.initialZooming = false
          // Stop once, then disable further auto-stops for component lifetime
          simulation.stop()
          earlyStopDisabledRef.current = true
        }
      })
    })
  }, [
    nodes,
    links,
    getNodeRadius,
    getNodeColor,
    dragstarted,
    dragged,
    dragended,
    calculateInitialScale,
    createBoundaryForce,
    updateVisibility,
    handleLinkClick,
    handleNodeClick,
    generateNodeTooltipHTML,
    generateLinkTooltipHTML,
  ])

  // Destroy visualization
  const destroyVisualization = useCallback(() => {
    // Clear SVG content
    const svgElement = chartRef.current
    if (svgElement) {
      select(svgElement).selectAll('*').remove()
    }

    // Stop simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }
  }, [])

  // Process data on mount and when props change
  useEffect(() => {
    const { data, columns } = props

    if (!data || !Array.isArray(data) || data.length === 0) {
      setNodes([])
      setLinks([])
      return
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      setNodes([])
      setLinks([])
      return
    }

    const processedData = processNetworkData(data, columns, selectedSourceColumnIndex, selectedTargetColumnIndex)

    setNodes(processedData.nodes)
    setLinks(processedData.links)
  }, [props.data, props.columns, processNetworkData, selectedSourceColumnIndex, selectedTargetColumnIndex])

  // Create visualization when nodes/links change
  useEffect(() => {
    if (nodes.length > 0 && links.length > 0) {
      // Compute dynamic radius scale based on amountSent across nodes
      const amounts = nodes.map((n) => n.amountSent || 0)
      const minAmount = Math.min(...amounts)
      const maxAmount = Math.max(...amounts)

      // Avoid divide-by-zero; define a reasonable visual range
      const minRadius = 6
      const maxRadius = 28

      if (isFinite(minAmount) && isFinite(maxAmount) && maxAmount > minAmount) {
        // Apply 5x diameter constraint: largest diameter cannot be more than 5x the smallest
        const minDiameter = minRadius * 2
        const maxAllowedDiameter = minDiameter * 5
        const maxAllowedRadius = maxAllowedDiameter / 2

        // Use the smaller of our desired max radius or the 5x constraint
        const effectiveMaxRadius = Math.min(maxRadius, maxAllowedRadius)

        radiusScaleRef.current = (val) => {
          const t = (val - minAmount) / (maxAmount - minAmount)
          return minRadius + t * (effectiveMaxRadius - minRadius)
        }
      } else {
        // All amounts equal or invalid; use constant radius
        radiusScaleRef.current = () => minRadius
      }

      createNetworkVisualization()
    }
  }, [nodes, links, createNetworkVisualization])

  // Update visibility when filters change (without recreating visualization)
  useEffect(() => {
    if (nodeSelectionRef.current && linkSelectionRef.current) {
      updateVisibility()
    }
  }, [showSenders, showReceivers, showBoth, updateVisibility])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showFilterDropdown && !showSourceDropdown && !showTargetDropdown) return

    let mouseDownPos = null
    let mouseDownTarget = null

    const handleMouseDown = (event) => {
      mouseDownPos = { x: event.clientX, y: event.clientY }
      mouseDownTarget = event.target
    }

    const handleMouseUp = (event) => {
      if (!mouseDownPos || !mouseDownTarget) {
        return
      }

      // Check if this was a click (mouse moved less than 5px) vs a drag
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + Math.pow(event.clientY - mouseDownPos.y, 2),
      )
      if (moveDistance > 5) {
        // This was a drag, not a click
        mouseDownPos = null
        mouseDownTarget = null
        return
      }

      const svgElement = chartRef.current
      if (!svgElement) {
        return
      }

      // Check if click is inside the SVG element
      const clickTarget = event.target
      const isInsideSVG = svgElement.contains(clickTarget) || svgElement === clickTarget

      // Check if click is inside dropdown
      const checkElement = (el) => {
        if (!el) return false

        // Check for SVG elements (filter dropdown)
        const svgClass = el.getAttribute?.('class') || ''
        if (svgClass) {
          if (
            svgClass.includes('filter-dropdown') ||
            svgClass.includes('filter-dropdown-item-rect') ||
            svgClass.includes('filter-dropdown-item-text') ||
            svgClass.includes('filter-dropdown-background') ||
            svgClass.includes('filter-button') ||
            svgClass.includes('node-filter-button') ||
            svgClass.includes('source-button') ||
            svgClass.includes('source-dropdown') ||
            svgClass.includes('target-button') ||
            svgClass.includes('target-dropdown')
          ) {
            return true
          }
        }

        // Check for HTML elements (column selection dropdowns inside foreignObject)
        // Check both className property and class attribute
        const htmlClass = el.className || el.getAttribute?.('class') || ''
        if (htmlClass) {
          const classString = typeof htmlClass === 'string' ? htmlClass : htmlClass.baseVal || ''
          if (
            classString.includes('source-dropdown-item') ||
            classString.includes('target-dropdown-item') ||
            classString.includes('source-dropdown') ||
            classString.includes('target-dropdown')
          ) {
            return true
          }
        }

        // Check if element is a foreignObject (which contains the column dropdowns)
        const tagName = el.tagName?.toLowerCase() || ''
        if (tagName === 'foreignobject') {
          return true
        }

        return false
      }

      let current = clickTarget
      let isInsideDropdown = false
      // Traverse up the DOM tree, checking both parentElement and parentNode
      // to handle both HTML and SVG elements
      for (let i = 0; i < 30 && current; i++) {
        if (checkElement(current)) {
          isInsideDropdown = true
          break
        }

        // Move to parent - try both parentElement (HTML) and parentNode (SVG)
        const parent = current.parentElement || current.parentNode

        // Stop if we've reached the SVG element or document body
        if (parent === svgElement || parent === document.body || !parent) {
          break
        }

        current = parent
      }

      // Don't close if clicking inside dropdown or filter button
      if (isInsideDropdown) {
        mouseDownPos = null
        mouseDownTarget = null
        return
      }

      // Close dropdowns for any other click (inside SVG graph area or outside SVG)
      setShowFilterDropdown(false)
      setShowSourceDropdown(false)
      setShowTargetDropdown(false)
      mouseDownPos = null
      mouseDownTarget = null
    }

    const handleClick = (event) => {
      const svgElement = chartRef.current
      if (!svgElement) return

      const clickTarget = event.target
      const isInsideSVG = svgElement.contains(clickTarget) || svgElement === clickTarget

      // Check if click is inside dropdown
      const checkElement = (el) => {
        if (!el) return false

        // Check for SVG elements (filter dropdown)
        const svgClass = el.getAttribute?.('class') || ''
        if (svgClass) {
          if (
            svgClass.includes('filter-dropdown') ||
            svgClass.includes('filter-dropdown-item-rect') ||
            svgClass.includes('filter-dropdown-item-text') ||
            svgClass.includes('filter-dropdown-background') ||
            svgClass.includes('filter-button') ||
            svgClass.includes('node-filter-button') ||
            svgClass.includes('source-button') ||
            svgClass.includes('source-dropdown') ||
            svgClass.includes('target-button') ||
            svgClass.includes('target-dropdown')
          ) {
            return true
          }
        }

        // Check for HTML elements (column selection dropdowns inside foreignObject)
        // Check both className property and class attribute
        const htmlClass = el.className || el.getAttribute?.('class') || ''
        if (htmlClass) {
          const classString = typeof htmlClass === 'string' ? htmlClass : htmlClass.baseVal || ''
          if (
            classString.includes('source-dropdown-item') ||
            classString.includes('target-dropdown-item') ||
            classString.includes('source-dropdown') ||
            classString.includes('target-dropdown')
          ) {
            return true
          }
        }

        // Check if element is a foreignObject (which contains the column dropdowns)
        const tagName = el.tagName?.toLowerCase() || ''
        if (tagName === 'foreignobject') {
          return true
        }

        return false
      }

      let current = clickTarget
      let isInsideDropdown = false
      // Traverse up the DOM tree, checking both parentElement and parentNode
      // to handle both HTML and SVG elements
      for (let i = 0; i < 30 && current; i++) {
        if (checkElement(current)) {
          isInsideDropdown = true
          break
        }

        // Move to parent - try both parentElement (HTML) and parentNode (SVG)
        const parent = current.parentElement || current.parentNode

        // Stop if we've reached the SVG element or document body
        if (parent === svgElement || parent === document.body || !parent) {
          break
        }

        current = parent
      }

      if (!isInsideDropdown && isInsideSVG) {
        setShowFilterDropdown(false)
        setShowSourceDropdown(false)
        setShowTargetDropdown(false)
      }
    }

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      // Use capture phase to catch events before they're handled by zoom behavior
      document.addEventListener('mousedown', handleMouseDown, true)
      document.addEventListener('mouseup', handleMouseUp, true)
      document.addEventListener('click', handleClick, true)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [showFilterDropdown, showSourceDropdown, showTargetDropdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyVisualization()
    }
  }, [destroyVisualization])

  // Render - create our own SVG inside the g container
  return (
    <g>
      <svg
        className='react-autoql-network-viz'
        ref={chartRef}
        width={props.width || 600}
        height={props.height || 400}
        viewBox={`0 0 ${props.width || 600} ${props.height || 400}`}
        style={{
          background: 'var(--react-autoql-background-color-secondary, #f9f9f9)',
        }}
        onClick={(e) => {
          // Close dropdown when clicking on the graph (but not on buttons or dropdown)
          const target = e.target
          const tagName = target.tagName?.toLowerCase()
          const className = target.getAttribute?.('class') || ''

          // Helper function to check if element is inside a dropdown or button
          const checkElement = (el) => {
            if (!el) return false

            // Check tag name first
            const elTagName = el.tagName?.toLowerCase() || ''
            if (elTagName === 'foreignobject') {
              return true
            }

            // Check for SVG elements - be more specific about button rects
            const svgClass = el.getAttribute?.('class') || ''
            if (svgClass) {
              // Only consider it "inside" if it's actually a button rect, not just a button group
              if (
                svgClass.includes('filter-button-rect') ||
                svgClass.includes('recenter-button-rect') ||
                svgClass.includes('source-button-rect') ||
                svgClass.includes('target-button-rect')
              ) {
                return true
              }
            }

            // Check for HTML elements (popover content)
            const htmlClass = el.className || el.getAttribute?.('class') || ''
            if (htmlClass) {
              const classString = typeof htmlClass === 'string' ? htmlClass : htmlClass.baseVal || ''
              if (
                classString.includes('source-dropdown-item') ||
                classString.includes('target-dropdown-item') ||
                classString.includes('filter-dropdown-item') ||
                classString.includes('source-dropdown-popover-content') ||
                classString.includes('target-dropdown-popover-content') ||
                classString.includes('filter-dropdown-popover-content') ||
                classString.includes('source-dropdown-container') ||
                classString.includes('target-dropdown-container') ||
                classString.includes('filter-dropdown-container')
              ) {
                return true
              }
            }

            return false
          }

          // Check if we're clicking on a button rect specifically - if so, don't close (let button handle it)
          const isButtonRect =
            tagName === 'rect' &&
            (className.includes('source-button-rect') ||
              className.includes('target-button-rect') ||
              className.includes('filter-button-rect') ||
              className.includes('recenter-button-rect'))

          // Check if we're inside a button or popover by walking up the parent chain
          let current = target
          let isInsideButtonOrDropdown = false
          for (let i = 0; i < 30 && current; i++) {
            if (checkElement(current)) {
              isInsideButtonOrDropdown = true
              break
            }
            const parent = current.parentElement || current.parentNode
            if (parent === chartRef.current || !parent || parent === document.body) {
              break
            }
            current = parent
          }

          // Close popovers if clicking on SVG background or graph elements, but not on buttons/popovers
          // Always close when clicking on the SVG itself (background) or graph elements
          if (!isButtonRect && !isInsideButtonOrDropdown) {
            setShowFilterDropdown(false)
            setShowSourceDropdown(false)
            setShowTargetDropdown(false)
          }
        }}
      />
      {/* Recenter button as SVG element */}
      <g className='recenter-button' transform={`translate(${(props.width || 600) - 32}, 10)`}>
        <rect
          className='recenter-button-rect'
          width='30'
          height='30'
          rx='4'
          strokeWidth='1'
          opacity={0} // Use opacity 0 so it doesnt show in the exported PNG
          onClick={recenter}
          data-tooltip-id={props.chartTooltipID}
          data-tooltip-html='Fit to screen'
        />
        <g transform='translate(5, 5)'>
          {/* Use opacity 0 so it doesnt show in the exported PNG */}
          <MdOutlineFitScreen className='recenter-button-icon' size={20} style={{ opacity: 0 }} />
        </g>
      </g>
      {/* Filter button with dropdown */}
      {(() => {
        // Use selected columns or fall back to auto-detected
        const detected = findNetworkColumns(props.columns)
        const sourceColumnIndex = selectedSourceColumnIndex ?? detected.sourceColumnIndex
        const targetColumnIndex = selectedTargetColumnIndex ?? detected.targetColumnIndex
        const sourceColumn = sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex] : null
        const targetColumn = targetColumnIndex !== -1 ? props.columns[targetColumnIndex] : null
        const senderLabel = sourceColumn?.display_name || 'Sender'
        const receiverLabel = targetColumn?.display_name || 'Receiver'
        const chartWidth = props.width || 600
        const buttonX = chartWidth - 32
        const buttonY = 45 // Right under the recenter button (10 + 30 + 5)
        const buttonSize = 30
        const dropdownWidth = 140
        const dropdownItemHeight = 28
        const dropdownY = buttonY + buttonSize + 5

        // Render function for filter dropdown content
        const renderFilterDropdownContent = () => {
          const filterOptions = [
            {
              key: 'senders',
              label: `${senderLabel}s`,
              isSelected: showSenders,
              onClick: () => setShowSenders(!showSenders),
            },
            {
              key: 'receivers',
              label: `${receiverLabel}s`,
              isSelected: showReceivers,
              onClick: () => setShowReceivers(!showReceivers),
            },
            {
              key: 'both',
              label: 'Both',
              isSelected: showBoth,
              onClick: () => setShowBoth(!showBoth),
            },
          ]

          return (
            <div className='filter-dropdown-popover-content'>
              <div
                className='filter-dropdown-container'
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                {filterOptions.map((option) => (
                  <div
                    key={option.key}
                    className={`filter-dropdown-item ${option.isSelected ? 'filter-dropdown-item-selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      option.onClick()
                    }}
                  >
                    <span className='filter-dropdown-item-check'>{option.isSelected ? '✓' : ' '}</span>
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
          <g className='node-filter-button'>
            <Popover
              isOpen={showFilterDropdown}
              content={renderFilterDropdownContent}
              onClickOutside={() => {
                setShowFilterDropdown(false)
              }}
              parentElement={props.popoverParentElement}
              boundaryElement={props.popoverParentElement}
              positions={['left']}
              align='center'
              padding={5}
            >
              <g className='filter-button' transform={`translate(${buttonX}, ${buttonY})`}>
                <rect
                  className='filter-button-rect'
                  width={buttonSize}
                  height={buttonSize}
                  rx='4'
                  strokeWidth='1'
                  opacity={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFilterDropdown(!showFilterDropdown)
                    setShowSourceDropdown(false) // Close source dropdown when opening filter
                    setShowTargetDropdown(false) // Close target dropdown when opening filter
                  }}
                  data-tooltip-id={props.chartTooltipID}
                  data-tooltip-html='Filter nodes'
                />
                <g transform='translate(5, 5)'>
                  <MdFilterList className='filter-button-icon' size={20} style={{ opacity: 0 }} />
                </g>
              </g>
            </Popover>
          </g>
        )
      })()}
      {/* Source and Target column selection buttons */}
      {(() => {
        const chartWidth = props.width || 600
        const buttonX = chartWidth - 32
        const sourceButtonY = 80 // Right under the filter button (45 + 30 + 5)
        const targetButtonY = 115 // Right under the source button (80 + 30 + 5)
        const buttonSize = 30

        return (
          <ColumnSelector
            columns={props.columns}
            selectedSourceColumnIndex={selectedSourceColumnIndex}
            selectedTargetColumnIndex={selectedTargetColumnIndex}
            setSelectedSourceColumnIndex={setSelectedSourceColumnIndex}
            setSelectedTargetColumnIndex={setSelectedTargetColumnIndex}
            showSourceDropdown={showSourceDropdown}
            showTargetDropdown={showTargetDropdown}
            setShowSourceDropdown={setShowSourceDropdown}
            setShowTargetDropdown={setShowTargetDropdown}
            setShowFilterDropdown={setShowFilterDropdown}
            popoverParentElement={props.popoverParentElement}
            chartTooltipID={props.chartTooltipID}
            buttonX={buttonX}
            sourceButtonY={sourceButtonY}
            targetButtonY={targetButtonY}
            buttonSize={buttonSize}
          />
        )
      })()}
      {/* Separate tooltip IDs for nodes and links to avoid conflicts with float prop */}
      <Tooltip tooltipId={`${props.chartTooltipID}-links`} float={true} />
    </g>
  )
})

ChataNetworkGraph.displayName = 'ChataNetworkGraph'

ChataNetworkGraph.propTypes = {
  ...chartPropTypes,
  data: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
}

ChataNetworkGraph.defaultProps = {
  ...chartDefaultProps,
  height: 400,
  width: 600,
}

export default ChataNetworkGraph
