import React, { Component } from 'react'
import { getKey, scaleZero, getTooltipContent } from 'autoql-fe-utils'

import { rebuildTooltips } from '../../Tooltip'

import { chartElementDefaultProps, chartElementPropTypes } from '../chartPropHelpers'

export default class Bars extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  componentDidMount = () => {
    rebuildTooltips()
  }

  onBarClick = (row, colIndex, rowIndex) => {
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

    const allBars = []
    const barHeight = yScale.tickSize / visibleSeries.length

    let visibleIndex = 0
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        const color = this.props.colorScale(colIndex)
        allBars.push(
          this.props.data.map((d, index) => {
            const value = d[colIndex]
            if (!value) {
              return null
            }

            let width = Math.abs(xScale(value) - scaleZero(xScale))
            if (isNaN(width)) {
              width = 0
            }

            if (width < 0.05) {
              return null
            }

            const y0 = yScale(d[stringColumnIndex])
            const dY = visibleIndex * barHeight
            const finalBarYPosition = y0 + dY

            const tooltip = getTooltipContent({
              row: d,
              columns,
              colIndex,
              colIndex2: stringColumnIndex,
              legendColumn,
              dataFormatting,
            })

            return (
              <rect
                key={getKey(colIndex, index)}
                className={`bar${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
                data-test={`bar-${i}-${index}`}
                y={finalBarYPosition}
                x={value > 0 ? scaleZero(xScale) : xScale(value)}
                width={width}
                height={barHeight}
                onClick={() => this.onBarClick(d, colIndex, index)}
                data-tip={tooltip}
                data-for={this.props.chartTooltipID}
                style={{ fill: color, fillOpacity: 1 }}
              />
            )
          }),
        )
        visibleIndex += 1
      }
    })

    return <g data-test='bars'>{allBars}</g>
  }
}
