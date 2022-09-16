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
    activeKey: this.props.activeChartElementKey,
  }

  onColumnClick = (row, colIndex, rowIndex) => {
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
              key={getKey(colIndex, index)}
              className={`bar${
                this.state.activeKey === getKey(colIndex, index)
                  ? ' active'
                  : ''
              }`}
              x={xScale(d[stringColumnIndex])}
              y={y}
              width={xScale.bandwidth()}
              height={Math.abs(height)}
              onClick={() => this.onColumnClick(d, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.tooltipID}
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
