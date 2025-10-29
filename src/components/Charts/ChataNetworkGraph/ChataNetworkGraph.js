import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { drag } from 'd3-drag'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { zoom, zoomIdentity } from 'd3-zoom'
import _cloneDeep from 'lodash.clonedeep'

import { deepEqual, getTooltipContent, DisplayTypes, findNetworkColumns } from 'autoql-fe-utils'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'
import './ChataNetworkGraph.scss'

const ChataNetworkGraph = forwardRef((props, forwardedRef) => {
  const chartRef = useRef()
  const simulationRef = useRef()

  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])
  const [simulation, setSimulation] = useState(null)

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
    const baseRadius = 8
    const connectionMultiplier = Math.min(d.connections / 5, 3)
    return baseRadius + connectionMultiplier * 2
  }, [])

  const getNodeColor = useCallback((d) => {
    // Nodes that are both sender and receiver get a unique color
    if (d.isSender && d.isReceiver) return '#9b59b6' // Purple for both sender and receiver
    if (d.isAirdrop) return '#ff6b6b' // Red for airdrop (receiver only)
    if (d.isSender) return '#4ecdc4' // Teal for sender only
    return '#45b7d1' // Blue for other nodes
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

  // Drag event handlers (matching sample script)
  const dragstarted = useCallback((event, d) => {
    // Disable dynamic zooming when user starts dragging
    if (window.userInteracting !== undefined) {
      window.userInteracting = true
      window.initialZooming = false
    }

    if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }, [])

  const dragged = useCallback((event, d) => {
    d.fx = event.x
    d.fy = event.y
  }, [])

  const dragended = useCallback((event, d) => {
    if (!event.active) simulationRef.current?.alphaTarget(0)
    // Keep position fixed where user dropped it (like sample script)
    // d.fx = null
    // d.fy = null
  }, [])

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
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999')
        .style('stroke', 'none')

      // Add zoom behavior
      const zoomBehavior = zoom()
        .scaleExtent([0.01, 8]) // Allow zooming out much further to see all networks
        .filter((event) => {
          // Only allow zoom on wheel events, not click/drag events
          return event.type === 'wheel'
        })
        .on('zoom', (event) => {
          // Disable dynamic zooming when user starts interacting
          userInteracting = true
          initialZooming = false
          window.userInteracting = true
          window.initialZooming = false

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

      // Create simulation matching sample script parameters
      const simulation = forceSimulation(nodes)
        .force(
          'link',
          forceLink(links)
            .id((d) => d.id)
            .distance(100), // Same as sample script
        )
        .force('charge', forceManyBody().strength(-300)) // Same as sample script
        .force('center', forceCenter(centerX, centerY))
        .force(
          'collision',
          forceCollide().radius((d) => getNodeRadius(d) * 1.2), // Same as sample script
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
        .attr('marker-end', 'url(#arrowhead)')
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', (d) => {
          // Create a tooltip for network edges with relationship information
          const { sourceColumnIndex, targetColumnIndex, weightColumnIndex } = findNetworkColumns(props.columns)
          const sourceColName =
            sourceColumnIndex !== -1
              ? props.columns[sourceColumnIndex]?.name || props.columns[sourceColumnIndex]?.display_name || 'Source'
              : 'Source'
          const targetColName =
            targetColumnIndex !== -1
              ? props.columns[targetColumnIndex]?.name || props.columns[targetColumnIndex]?.display_name || 'Target'
              : 'Target'
          const weightColName =
            weightColumnIndex !== -1
              ? props.columns[weightColumnIndex]?.name || props.columns[weightColumnIndex]?.display_name || 'Weight'
              : 'Weight'

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
        .attr('data-tooltip-id', props.chartTooltipID)
        .attr('data-tooltip-html', (d) => {
          // Create a tooltip for network nodes with node-specific information
          let nodeType = 'Standard Node'
          if (d.isSender && d.isReceiver) {
            nodeType = 'Sender & Receiver Node'
          } else if (d.isSender) {
            nodeType = 'Sender Node'
          } else if (d.isReceiver) {
            nodeType = 'Receiver Node'
          }

          return `
             <div>
               <strong>${d.name}</strong><br/>
               <br/>
               <strong>Node Type:</strong><br/>
               ${nodeType}<br/>
               <br/>
               <strong>Roles:</strong><br/>
               ${d.isSender ? '✓ Sender' : '✗ Sender'}<br/>
               ${d.isReceiver ? '✓ Receiver' : '✗ Receiver'}<br/>
               <br/>
               <strong>Network Stats:</strong><br/>
               Total Connections: ${d.connections}<br/>
               Node ID: ${d.id}
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
        .call(
          drag()
            .on('start', (event) => {
              background.style('cursor', 'grabbing')
            })
            .on('drag', (event) => {
              const transform = container.attr('transform') || 'translate(0,0) scale(1)'
              const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/)
              const scaleMatch = transform.match(/scale\(([^)]+)\)/)

              const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0
              const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0
              const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1

              // Apply pan while preserving existing scale
              const newTransform = `translate(${currentX + event.dx},${currentY + event.dy}) scale(${currentScale})`
              container.attr('transform', newTransform)

              // Update zoom behavior's transform state to prevent jumps
              // Update the zoom behavior's internal state using the correct D3 API
              // Use the correct D3 zoom transform API
              // Create a proper D3 zoom transform object
              const zoomTransform = zoomIdentity.translate(currentX + event.dx, currentY + event.dy).scale(currentScale)
              svg.call(zoomBehavior.transform, zoomTransform)
            })
            .on('end', () => {
              background.style('cursor', 'grab')
            }),
        )

      // Update positions on simulation tick with dynamic zooming
      let initialZooming = true
      let userInteracting = false

      // Make variables accessible to drag handlers
      window.initialZooming = initialZooming
      window.userInteracting = userInteracting

      simulation.on('tick', () => {
        link
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y)

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
          const scale = Math.min(
            (chartWidth - padding) / nodeSpread,
            (chartHeight - padding) / nodeSpread,
            1, // Don't zoom in beyond 1x
          )

          // Apply zoom if nodes are spreading out of view
          if (scale < 0.8) {
            const centerX = (bounds.xMin + bounds.xMax) / 2
            const centerY = (bounds.yMin + bounds.yMax) / 2
            const translateX = chartWidth / 2 - centerX * scale
            const translateY = chartHeight / 2 - centerY * scale

            // Preserve the initial deltaX and deltaY offsets
            const finalTranslateX = translateX + (deltaX || 0)
            const finalTranslateY = translateY + (deltaY || 0)

            container.attr('transform', `translate(${finalTranslateX}, ${finalTranslateY}) scale(${scale})`)
          }
        }

        // Stop dynamic zooming when simulation settles
        if (simulation.alpha() < 0.1) {
          initialZooming = false
          window.initialZooming = false

          // Update zoom behavior's state to match the final dynamic zooming state
          const currentTransform = container.attr('transform') || 'translate(0,0) scale(1)'
          const translateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/)
          const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/)

          if (translateMatch && scaleMatch) {
            const currentX = parseFloat(translateMatch[1])
            const currentY = parseFloat(translateMatch[2])
            const currentScale = parseFloat(scaleMatch[1])

            const finalZoomTransform = zoomIdentity.translate(currentX, currentY).scale(currentScale)
            svg.call(zoomBehavior.transform, finalZoomTransform)
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
        width={props.width}
        height={props.height}
        style={{
          background: 'var(--react-autoql-background-color-secondary, #f9f9f9)',
        }}
      />
      {/* Recenter button */}
      <button
        onClick={recenter}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
          backgroundColor: 'var(--react-autoql-background-color, #ffffff)',
          border: '1px solid var(--react-autoql-border-color, #ddd)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          color: 'var(--react-autoql-text-color, #333)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'var(--react-autoql-background-color-hover, #f5f5f5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'var(--react-autoql-background-color, #ffffff)'
        }}
      >
        🎯 Recenter
      </button>
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
