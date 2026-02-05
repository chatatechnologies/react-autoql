import React, { PureComponent } from 'react'
import { getThemeValue, createSVGPath, getKey, getTooltipContent, getAutoQLConfig } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

export default class Line extends PureComponent {
  constructor(props) {
    super(props)

    this.PATH_SMOOTHING = 0.2

    this.state = {
      activeKey: this.props.activeChartElementKey,
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
                opacity: largeDataset ? 0 : 1,
                fill: this.state.activeKey === key ? color : backgroundColor || '#fff',
              }}
            />
          )

          innerCircles.push(
            <g
              className={`line-dot${this.state.activeKey === key ? ' active' : ''}${largeDataset ? ' hidden-dot' : ''}`}
              key={`circle-group-${key}`}
              onClick={() => this.onDotClick(d, colIndex, index)}
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
    })

    return { paths, innerCircles }
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

    const { paths, innerCircles } = this.makeChartElements()

    return (
      <g data-test='line'>
        {paths}
        {innerCircles}
      </g>
    )
  }
}
