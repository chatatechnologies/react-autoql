import React, { PureComponent } from 'react'
import { getKey, getTooltipContent } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class StackedColumns extends PureComponent {
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
    if (this.props.isLoading) {
      return null
    }

    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, yScale, xScale } = this.props

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
          const value = !isNaN(valueNumber) ? valueNumber : 0
          const color = this.props.colorScale(colIndex)

          if (!value) {
            return null
          }

          let y
          let height

          if (value >= 0) {
            const nextPosValue = prevPosValue + value
            height = Math.abs(yScale.getValue(value) - yScale.getValue(0)) - 0.5
            y = yScale.getValue(nextPosValue) + 0.5
            prevPosValue = nextPosValue
          } else {
            const nextNegValue = prevNegValue + value
            height = Math.abs(yScale.getValue(value) - yScale.getValue(0)) - 0.5
            y = yScale.getValue(prevNegValue) + 0.5
            prevNegValue = nextNegValue
          }

          if (height < 0.05) {
            return null
          }

          const tooltip = getTooltipContent({
            row: d,
            columns,
            colIndex,
            colIndex2: stringColumnIndex,
            legendColumn,
            dataFormatting,
            aggregated: this.props.isAggregated,
          })

          return (
            <rect
              key={getKey(colIndex, index)}
              className={`bar${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
              x={xScale.getValue(d[stringColumnIndex])}
              y={y}
              width={xScale.bandwidth()}
              height={Math.abs(height)}
              onClick={() => this.onColumnClick(d, colIndex, index)}
              data-tooltip-html={tooltip}
              data-tooltip-id={this.props.chartTooltipID}
              style={{ fill: color }}
            />
          )
        }
      })
      return bars
    })
    return <g data-test='stacked-columns'>{stackedColumns}</g>
  }
}
