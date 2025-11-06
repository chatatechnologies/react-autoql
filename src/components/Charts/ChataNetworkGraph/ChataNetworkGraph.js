import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { zoom, zoomIdentity } from 'd3-zoom'
import { MdOutlineFitScreen, MdFilterList } from 'react-icons/md'

import { findNetworkColumns, formatElement, getAutoQLConfig } from 'autoql-fe-utils'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'

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
      const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(props.columns)
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
    [props.columns, props.dataFormatting, props.autoQLConfig],
  )

  // Generate tooltip HTML for network nodes
  const generateNodeTooltipHTML = useCallback(
    (d) => {
      // Get column info for proper formatting and labels
      const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(props.columns)
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
         <strong>${d.name}</strong><br/>
         <br/>
         <strong>Roles:</strong><br/>
         ${d.isSender ? `✓ ${senderLabel}` : `✗ ${senderLabel}`}<br/>
         ${d.isReceiver ? `✓ ${receiverLabel}` : `✗ ${receiverLabel}`}<br/>
         <br/>
      `

      // Add amount sent if node is a sender
      if (d.isSender && d.amountSent > 0) {
        tooltipContent += `<strong>Total ${weightColumnName} (${senderColumnName}):</strong><br/>
         ${formattedAmountSent}<br/>
         <br/>`
      }

      // Add amount received if node is a receiver
      if (d.isReceiver && d.amountReceived > 0) {
        tooltipContent += `<strong>Total ${weightColumnName} (${receiverColumnName}):</strong><br/>
         ${formattedAmountReceived}<br/>
         <br/>`
      }

      tooltipContent += `<strong>Network Stats:</strong><br/>
         Unique Connections: ${d.connections}<br/>
         Total Records: ${d.totalTransfers || 0}
       </div>
     `

      return tooltipContent
    },
    [props.columns, props.dataFormatting, props.autoQLConfig],
  )

  // Process network data from tabular data
  const processNetworkData = useCallback((data, columns) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { nodes: [], links: [] }
    }

    const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(columns) // Using autoql-fe-utils

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

      // Add source node
      if (!nodeMap.has(source)) {
        nodeMap.set(source, {
          id: source,
          name: source,
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
        linkMap.set(edgeKey, {
          source,
          target,
          weight,
          count: 1,
          weight_category: getWeightCategory(weight),
          edge_type: getEdgeType(source, target, nodeMap.get(source), nodeMap.get(target)),
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
    // Nodes that are both sender and receiver get blue color
    if (d.isSender && d.isReceiver) return '#28A8E0' // Blue for both sender and receiver
    if (d.isSender) return '#DC3545' // Red for sender only
    return '#28A745' // Green for other nodes (receivers)
  }, [])

  // Drag event handlers
  const dragstarted = useCallback((event, d) => {
    // Disable dynamic zooming when user starts dragging
    if (window.userInteracting !== undefined) {
      window.userInteracting = true
      window.initialZooming = false
    }

    // Disable all tooltips during drag
    const svg = select(chartRef.current)
    svg
      .selectAll('[data-tooltip-id]')
      .attr('data-tooltip-id', null)
      .attr('data-tooltip-html', null)
      .style('pointer-events', 'none')

    if (!event.active) simulationRef.current?.alphaTarget(0.4).restart()
    d.fx = d.x
    d.fy = d.y
  }, [])

  const dragged = useCallback((event, d) => {
    d.fx = event.x
    d.fy = event.y
  }, [])

  const dragended = useCallback(
    (event, d) => {
      if (!event.active) simulationRef.current?.alphaTarget(0)

      // Re-enable all tooltips after drag
      const svg = select(chartRef.current)
      svg
        .selectAll('.node')
        .attr('data-tooltip-id', props.chartTooltipID)
        .style('pointer-events', 'all')
        .each(function (d) {
          // Restore the tooltip HTML for nodes
          const node = select(this)

          node.attr('data-tooltip-html', generateNodeTooltipHTML(d))
        })
      svg
        .selectAll('.link')
        .attr('data-tooltip-id', props.chartTooltipID)
        .style('pointer-events', 'all')
        .each(function (d) {
          // Restore the tooltip HTML for links
          const link = select(this)
          link.attr('data-tooltip-html', generateLinkTooltipHTML(d))
        })

      // Mark user interaction complete so future auto-stop applies only to initial animation
      if (window.userInteracting !== undefined) {
        window.userInteracting = false
      }
    },
    [props.chartTooltipID],
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
    console.log('[ChataNetworkGraph] updateVisibility called', {
      showSenders,
      showReceivers,
      showBoth,
      hasNodeSelection: !!nodeSelectionRef.current,
      hasLinkSelection: !!linkSelectionRef.current,
    })
    if (!nodeSelectionRef.current || !linkSelectionRef.current) {
      console.log('[ChataNetworkGraph] updateVisibility: missing selections, returning')
      return
    }

    const visibleNodeIds = new Set()

    // Update node visibility
    nodeSelectionRef.current.each(function (d) {
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

    // Update link visibility
    linkSelectionRef.current.each(function (d) {
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
          // Allow both wheel and mouse events for zoom and pan
          return event.type === 'wheel' || event.type === 'mousedown' || event.type === 'mousemove'
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

      const linkSelection = linkGroup
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', (d) => `link ${d.edge_type}`)
        .style('stroke', (d) => 'var(--react-autoql-text-color-placeholder)')
        .style('stroke-width', (d) => d.originalStrokeWidth)
        .style('outline', 'none')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .attr('marker-end', 'url(#arrowhead)')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', generateLinkTooltipHTML)

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
        .style('cursor', 'move')
        .style('outline', 'none')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', generateNodeTooltipHTML)
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
        linkSelectionRef.current
          .attr('x1', (d) => {
            const sourceRadius = getNodeRadius(d.source)
            const dx = d.target.x - d.source.x
            const dy = d.target.y - d.source.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance === 0) return d.source.x
            const ratio = sourceRadius / distance
            return d.source.x + dx * ratio
          })
          .attr('y1', (d) => {
            const sourceRadius = getNodeRadius(d.source)
            const dx = d.target.x - d.source.x
            const dy = d.target.y - d.source.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance === 0) return d.source.y
            const ratio = sourceRadius / distance
            return d.source.y + dy * ratio
          })
          .attr('x2', (d) => {
            const targetRadius = getNodeRadius(d.target)
            const dx = d.source.x - d.target.x
            const dy = d.source.y - d.target.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance === 0) return d.target.x
            const ratio = targetRadius / distance
            return d.target.x + dx * ratio
          })
          .attr('y2', (d) => {
            const targetRadius = getNodeRadius(d.target)
            const dx = d.source.x - d.target.x
            const dy = d.source.y - d.target.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance === 0) return d.target.y
            const ratio = targetRadius / distance
            return d.target.y + dy * ratio
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

    const processedData = processNetworkData(data, columns)

    setNodes(processedData.nodes)
    setLinks(processedData.links)
  }, [props.data, props.columns, processNetworkData])

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
    console.log('[ChataNetworkGraph] Filter state changed', {
      showSenders,
      showReceivers,
      showBoth,
      hasNodeSelection: !!nodeSelectionRef.current,
      hasLinkSelection: !!linkSelectionRef.current,
    })
    if (nodeSelectionRef.current && linkSelectionRef.current) {
      updateVisibility()
    } else {
      console.log('[ChataNetworkGraph] Filter state changed but selections not ready')
    }
  }, [showSenders, showReceivers, showBoth, updateVisibility])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showFilterDropdown) return

    let mouseDownPos = null
    let mouseDownTarget = null

    const handleMouseDown = (event) => {
      console.log('[ChataNetworkGraph] handleMouseDown fired', { target: event.target, tagName: event.target.tagName })
      mouseDownPos = { x: event.clientX, y: event.clientY }
      mouseDownTarget = event.target
    }

    const handleMouseUp = (event) => {
      if (!mouseDownPos || !mouseDownTarget) {
        console.log('[ChataNetworkGraph] handleMouseUp: No mousedown data', { mouseDownPos, mouseDownTarget })
        return
      }

      // Check if this was a click (mouse moved less than 5px) vs a drag
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + Math.pow(event.clientY - mouseDownPos.y, 2),
      )
      console.log('[ChataNetworkGraph] handleMouseUp: Move distance', {
        moveDistance,
        target: event.target,
        mouseDownTarget,
      })
      if (moveDistance > 5) {
        // This was a drag, not a click
        console.log('[ChataNetworkGraph] handleMouseUp: Detected drag, ignoring')
        mouseDownPos = null
        mouseDownTarget = null
        return
      }

      const svgElement = chartRef.current
      if (!svgElement) {
        console.log('[ChataNetworkGraph] handleMouseUp: No SVG element')
        return
      }

      // Check if click is inside the SVG element
      const clickTarget = event.target
      const isInsideSVG = svgElement.contains(clickTarget) || svgElement === clickTarget
      console.log('[ChataNetworkGraph] handleMouseUp: Click check', {
        clickTarget,
        isInsideSVG,
        tagName: clickTarget.tagName,
        className: clickTarget.getAttribute?.('class'),
      })

      // Check if click is inside dropdown
      const checkElement = (el) => {
        if (!el) return false
        const className = el.getAttribute?.('class') || ''
        return (
          className.includes('filter-dropdown') ||
          className.includes('filter-dropdown-item-rect') ||
          className.includes('filter-dropdown-item-text') ||
          className.includes('filter-dropdown-background') ||
          className.includes('filter-button') ||
          className.includes('node-filter-button')
        )
      }

      let current = clickTarget
      let isInsideDropdown = false
      for (let i = 0; i < 10 && current; i++) {
        if (checkElement(current)) {
          isInsideDropdown = true
          console.log('[ChataNetworkGraph] handleMouseUp: Found dropdown element', {
            current,
            className: current.getAttribute?.('class'),
          })
          break
        }
        current = current.parentElement || current.parentNode
        if (current === svgElement) {
          break
        }
      }

      // Don't close if clicking inside dropdown or filter button
      if (isInsideDropdown) {
        console.log('[ChataNetworkGraph] handleMouseUp: Click inside dropdown, not closing')
        mouseDownPos = null
        mouseDownTarget = null
        return
      }

      // Close dropdown for any other click (inside SVG graph area or outside SVG)
      console.log('[ChataNetworkGraph] handleMouseUp: Closing dropdown')
      setShowFilterDropdown(false)
      mouseDownPos = null
      mouseDownTarget = null
    }

    const handleClick = (event) => {
      console.log('[ChataNetworkGraph] Document click handler fired', {
        target: event.target,
        tagName: event.target.tagName,
      })
      const svgElement = chartRef.current
      if (!svgElement) return

      const clickTarget = event.target
      const isInsideSVG = svgElement.contains(clickTarget) || svgElement === clickTarget

      // Check if click is inside dropdown
      const checkElement = (el) => {
        if (!el) return false
        const className = el.getAttribute?.('class') || ''
        return (
          className.includes('filter-dropdown') ||
          className.includes('filter-dropdown-item-rect') ||
          className.includes('filter-dropdown-item-text') ||
          className.includes('filter-dropdown-background') ||
          className.includes('filter-button') ||
          className.includes('node-filter-button')
        )
      }

      let current = clickTarget
      let isInsideDropdown = false
      for (let i = 0; i < 10 && current; i++) {
        if (checkElement(current)) {
          isInsideDropdown = true
          console.log('[ChataNetworkGraph] Document click: Found dropdown element', {
            current,
            className: current.getAttribute?.('class'),
          })
          break
        }
        current = current.parentElement || current.parentNode
        if (current === svgElement) {
          break
        }
      }

      if (!isInsideDropdown && isInsideSVG) {
        console.log('[ChataNetworkGraph] Document click: Closing dropdown')
        setShowFilterDropdown(false)
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
  }, [showFilterDropdown])

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
          console.log('[ChataNetworkGraph] SVG onClick fired', { target: e.target, tagName: e.target.tagName })
          const target = e.target
          const tagName = target.tagName?.toLowerCase()
          const className = target.getAttribute?.('class') || ''

          // Check if click is on a button or dropdown element
          const isButtonOrDropdown =
            className.includes('filter-dropdown') ||
            className.includes('filter-button') ||
            className.includes('node-filter-button') ||
            className.includes('recenter-button')

          console.log('[ChataNetworkGraph] SVG onClick: Check', { isButtonOrDropdown, tagName, className })

          // If clicking on graph elements (nodes, links, or SVG background) and not on buttons/dropdown, close dropdown
          if (
            !isButtonOrDropdown &&
            (target === chartRef.current ||
              target.tagName === 'svg' ||
              tagName === 'circle' ||
              tagName === 'line' ||
              tagName === 'g')
          ) {
            // Double-check by walking up the parent chain to make sure we're not inside a button/dropdown
            let current = target
            let isInsideButtonOrDropdown = false
            for (let i = 0; i < 10 && current; i++) {
              const currentClass = current.getAttribute?.('class') || ''
              if (
                currentClass.includes('filter-dropdown') ||
                currentClass.includes('filter-button') ||
                currentClass.includes('node-filter-button') ||
                currentClass.includes('recenter-button')
              ) {
                isInsideButtonOrDropdown = true
                console.log('[ChataNetworkGraph] SVG onClick: Found button/dropdown in parent chain', {
                  current,
                  currentClass,
                })
                break
              }
              current = current.parentElement || current.parentNode
              if (current === chartRef.current) {
                break
              }
            }

            if (!isInsideButtonOrDropdown) {
              console.log('[ChataNetworkGraph] SVG onClick: Closing dropdown')
              setShowFilterDropdown(false)
            } else {
              console.log('[ChataNetworkGraph] SVG onClick: Not closing, inside button/dropdown')
            }
          } else {
            console.log('[ChataNetworkGraph] SVG onClick: Not a graph element or is button/dropdown')
          }
        }}
      />
      {/* Recenter button as SVG element */}
      <g className='recenter-button' transform={`translate(${(props.width || 600) - 50}, 10)`}>
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
        const { sourceColumnIndex, targetColumnIndex } = findNetworkColumns(props.columns)
        const sourceColumn = sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex] : null
        const targetColumn = targetColumnIndex !== -1 ? props.columns[targetColumnIndex] : null
        const senderLabel = sourceColumn?.display_name || 'Sender'
        const receiverLabel = targetColumn?.display_name || 'Receiver'
        const chartWidth = props.width || 600
        const buttonX = chartWidth - 50
        const buttonY = 45 // Right under the recenter button (10 + 30 + 5)
        const buttonSize = 30
        const dropdownWidth = 140
        const dropdownItemHeight = 28
        const dropdownY = buttonY + buttonSize + 5

        return (
          <g className='node-filter-button'>
            {/* Filter button */}
            <g className='filter-button' transform={`translate(${buttonX}, ${buttonY})`}>
              <rect
                className='filter-button-rect'
                width={buttonSize}
                height={buttonSize}
                rx='4'
                strokeWidth='1'
                opacity={0}
                onClick={(e) => {
                  console.log('[ChataNetworkGraph] Filter button clicked', { showFilterDropdown, event: e })
                  e.stopPropagation()
                  setShowFilterDropdown(!showFilterDropdown)
                }}
                data-tooltip-id={props.chartTooltipID}
                data-tooltip-html='Filter nodes'
              />
              <g transform='translate(5, 5)'>
                <MdFilterList className='filter-button-icon' size={20} style={{ opacity: 0 }} />
              </g>
            </g>
            {/* Dropdown menu */}
            {showFilterDropdown && (
              <g
                className='filter-dropdown'
                transform={`translate(${buttonX - dropdownWidth + buttonSize}, ${dropdownY})`}
              >
                <rect
                  className='filter-dropdown-background'
                  width={dropdownWidth}
                  height={dropdownItemHeight * 3 + 8}
                  rx='4'
                  fill='var(--react-autoql-background-color-secondary)'
                  stroke='var(--react-autoql-border-color)'
                  strokeWidth='1'
                  opacity={0}
                  onClick={(e) => e.stopPropagation()}
                />
                {/* Senders option */}
                <g transform={`translate(4, 4)`}>
                  <rect
                    className={`filter-dropdown-item-rect ${showSenders ? 'filter-dropdown-item-selected' : ''}`}
                    width={dropdownWidth - 8}
                    height={dropdownItemHeight}
                    rx='2'
                    fill={showSenders ? 'var(--react-autoql-hover-color)' : 'transparent'}
                    opacity={0}
                    pointerEvents='all'
                    onMouseDown={(e) => {
                      console.log('[ChataNetworkGraph] Senders mousedown', { showSenders, event: e, target: e.target })
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      console.log('[ChataNetworkGraph] Senders clicked', { showSenders, event: e, target: e.target })
                      e.stopPropagation()
                      e.preventDefault()
                      setShowSenders(!showSenders)
                    }}
                  />
                  <text
                    className='filter-dropdown-item-text'
                    x={8}
                    y={dropdownItemHeight / 2}
                    dominantBaseline='middle'
                    fill='var(--react-autoql-text-color-primary)'
                    fontSize='12'
                    opacity={0}
                    pointerEvents='none'
                  >
                    <tspan x={8}>{showSenders ? '✓' : ' '}</tspan>
                    <tspan x={20}>{senderLabel}s</tspan>
                  </text>
                </g>
                {/* Receivers option */}
                <g transform={`translate(4, ${4 + dropdownItemHeight})`}>
                  <rect
                    className={`filter-dropdown-item-rect ${showReceivers ? 'filter-dropdown-item-selected' : ''}`}
                    width={dropdownWidth - 8}
                    height={dropdownItemHeight}
                    rx='2'
                    fill={showReceivers ? 'var(--react-autoql-hover-color)' : 'transparent'}
                    opacity={0}
                    pointerEvents='all'
                    onMouseDown={(e) => {
                      console.log('[ChataNetworkGraph] Receivers mousedown', {
                        showReceivers,
                        event: e,
                        target: e.target,
                      })
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      console.log('[ChataNetworkGraph] Receivers clicked', {
                        showReceivers,
                        event: e,
                        target: e.target,
                      })
                      e.stopPropagation()
                      e.preventDefault()
                      setShowReceivers(!showReceivers)
                    }}
                  />
                  <text
                    className='filter-dropdown-item-text'
                    x={8}
                    y={dropdownItemHeight / 2}
                    dominantBaseline='middle'
                    fill='var(--react-autoql-text-color-primary)'
                    fontSize='12'
                    opacity={0}
                    pointerEvents='none'
                  >
                    <tspan x={8}>{showReceivers ? '✓' : ' '}</tspan>
                    <tspan x={20}>{receiverLabel}s</tspan>
                  </text>
                </g>
                {/* Both option */}
                <g transform={`translate(4, ${4 + dropdownItemHeight * 2})`}>
                  <rect
                    className={`filter-dropdown-item-rect ${showBoth ? 'filter-dropdown-item-selected' : ''}`}
                    width={dropdownWidth - 8}
                    height={dropdownItemHeight}
                    rx='2'
                    fill={showBoth ? 'var(--react-autoql-hover-color)' : 'transparent'}
                    opacity={0}
                    pointerEvents='all'
                    onMouseDown={(e) => {
                      console.log('[ChataNetworkGraph] Both mousedown', { showBoth, event: e, target: e.target })
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      console.log('[ChataNetworkGraph] Both clicked', { showBoth, event: e, target: e.target })
                      e.stopPropagation()
                      e.preventDefault()
                      setShowBoth(!showBoth)
                    }}
                  />
                  <text
                    className='filter-dropdown-item-text'
                    x={8}
                    y={dropdownItemHeight / 2}
                    dominantBaseline='middle'
                    fill='var(--react-autoql-text-color-primary)'
                    fontSize='12'
                    opacity={0}
                    pointerEvents='none'
                  >
                    <tspan x={8}>{showBoth ? '✓' : ' '}</tspan>
                    <tspan x={20}>Both</tspan>
                  </text>
                </g>
              </g>
            )}
          </g>
        )
      })()}
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
