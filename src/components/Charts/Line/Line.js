import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { getThemeValue, getKey, getTooltipContent, getAutoQLConfig } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'
import { createSVGPath } from './lineFns'

export default class Line extends PureComponent {
  constructor(props) {
    super(props)

    // Curviness of the line, as a fraction of the gap between points. 1/3 is
    // the max a cubic can curve without swinging past its data points
    this.PATH_SMOOTHING = 1 / 3

    this.state = {
      activeKey: this.props.activeChartElementKey,
      hoveredKey: null,
      hoveredVertex: null, // { x, y, color } coordinates of hovered vertex
      hoveredLineColIndex: null, // colIndex of the line being hovered
      hoveredTooltip: null, // tooltip html for the currently hovered vertex
      activeVertex: null, // { x, y, color } coordinates of active (clicked) vertex
      previousHoveredLineColIndex: null, // Track previous line hover to prevent size flash
    }

    // Vertex lookup used by the chart-wide hover overlay, keyed by row index.
    // Rebuilt on every render in makeChartElements
    this.hoverPoints = []
  }

  static propTypes = {
    ...chartElementPropTypes,
    enableAreaHover: PropTypes.bool,
  }
  static defaultProps = {
    ...chartElementDefaultProps,
    enableAreaHover: false,
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    // Sync activeKey from props if it changed externally
    if (nextProps.activeChartElementKey !== prevState.activeKey) {
      return {
        activeKey: nextProps.activeChartElementKey,
        activeVertex: null, // Will be calculated in componentDidUpdate
      }
    }
    return null
  }

  calculateActiveVertex = () => {
    if (!this.state.activeKey) return
    
    const { columns, numberColumnIndices, stringColumnIndex, data, xScale, yScale, colorScale } = this.props
    
    for (const colIndex of numberColumnIndices) {
      if (columns[colIndex].isSeriesHidden) continue
      
      for (let index = 0; index < data.length; index++) {
        const d = data[index]
        const key = getKey(colIndex, index)
        
        if (key === this.state.activeKey) {
          const value = d[colIndex]
          if (value !== null && value !== undefined && value !== '') {
            const xShift = xScale.tickSize / 2
            const x = xScale.getValue(d[stringColumnIndex]) + xShift
            const y = yScale(value)
            const color = colorScale(colIndex)
            
            if (!isNaN(y)) {
              this.setState({ activeVertex: { x, y, color } })
              return
            }
          }
        }
      }
    }
  }

  componentDidMount() {
    // Calculate activeVertex on mount if activeKey is set from props
    this.calculateActiveVertex()
  }

  componentDidUpdate(prevProps, prevState) {
    // Recalculate activeVertex when:
    // 1. activeKey exists but activeVertex is not set
    // 2. activeKey changed
    // 3. Scales changed (chart was resized, e.g., in drilldown modal)
    const scalesChanged = 
      prevProps.xScale !== this.props.xScale ||
      prevProps.yScale !== this.props.yScale ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height
    
    if (this.state.activeKey && (!this.state.activeVertex || this.state.activeKey !== prevState.activeKey || scalesChanged)) {
      this.calculateActiveVertex()
    }
  }

  componentWillUnmount() {
    clearTimeout(this.hoverFadeTimeout)
  }

  onDotClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)
    const { columns, stringColumnIndex, dataFormatting, xScale, yScale, colorScale } = this.props

    // Calculate vertex coordinates for the active dot
    const xShift = xScale.tickSize / 2
    const x = xScale.getValue(row[stringColumnIndex]) + xShift
    const y = yScale(row[colIndex])
    const color = colorScale(colIndex)

    // Create date drilldown filter if string axis is a DATE column
    const stringColumn = columns[stringColumnIndex]
    const filter = createDateDrilldownFilter({
      stringColumn,
      dateValue: row[stringColumnIndex],
      dataFormatting,
    })

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns,
      stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
      filter, // Pass filter if date column, otherwise let QueryOutput construct it
    })

    this.setState({ 
      activeKey: newActiveKey,
      activeVertex: { x, y, color }
    })
  }

  // Hovering anywhere in the plot area (instead of directly over a vertex) is only
  // safe when the line is the only interactive layer. In the column+line combo chart
  // a full size overlay would swallow the column hover/click events
  isAreaHoverEnabled = () => !!this.props.enableAreaHover

  // Convert a mouse event to coordinates in the chart's user space
  getLocalCoords = (e) => {
    const element = e.currentTarget

    try {
      const svg = element.ownerSVGElement
      const ctm = element.getScreenCTM?.()
      if (svg?.createSVGPoint && ctm) {
        const point = svg.createSVGPoint()
        point.x = e.clientX
        point.y = e.clientY
        const { x, y } = point.matrixTransform(ctm.inverse())
        return { x, y }
      }
    } catch (error) {
      // Fall through to the bounding box approximation below
    }

    const bbox = element.getBoundingClientRect?.()
    if (!bbox?.width || !bbox?.height) {
      return null
    }

    const area = this.getHoverAreaBounds()
    if (!area) {
      return null
    }

    return {
      x: area.x + ((e.clientX - bbox.left) * area.width) / bbox.width,
      y: area.y + ((e.clientY - bbox.top) * area.height) / bbox.height,
    }
  }

  getHoverAreaBounds = () => {
    const { xScale, yScale } = this.props

    const xRange = xScale?.range?.()
    const yRange = yScale?.range?.()
    if (!xRange?.length || !yRange?.length) {
      return null
    }

    const x = Math.min(xRange[0], xRange[1])
    const x2 = Math.max(xRange[0], xRange[1])
    const y = Math.min(yRange[0], yRange[1])
    const y2 = Math.max(yRange[0], yRange[1])

    if (x2 - x <= 0 || y2 - y <= 0) {
      return null
    }

    return { x, y, width: x2 - x, height: y2 - y }
  }

  // Closest vertex to the cursor: snap to the nearest x position first, then
  // pick the series whose value is closest vertically at that position
  getClosestPoint = (coords) => {
    if (!coords || !this.hoverPoints?.length) {
      return null
    }

    let closestColumn = this.hoverPoints[0]
    for (let i = 1; i < this.hoverPoints.length; i++) {
      if (Math.abs(this.hoverPoints[i].x - coords.x) < Math.abs(closestColumn.x - coords.x)) {
        closestColumn = this.hoverPoints[i]
      } else if (this.hoverPoints[i].x > coords.x) {
        // Points are sorted by x, so nothing further right can be closer
        break
      }
    }

    let closestPoint = closestColumn.points[0]
    closestColumn.points.forEach((point) => {
      if (Math.abs(point.y - coords.y) < Math.abs(closestPoint.y - coords.y)) {
        closestPoint = point
      }
    })

    return closestPoint
  }

  onHoverAreaMouseMove = (e) => {
    const point = this.getClosestPoint(this.getLocalCoords(e))

    if (!point) {
      return
    }

    if (point.key === this.state.hoveredKey) {
      return
    }

    this.setState({
      hoveredKey: point.key,
      hoveredVertex: { x: point.x, y: point.y, color: point.color },
      hoveredLineColIndex: point.colIndex,
      previousHoveredLineColIndex: point.colIndex,
      hoveredTooltip: point.tooltip,
    })
  }

  onHoverAreaMouseLeave = () => {
    this.setState({
      hoveredKey: null,
      hoveredVertex: null,
      hoveredLineColIndex: null,
      hoveredTooltip: null,
    })

    // Clear previous after a short delay to allow fade-out
    clearTimeout(this.hoverFadeTimeout)
    this.hoverFadeTimeout = setTimeout(() => {
      this.setState({ previousHoveredLineColIndex: null })
    }, 150)
  }

  onHoverAreaClick = (e) => {
    const point = this.getClosestPoint(this.getLocalCoords(e))

    if (!point) {
      return
    }

    this.onDotClick(point.row, point.colIndex, point.rowIndex)
  }

  renderHoverArea = () => {
    const area = this.getHoverAreaBounds()
    if (!area) {
      return null
    }

    return (
      <rect
        className='line-chart-hover-area'
        x={area.x}
        y={area.y}
        width={area.width}
        height={area.height}
        fill='transparent'
        stroke='none'
        style={{ cursor: getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? 'pointer' : 'default' }}
        onMouseMove={this.onHoverAreaMouseMove}
        onMouseLeave={this.onHoverAreaMouseLeave}
        onClick={this.onHoverAreaClick}
        data-tooltip-id={this.props.chartTooltipID}
        data-tooltip-html={this.state.hoveredTooltip ?? undefined}
        data-tooltip-hidden={this.state.hoveredTooltip ? 'false' : 'true'}
        data-tooltip-float='true'
      />
    )
  }

  makeChartElements = () => {
    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, yScale, xScale, colorScale } = this.props
    const backgroundColor = getThemeValue('background-color-secondary')

    const largeDataset = this.props.width / this.props.data?.length < 10
    const areaHover = this.isAreaHoverEnabled()

    const innerCircles = []
    const paths = []
    const gradientAreas = []
    const hoverLines = []

    // Vertices grouped by row index so the hover overlay can snap to the
    // nearest x position, then the nearest series at that position
    const hoverPointsByIndex = new Map()

    // Get visible series for gradient fill (now supports multi-series)
    const visibleSeries = numberColumnIndices.filter((colIndex) => !columns[colIndex]?.isSeriesHidden)
    
    // Get bottom of chart for hover line (yScale domain[0] is the minimum value, which maps to bottom)
    const bottomY = yScale(yScale.domain()[0])


    numberColumnIndices.forEach((colIndex, i) => {
      let vertices = []
      let pathIndex = 0
      const color = this.props.colorScale(colIndex)
      if (!columns[colIndex].isSeriesHidden) {
        this.props.data.forEach((d, index) => {
          const value = d[colIndex]

          if (!value && value !== 0) {
            // Keep for future use: If value is missing (gap in data), end the
            // current line and start a new one after the data gap
            // const prevPath = createSVGPath(vertices, this.PATH_SMOOTHING)
            // const path = (
            //   <path
            //     key={`line-${getKey(0, i, pathIndex)}`}
            //     className='line'
            //     d={prevPath}
            //     fill='none'
            //     stroke={color}
            //     strokeWidth={2}
            //   />
            // )
            // paths.push(path)
            // vertices = []
            // pathIndex += 1

            return
          }

          // If band scale, we want to shift the vertex to the middle of the band
          const xShift = xScale.tickSize / 2
          const x = xScale.getValue(d[stringColumnIndex]) + xShift

          const y = yScale(value)

          if (isNaN(y)) {
            return
          }

          const xy = [x, y]
          vertices.push(xy)

          const tooltip = getTooltipContent({
            row: d,
            columns,
            colIndex,
            colIndex2: stringColumnIndex,
            legendColumn,
            dataFormatting,
            aggregated: this.props.isAggregated,
          })

          const key = getKey(colIndex, index)

          const pointsAtIndex = hoverPointsByIndex.get(index)
          const point = { key, colIndex, rowIndex: index, row: d, x, y, color, tooltip }
          if (pointsAtIndex) {
            pointsAtIndex.points.push(point)
          } else {
            hoverPointsByIndex.set(index, { x, points: [point] })
          }

          // Determine if this dot should be shown due to line hover
          // Line is hovered if: line path is hovered OR a vertex on this line is hovered
          const isLineHovered = this.state.hoveredLineColIndex === colIndex
          const isVertexHovered = this.state.hoveredKey === key
          const wasLineHovered = this.state.previousHoveredLineColIndex === colIndex
          
          // Use smaller radius for line hover, normal radius for vertex hover
          // Made dots slightly bigger: 1.8 for line hover, 3.0 for vertex hover
          // Keep radius at 1.8 if line was just hovered (to prevent flash during fade-out)
          const dotRadius = isVertexHovered ? 3.0 : (isLineHovered ? 1.8 : (wasLineHovered && !this.state.hoveredLineColIndex ? 1.8 : 2.5))
          const dotStrokeWidth = isVertexHovered ? 4.5 : (isLineHovered ? 2.5 : (wasLineHovered && !this.state.hoveredLineColIndex ? 2.5 : 4))
          
          const circle = (
            <circle
              className='line-dot-inner-circle'
              key={key}
              cx={x}
              cy={y}
              r={dotRadius}
              style={{
                pointerEvents: 'none',
                stroke: color,
                strokeWidth: dotStrokeWidth,
                paintOrder: 'stroke',
                color: color,
                opacity: 0, // Hide dots by default, CSS will show on hover
                fill: this.state.activeKey === key ? color : backgroundColor || '#fff',
              }}
            />
          )

          const dotClassName = `line-dot${this.state.activeKey === key ? ' active' : ''}${this.state.hoveredKey === key ? ' hovered' : ''}${isLineHovered ? ' line-hovered' : ''}${largeDataset ? ' hidden-dot' : ''}`

          if (areaHover) {
            // The chart-wide overlay handles hover, tooltip and click for every vertex
            innerCircles.push(
              <g className={dotClassName} key={`circle-group-${key}`} style={{ pointerEvents: 'none' }}>
                {circle}
              </g>,
            )
          } else {
            // Render a bigger transparent circle so it's easier for the user
            // to hover over and see tooltip
            const transparentHoverVertex = (
              <circle
                key={`hover-circle-${key}`}
                cx={x}
                cy={y}
                r={6}
                style={{
                  stroke: 'transparent',
                  fill: 'transparent',
                  cursor: getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? 'pointer' : 'default',
                }}
              />
            )

            innerCircles.push(
              <g
                className={dotClassName}
                key={`circle-group-${key}`}
                onClick={() => this.onDotClick(d, colIndex, index)}
                onMouseEnter={() => {
                  // When hovering over a vertex, show all dots for the line and highlight this vertex
                  this.setState({ hoveredKey: key, hoveredVertex: { x, y, color }, hoveredLineColIndex: colIndex })
                }}
                onMouseLeave={() => {
                  // When leaving vertex, clear both vertex and line hover
                  // The line path's onMouseEnter will restore hoveredLineColIndex if still over the line
                  this.setState({ hoveredKey: null, hoveredVertex: null, hoveredLineColIndex: null })
                }}
                data-tooltip-html={tooltip}
                data-tooltip-id={this.props.chartTooltipID}
              >
                {circle}
                {transparentHoverVertex}
              </g>,
            )
          }
        })
      }

      const d = createSVGPath(vertices, this.PATH_SMOOTHING)

      // Visible line path
      const path = (
        <path
          key={`line-${getKey(0, i, pathIndex)}`}
          className='line'
          d={d}
          fill='none'
          stroke={color}
          strokeWidth={2}
          style={{ pointerEvents: 'none' }}
        />
      )

      // Transparent hover overlay path for easier hovering
      // Not needed when the chart-wide overlay is active - it already snaps to the nearest line
      const hoverPath = areaHover ? null : (
        <path
          key={`line-hover-${getKey(0, i, pathIndex)}`}
          className='line-hover-overlay'
          d={d}
          fill='none'
          stroke='transparent'
          strokeWidth={20}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onMouseEnter={() => {
            // Set line hover - will be overridden if hovering over a vertex
            this.setState({ hoveredLineColIndex: colIndex, previousHoveredLineColIndex: colIndex })
          }}
          onMouseLeave={() => {
            // Clear line hover when leaving the line path, but keep previous for one frame to prevent flash
            this.setState({ hoveredLineColIndex: null })
            // Clear previous after a short delay to allow fade-out
            setTimeout(() => {
              this.setState({ previousHoveredLineColIndex: null })
            }, 150)
          }}
        />
      )

      paths.push(path)
      if (hoverPath) {
        paths.push(hoverPath)
      }

      // Add gradient area fill for all series (single and multi-series)
      if (vertices.length > 0) {
        // Get the bottom of the chart (yScale domain max - the minimum value)
        const bottomY = yScale(yScale.domain()[0])
        
        // Create area path: start from bottom-left, follow the smoothed line path, then close back
        const firstX = vertices[0][0]
        const firstY = vertices[0][1]
        const lastX = vertices[vertices.length - 1][0]
        
        // The path `d` contains the full smoothed line path like "M x,y C ..." or "M x,y L ..."
        // Extract everything after the initial "M x,y " command to get the curve/line commands
        // Split by spaces and skip first two tokens ("M" and coordinates), then rejoin
        const pathParts = d.trim().split(/\s+/)
        const linePathCommands = pathParts.length > 2 ? pathParts.slice(2).join(' ') : ''
        
        // Build area path: start at bottom-left, line to first vertex, follow line path, close
        const areaPath = `M${firstX},${bottomY} L${firstX},${firstY} ${linePathCommands} L${lastX},${bottomY} Z`
        
        const gradientId = `line-gradient-${colIndex}-${i}-${pathIndex}`
        
        gradientAreas.push(
          <g key={`gradient-area-${getKey(0, i, pathIndex)}`}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="50%" stopColor={color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              className='line-gradient-area'
              d={areaPath}
              fill={`url(#${gradientId})`}
              stroke='none'
            />
          </g>
        )
      }
    })

    // Sorted by x so the overlay can snap to the closest x position on mouse move
    this.hoverPoints = Array.from(hoverPointsByIndex.values()).sort((a, b) => a.x - b.x)

    // Add dashed vertical line for hovered vertex (render once, not per series)
    if (this.state.hoveredKey && this.state.hoveredVertex) {
      hoverLines.push(
        <line
          key={`hover-line-${this.state.hoveredKey}`}
          className='line-hover-indicator'
          x1={this.state.hoveredVertex.x}
          y1={this.state.hoveredVertex.y}
          x2={this.state.hoveredVertex.x}
          y2={bottomY}
          stroke={this.state.hoveredVertex.color}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
          pointerEvents="none"
        />
      )
    }

    // Add dashed vertical line for active (clicked) vertex
    if (this.state.activeKey && this.state.activeVertex) {
      hoverLines.push(
        <line
          key={`active-line-${this.state.activeKey}`}
          className='line-hover-indicator'
          x1={this.state.activeVertex.x}
          y1={this.state.activeVertex.y}
          x2={this.state.activeVertex.x}
          y2={bottomY}
          stroke={this.state.activeVertex.color}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
          pointerEvents="none"
        />
      )
    }

    return { paths, innerCircles, gradientAreas, hoverLines }
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const visibleSeries = this.props.numberColumnIndices.filter((colIndex) => {
      return !this.props.columns[colIndex]?.isSeriesHidden
    })

    const numVisibleSeries = visibleSeries?.length
    if (!numVisibleSeries) {
      return null
    }

    const { paths, innerCircles, gradientAreas, hoverLines } = this.makeChartElements()

    return (
      <g data-test='line'>
        {gradientAreas}
        {paths}
        {hoverLines}
        {innerCircles}
        {this.isAreaHoverEnabled() && this.renderHoverArea()}
      </g>
    )
  }
}
