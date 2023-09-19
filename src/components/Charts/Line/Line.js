import React, { Component } from 'react'
import { getThemeValue } from 'autoql-fe-utils'
import { createSVGPath } from './lineFns'
import { chartElementDefaultProps, chartElementPropTypes, getKey, getTooltipContent } from '../helpers'

export default class Line extends Component {
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

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns: this.props.columns,
      stringColumnIndex: this.props.stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
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

          const minValue = yScale.domain()[0]
          const y = yScale(value || minValue)

          const xy = [x, y]
          vertices.push(xy)

          const tooltip = getTooltipContent({
            row: d,
            columns,
            colIndex,
            colIndex2: stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          if (isNaN(y)) {
            return
          }

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
                cursor: 'pointer',
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
              data-tooltip-content={tooltip}
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
