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

    const stackedBars = this.props.data.map((d, index) => {
      let prevPosValue = 0
      let prevNegValue = 0
      const bars = numberColumnIndices.map((colIndex, i) => {
        if (!columns[colIndex].isSeriesHidden) {
          const rawValue = d[colIndex]
          const valueNumber = Number(rawValue)
          const value = !isNaN(valueNumber) ? valueNumber : 0

          if (!value) {
            return null
          }

          let x
          let width
          if (value >= 0) {
            const nextPosValue = prevPosValue + value
            width = Math.abs(xScale(value) - xScale(0) - 0.5)
            x = xScale(prevPosValue)
            prevPosValue = nextPosValue
          } else {
            const nextNegValue = prevNegValue + value
            width = Math.abs(xScale(Math.abs(value)) - xScale(0) - 0.5)
            x = xScale(nextNegValue)
            prevNegValue = nextNegValue
          }

          if (width < 0.05) {
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
              className={`column${
                this.state.activeKey === getKey(colIndex, index)
                  ? ' active'
                  : ''
              }`}
              x={x}
              y={yScale(d[stringColumnIndex])}
              width={width}
              height={yScale.bandwidth()}
              onClick={() => this.onColumnClick(d, colIndex, index)}
              data-tip={tooltip}
              data-for={this.props.tooltipID}
              style={{
                fill: this.props.colorScale(i),
                fillOpacity: 0.7,
              }}
            />
          )
        }
      })
      return bars
    })

    return <g data-test="stacked-bars">{stackedBars}</g>
  }
}
