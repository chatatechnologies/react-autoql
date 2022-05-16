import React, { Component } from 'react'
import _get from 'lodash.get'
import {
  chartElementDefaultProps,
  chartElementPropTypes,
  getTooltipContent,
  getKey,
} from '../helpers'

export default class StackedColumns extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeKey,
  }

  onColumnClick = (row, colIndex, rowIndex) => {
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
      yScale,
      xScale,
    } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const stackedColumns = this.props.data.map((d, index) => {
      let prevPosValue = 0
      let prevNegValue = 0
      const bars = numberColumnIndices.map((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = d[colIndex]
          const valueNumber = Number(rawValue)
          const value = !Number.isNaN(valueNumber) ? valueNumber : 0

          if (!value) {
            return null
          }

          let y
          let height

          if (value >= 0) {
            const nextPosValue = prevPosValue + value
            height = Math.abs(yScale(value) - yScale(0)) - 0.5
            y = yScale(nextPosValue) + 0.5
            prevPosValue = nextPosValue
          } else {
            const nextNegValue = prevNegValue + value
            height = Math.abs(yScale(value) - yScale(0)) - 0.5
            y = yScale(prevNegValue) + 0.5
            prevNegValue = nextNegValue
          }

          if (height < 0.05) {
            return null
          }

          const tooltip = getTooltipContent({
            row: d,
            columns,
            colIndex,
            stringColumnIndex,
            legendColumn,
            dataFormatting,
          })

          return (
            <rect
              key={getKey(this.KEY, index, i)}
              className={`bar${
                this.state.activeKey === getKey(this.KEY, index, i)
                  ? ' active'
                  : ''
              }`}
              x={xScale(d[stringColumnIndex])}
              y={y}
              width={xScale.bandwidth()}
              height={Math.abs(height)}
              onClick={() => this.onColumnClick(d, colIndex, index)}
              data-tip={tooltip}
              data-for="chart-element-tooltip"
              style={{ fill: this.props.colorScale(i), fillOpacity: 0.7 }}
            />
          )
        }
      })
      return bars
    })
    return <g data-test="stacked-columns">{stackedColumns}</g>
  }
}
