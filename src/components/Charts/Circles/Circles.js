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

export default class Circles extends Component {
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

    this.radiusScale = scaleLinear()
      .domain([minValue, maxValue])
      .range([0, Math.min(props.xScale.bandwidth(), props.yScale.bandwidth())])
  }
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onCircleClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)

    this.props.onChartClick(
      row,
      colIndex,
      this.props.columns,
      this.props.stringColumnIndex,
      this.props.legendColumn,
      this.props.numberColumnIndex,
      newActiveKey
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

    const circles = []

    this.props.data.forEach((row, index) => {
      numberColumnIndices.forEach((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = row[colIndex]
          const valueNumber = Number(rawValue)
          const value = !Number.isNaN(valueNumber) ? valueNumber : 0

          const xLabel = row[stringColumnIndex]
          const yLabel = legendLabels[i].label

          const tooltip = getTooltipContent({
            row,
            columns,
            colIndex,
            stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          circles.push(
            <circle
              key={getKey(colIndex, index)}
              data-test="circles"
              className={`circle${
                this.state.activeKey === getKey(colIndex, index)
                  ? ' active'
                  : ''
              }`}
              cx={xScale(xLabel) + xScale.bandwidth() / 2}
              cy={yScale(yLabel) + yScale.bandwidth() / 2}
              r={value < 0 ? 0 : this.radiusScale(value) / 2}
              onClick={() => this.onCircleClick(row, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.tooltipID}
              style={{
                stroke: 'transparent',
                strokeWidth: 10,
                fill:
                  this.state.activeKey === getKey(colIndex, index)
                    ? colorScale(1)
                    : colorScale(0),
                fillOpacity: 0.7,
              }}
            />
          )
        }
      })
    })
    return <g>{circles}</g>
  }
}
