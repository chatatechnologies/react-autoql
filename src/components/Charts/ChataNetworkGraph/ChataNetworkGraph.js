import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { zoom, zoomIdentity } from 'd3-zoom'
import { MdOutlineFitScreen } from 'react-icons/md'

import { findNetworkColumns, formatElement, getAutoQLConfig } from 'autoql-fe-utils'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'
import './ChataNetworkGraph.scss'

const ChataNetworkGraph = forwardRef((props, forwardedRef) => {
  const chartRef = useRef()
  const simulationRef = useRef()
  const zoomBehaviorRef = useRef()
  const radiusScaleRef = useRef(() => 6)

  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])
  const [simulation, setSimulation] = useState(null)

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
          amountSent: 0,
          amountReceived: 0,
          isSender: false, // Will be updated based on actual data
          isAirdrop: false, // Will be updated based on actual data
        })
        connectionCounts.set(source, new Set())
      }

      // Add target node
      if (!nodeMap.has(target)) {
        nodeMap.set(target, {
          id: target,
          name: target,
          connections: 0,
          amountSent: 0,
          amountReceived: 0,
          isSender: false, // Will be updated based on actual data
          isAirdrop: false, // Will be updated based on actual data
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

      // Track amount sent/received per node
      nodeMap.get(source).amountSent += weight
      nodeMap.get(target).amountReceived += weight
    })

    // Set final connection counts and roles based on actual data
    nodeMap.forEach((node, nodeId) => {
      node.connections = connectionCounts.get(nodeId).size
      const roles = nodeRoles.get(nodeId)
      if (roles) {
        node.isSender = roles.isSender
        node.isReceiver = roles.isReceiver
        // A node is an "airdrop" if it's a receiver (gets tokens) but not a sender (doesn't send tokens)
        node.isAirdrop = roles.isReceiver && !roles.isSender
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

  const isSenderNode = useCallback((name) => {
    const senderKeywords = ['sender', 'from', 'origin', 'source']
    return senderKeywords.some((keyword) => name.toLowerCase().includes(keyword))
  }, [])

  const isAirdropNode = useCallback((name) => {
    const airdropKeywords = ['airdrop', 'reward', 'bonus', 'claim']
    return airdropKeywords.some((keyword) => name.toLowerCase().includes(keyword))
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
    if (d.isAirdrop) return '#28A745' // Green for airdrop (receiver only)
    if (d.isSender) return '#DC3545' // Red for sender only
    return '#28A745' // Green for other nodes (receivers)
  }, [])

  const getEdgeColor = useCallback((d) => {
    switch (d.edge_type) {
      case 'sender-to-sender':
        return '#ff9f43'
      case 'airdrop':
        return '#ff6b6b'
      default:
        return '#95a5a6'
    }
  }, [])

  const getEdgeWidth = useCallback((d) => {
    return d.weight_category === 'large' ? 1.5 : 0.8
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

    if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
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

          const totalSentTitle = weightColumn?.display_name || 'Total Sent'
          const senderLabel = sourceColumn?.display_name || 'Sender'
          const receiverLabel = targetColumn?.display_name || 'Receiver'

          node.attr(
            'data-tooltip-html',
            `
           <div>
             <strong>${d.name}</strong><br/>
             <br/>
             <strong>Roles:</strong><br/>
             ${d.isSender ? `✓ ${senderLabel}` : `✗ ${senderLabel}`}<br/>
             ${d.isReceiver ? `✓ ${receiverLabel}` : `✗ ${receiverLabel}`}<br/>
             <br/>
             <strong>Total ${totalSentTitle.toLowerCase()}:</strong><br/>
             ${formattedAmountSent}<br/>
             <br/>
             <strong>Network Stats:</strong><br/>
             Total Connections: ${d.connections}
           </div>
         `,
          )
        })
      svg
        .selectAll('.link')
        .attr('data-tooltip-id', props.chartTooltipID)
        .style('pointer-events', 'all')
        .each(function (d) {
          // Restore the tooltip HTML for links
          const link = select(this)
          const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(props.columns)
          const sourceColName =
            sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex]?.display_name || 'Source' : 'Source'
          const targetColName =
            targetColumnIndex !== -1 ? props.columns[targetColumnIndex]?.display_name || 'Target' : 'Target'
          const weightColName =
            weightColumnIndex !== -1 ? props.columns[weightColumnIndex]?.display_name || 'Weight' : 'Weight'

          link.attr(
            'data-tooltip-html',
            `
           <div>
             <strong>Connection</strong><br/>
             <br/>
             <strong>Relationship:</strong><br/>
             ${d.source.name} → ${d.target.name}<br/>
             <br/>
             <strong>Column Mapping:</strong><br/>
             ${sourceColName} → ${targetColName}<br/>
             <br/>
             <strong>Weight Details:</strong><br/>
             ${weightColName}: ${d.weight.toLocaleString()}<br/>
             Category: ${d.weight_category}<br/>
             Type: ${d.edge_type.replace(/_/g, ' ')}
           </div>
         `,
          )
        })
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
        .attr('fill', '#999')
        .style('stroke', 'none')

      // Add zoom behavior
      let isProgrammaticZoom = false // Flag to track programmatic zoom updates
      let currentTransform = { x: deltaX || 0, y: deltaY || 0, k: 1.0 } // Track current transform for smooth interpolation
      const zoomBehavior = zoom()

      // Store zoom behavior reference for recenter function
      zoomBehaviorRef.current = zoomBehavior
        .scaleExtent([0.01, 8]) // Allow zooming out much further to see all networks
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
        .force(
          'link',
          forceLink(links)
            .id((d) => d.id)
            .distance(100),
        )
        .force('charge', forceManyBody().strength(-300))
        .force('center', forceCenter(centerX, centerY))
        .force(
          'collision',
          forceCollide().radius((d) => getNodeRadius(d) * 1.2),
        )
        .force('boundary', createBoundaryForce(chartWidth, chartHeight))

      simulationRef.current = simulation
      setSimulation(simulation)

      // Create links
      const linkGroup = container.append('g').attr('class', 'links')

      const link = linkGroup
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', (d) => `link ${d.edge_type}`)
        .style('stroke', (d) => getEdgeColor(d))
        .style('stroke-width', (d) => getEdgeWidth(d))
        .style('outline', 'none')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .attr('marker-end', 'url(#arrowhead)')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', (d) => {
          // Create a tooltip for network edges with relationship information
          const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(props.columns)
          const sourceColName =
            sourceColumnIndex !== -1 ? props.columns[sourceColumnIndex]?.display_name || 'Source' : 'Source'
          const targetColName =
            targetColumnIndex !== -1 ? props.columns[targetColumnIndex]?.display_name || 'Target' : 'Target'
          const weightColName =
            weightColumnIndex !== -1 ? props.columns[weightColumnIndex]?.display_name || 'Weight' : 'Weight'

          return `
           <div>
             <strong>Connection</strong><br/>
             <br/>
             <strong>Relationship:</strong><br/>
             ${d.source.name} → ${d.target.name}<br/>
             <br/>
             <strong>Column Mapping:</strong><br/>
             ${sourceColName} → ${targetColName}<br/>
             <br/>
             <strong>Weight Details:</strong><br/>
             ${weightColName}: ${d.weight.toLocaleString()}<br/>
             Category: ${d.weight_category}<br/>
             Type: ${d.edge_type.replace(/_/g, ' ')}
           </div>
         `
        })

      // Create nodes
      const nodeGroup = container.append('g').attr('class', 'nodes')

      const node = nodeGroup
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', (d) => getNodeRadius(d))
        .style('fill', (d) => getNodeColor(d))
        .style('stroke', '#fff')
        .style('stroke-width', '1.5px')
        .style('cursor', 'move')
        .style('outline', 'none')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', (d) => {
          // Create a tooltip for network nodes with node-specific information

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

          const totalSentTitle = weightColumn?.display_name || 'Total Sent'
          const senderLabel = sourceColumn?.display_name || 'Sender'
          const receiverLabel = targetColumn?.display_name || 'Receiver'

          return `
             <div>
               <strong>${d.name}</strong><br/>
               <br/>
               <strong>Roles:</strong><br/>
               ${d.isSender ? `✓ ${senderLabel}` : `✗ ${senderLabel}`}<br/>
               ${d.isReceiver ? `✓ ${receiverLabel}` : `✗ ${receiverLabel}`}<br/>
               <br/>
               <strong>${totalSentTitle}:</strong><br/>
               ${formattedAmountSent}<br/>
               <br/>
               <strong>Network Stats:</strong><br/>
               Total Connections: ${d.connections}
             </div>
           `
        })
        .call(drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))

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

      simulation.on('tick', () => {
        link
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

        node.attr('cx', (d) => d.x).attr('cy', (d) => d.y)

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
      })
    })
  }, [
    props,
    nodes,
    links,
    getNodeRadius,
    getNodeColor,
    getEdgeColor,
    getEdgeWidth,
    dragstarted,
    dragged,
    dragended,
    calculateInitialScale,
    createBoundaryForce,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyVisualization()
    }
  }, [destroyVisualization])

  // Render - create our own SVG inside the g container
  return (
    <g className='react-autoql-network-viz'>
      <svg
        ref={chartRef}
        width={props.width || 600}
        height={props.height || 400}
        viewBox={`0 0 ${props.width || 600} ${props.height || 400}`}
        style={{
          background: 'var(--react-autoql-background-color-secondary, #f9f9f9)',
        }}
      />
      {/* Recenter button as SVG element */}
      <g
        onClick={recenter}
        style={{ cursor: 'pointer', outline: 'none' }}
        className='recenter-button'
        transform={`translate(${(props.width || 600) - 50}, 10)`}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.querySelector('rect')
          const icon = e.currentTarget.querySelector('g')
          if (rect) {
            rect.setAttribute('stroke', 'var(--react-autoql-accent-color, #007bff)')
          }
          if (icon) {
            icon.setAttribute('fill', 'var(--react-autoql-accent-color, #007bff)')
            // Also set the color on the SVG element inside
            const svgIcon = icon.querySelector('svg')
            if (svgIcon) {
              svgIcon.style.color = 'var(--react-autoql-accent-color, #007bff)'
            }
          }
        }}
        onMouseLeave={(e) => {
          const rect = e.currentTarget.querySelector('rect')
          const icon = e.currentTarget.querySelector('g')
          if (rect) {
            rect.setAttribute('stroke', 'var(--react-autoql-border-color, #ddd)')
          }
          if (icon) {
            icon.setAttribute('fill', 'var(--react-autoql-text-color, #333)')
            // Also reset the color on the SVG element inside
            const svgIcon = icon.querySelector('svg')
            if (svgIcon) {
              svgIcon.style.color = 'var(--react-autoql-text-color, #333)'
            }
          }
        }}
        data-tooltip-id={props.chartTooltipID}
        data-tooltip-html='Fit to screen'
      >
        <rect
          width='30'
          height='30'
          rx='4'
          fill='var(--react-autoql-background-color-secondary, #f8f9fa)'
          stroke='var(--react-autoql-border-color, #ddd)'
          strokeWidth='1'
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            transition: 'all 0.2s ease',
          }}
        />
        <g
          transform='translate(5, 5)'
          fill='var(--react-autoql-text-color, #333)'
          style={{ transition: 'all 0.2s ease' }}
        >
          <MdOutlineFitScreen size={20} />
        </g>
      </g>
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
