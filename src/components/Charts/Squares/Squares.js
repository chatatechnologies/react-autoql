import React, { Component } from 'react'
import { scaleLinear } from 'd3-scale'
import { max, min } from 'd3-array'
import { getChartColorVars } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, getTooltipContent, getKey } from '../helpers'

export default class Squares extends Component {
  constructor(props) {
    super(props)

    const maxValue = max(props.data.map((row) => max(row.filter((value, i) => props.numberColumnIndices.includes(i)))))
    const minValue = min(props.data.map((row) => min(row.filter((value, i) => props.numberColumnIndices.includes(i)))))

    this.opacityScale = scaleLinear().domain([minValue, maxValue]).range([0, 1])

    this.state = {
      activeKey: this.props.activeChartElementKey,
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  onSquareClick = (row, colIndex, rowIndex) => {
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

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const {
      columns,
      legendColumn,
      numberColumnIndices,
      stringColumnIndex,
      dataFormatting,
      legendLabels,
      yScale,
      xScale,
    } = this.props

    if (!numberColumnIndices.length) {
      return null
    }

    const squares = []

    this.props.data.forEach((row, index) => {
      numberColumnIndices.forEach((colIndex, i) => {
        const rawValue = row[colIndex]
        const valueNumber = Number(rawValue)
        const value = !isNaN(valueNumber) ? valueNumber : 0

        const xLabel = row[stringColumnIndex]
        const yLabel = legendLabels[i].label

        const { chartColors } = getChartColorVars()
        const color0 = chartColors[0]
        const color1 = chartColors[1]

        const fillColor = value >= 0 ? color0 : 'rgb(221, 106, 106)'
        const activeFillColor = color1

        const tooltip = getTooltipContent({
          row,
          columns,
          colIndex,
          colIndex2: stringColumnIndex,
          legendColumn,
          dataFormatting,
        })

        squares.push(
          <rect
            key={getKey(colIndex, index)}
            data-test='squares'
            className={`square${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
            x={xScale(xLabel)}
            y={yScale(yLabel)}
            width={xScale.bandwidth()}
            height={yScale.bandwidth()}
            onClick={() => this.onSquareClick(row, colIndex, index)}
            data-tooltip-content={tooltip}
            data-tooltip-id={this.props.chartTooltipID}
            style={{ color: activeFillColor }}
            fill={fillColor}
            fillOpacity={this.opacityScale(Math.abs(value))}
          />,
        )
      })
    })
    return <g>{squares}</g>
  }
}
