import React, { PureComponent } from 'react'
import { max, min } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { getChartColorVars, getTooltipContent, getKey } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class Squares extends PureComponent {
  constructor(props) {
    super(props)

    const maxValue = max(props.data.map((row) => max(row.filter((value, i) => props.numberColumnIndices.includes(i)))))
    const minValue = min(props.data.map((row) => min(row.filter((value, i) => props.numberColumnIndices.includes(i)))))

    if (minValue < 0 && maxValue < 0) {
      this.opacityScaleNegative = scaleLinear().domain([minValue, maxValue]).range([1, 0])
    } else if (minValue < 0) {
      this.opacityScalePositive = scaleLinear().domain([0, maxValue]).range([0, 1])
      this.opacityScaleNegative = scaleLinear().domain([minValue, 0]).range([1, 0])
    } else {
      this.opacityScalePositive = scaleLinear().domain([minValue, maxValue]).range([0, 1])
    }

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

        const fillColor = value >= 0 ? color0 : '#de3434'
        const activeFillColor = value >= 0 ? color1 : '#bb0606'

        const tooltip = getTooltipContent({
          row,
          columns,
          colIndex,
          colIndex2: stringColumnIndex,
          legendColumn,
          dataFormatting,
          aggregated: this.props.isAggregated,
        })

        // const square = getHeatmapRectObj({
        //   columns,
        //   yScale,
        //   xScale,
        //   activeKey: this.state.activeKey,
        //   dataFormatting,
        //   colIndex,
        //   colIndex2: stringColumnIndex,
        //   opacityScale: this.opacityScalePositive,
        //   opacityScale2: this.opacityScaleNegative,
        //   i,
        //   d: row,
        //   index,
        //   legendColumn,
        //   legendLabels,
        //   chartColors,
        //   columnIndexConfig: {
        //     stringColumnIndex,
        //   },
        // })

        // squares.push(square)

        let opacity = this.opacityScalePositive?.(Math.abs(value))
        if (this.opacityScaleNegative && value < 0) {
          opacity = this.opacityScaleNegative(value)
        }

        squares.push(
          <rect
            key={getKey(colIndex, index)}
            data-test='squares'
            className={`square${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
            x={xScale.getValue(xLabel)}
            y={yScale.getValue(yLabel)}
            width={xScale.bandwidth()}
            height={yScale.bandwidth()}
            onClick={() => this.onSquareClick(row, colIndex, index)}
            data-tooltip-html={tooltip}
            data-tooltip-id={this.props.chartTooltipID}
            style={{ color: activeFillColor }}
            fill={fillColor}
            fillOpacity={opacity}
          />,
        )
      })
    })
    return <g>{squares}</g>
  }
}
