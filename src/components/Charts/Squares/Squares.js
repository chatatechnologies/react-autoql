import React, { Component } from 'react'
import { scaleLinear } from 'd3-scale'
import { max, min } from 'd3-array'
import _get from 'lodash.get'

import {
  chartElementDefaultProps,
  chartElementPropTypes,
  getTooltipContent,
  getKey,
} from '../helpers'

export default class Squares extends Component {
  constructor(props) {
    super(props)

    const maxValue = max(
      props.data.map((row) =>
        max(row.filter((value, i) => props.numberColumnIndices.includes(i)))
      )
    )

    const minValue = min(
      props.data.map((row) =>
        min(row.filter((value, i) => props.numberColumnIndices.includes(i)))
      )
    )

    this.opacityScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([0, 1])

    this.state = {
      activeKey: this.props.activeChartElementKey,
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  onSquareClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(this.KEY, rowIndex, colIndex)

    this.props.onChartClick(
      row,
      colIndex,
      this.props.columns,
      this.props.stringColumnIndex,
      this.props.legendColumn,
      this.props.numberColumnIndex
    )

    this.setState({ activeKey: newActiveKey })
  }

  render = () => {
    const {
      columns,
      legendColumn,
      numberColumnIndices,
      stringColumnIndex,
      dataFormatting,
      legendLabels,
      colorScale,
      yScale,
      xScale,
    } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const squares = []

    this.props.data.forEach((row, index) => {
      numberColumnIndices.forEach((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = row[colIndex]
          const valueNumber = Number(rawValue)
          const value = !Number.isNaN(valueNumber) ? valueNumber : 0

          const xLabel = row[stringColumnIndex]
          const yLabel = legendLabels[i].label

          const fillColor = value >= 0 ? colorScale(0) : 'rgba(221, 106, 106)'
          const activeFillColor = colorScale(1)

          const tooltip = getTooltipContent({
            row,
            columns,
            colIndex,
            stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          squares.push(
            <rect
              key={getKey(this.KEY, index, i)}
              data-test="squares"
              className={`square${
                this.state.activeKey === getKey(this.KEY, index, i)
                  ? ' active'
                  : ''
              }`}
              x={xScale(xLabel)}
              y={yScale(yLabel)}
              width={xScale.bandwidth()}
              height={yScale.bandwidth()}
              onClick={this.onSquareClick}
              data-tip={tooltip}
              data-for="chart-element-tooltip"
              stroke={activeFillColor}
              strokeWidth="2px"
              strokeOpacity={
                this.state.activeKey === getKey(this.KEY, index, i) ? 1 : 0
              }
              // chosen color for positive values and red for negative values
              fill={
                this.state.activeKey === getKey(this.KEY, index, i)
                  ? activeFillColor
                  : fillColor
              }
              fillOpacity={
                this.state.activeKey === getKey(this.KEY, index, i)
                  ? 1
                  : this.opacityScale(Math.abs(value))
              }
            />
          )
        }
      })
    })
    return <g>{squares}</g>
  }
}
