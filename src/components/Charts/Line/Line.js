import React, { PureComponent } from 'react'
import { getThemeValue, createSVGPath, getKey, getTooltipContent, getAutoQLConfig } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

export default class Line extends PureComponent {
  constructor(props) {
    super(props)

    this.PATH_SMOOTHING = 0.2

    this.state = {
      activeKey: this.props.activeChartElementKey,
      hoveredKey: null,
      hoveredVertex: null, // { x, y } coordinates of hovered vertex
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  onDotClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)
    const { columns, stringColumnIndex, dataFormatting } = this.props

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

    this.setState({ activeKey: newActiveKey })
  }

  makeChartElements = () => {
    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, yScale, xScale } = this.props
    const backgroundColor = getThemeValue('background-color-secondary')

    const largeDataset = this.props.width / this.props.data?.length < 10

    const innerCircles = []
    const paths = []
    const gradientAreas = []
    const hoverLines = []

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
          const circle = (
            <circle
              className='line-dot-inner-circle'
              key={key}
              cx={x}
              cy={y}
              r={2.5}
              style={{
                pointerEvents: 'none',
                stroke: color,
                strokeWidth: 4,
                paintOrder: 'stroke',
                color: color,
                opacity: 0, // Hide dots by default, show on hover
                fill: this.state.activeKey === key ? color : backgroundColor || '#fff',
              }}
            />
          )

          innerCircles.push(
            <g
              className={`line-dot${this.state.activeKey === key ? ' active' : ''}${this.state.hoveredKey === key ? ' hovered' : ''}${largeDataset ? ' hidden-dot' : ''}`}
              key={`circle-group-${key}`}
              onClick={() => this.onDotClick(d, colIndex, index)}
              onMouseEnter={() => this.setState({ hoveredKey: key, hoveredVertex: { x, y, color } })}
              onMouseLeave={() => this.setState({ hoveredKey: null, hoveredVertex: null })}
              data-tooltip-html={tooltip}
              data-tooltip-id={this.props.chartTooltipID}
            >
              {circle}
              {transparentHoverVertex}
            </g>,
          )
        })
      }

      const d = createSVGPath(vertices, this.PATH_SMOOTHING)

      const path = (
        <path
          key={`line-${getKey(0, i, pathIndex)}`}
          className='line'
          d={d}
          fill='none'
          stroke={color}
          strokeWidth={2}
        />
      )

      paths.push(path)

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
      </g>
    )
  }
}
