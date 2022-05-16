import React, { Component } from 'react'
import _get from 'lodash.get'
import {
  chartElementDefaultProps,
  chartElementPropTypes,
  getTooltipContent,
  scaleZero,
  getKey,
} from '../helpers'

export default class Bars extends Component {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeKey,
  }

  onBarClick = (row, colIndex, rowIndex) => {
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

    const allBars = []
    const barHeight = yScale.bandwidth() / visibleSeries.length

    let visibleIndex = 0
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        allBars.push(
          this.props.data.map((d, index) => {
            const value = d[colIndex]
            if (!value) {
              return null
            }

            let width = Math.abs(xScale(value) - scaleZero(xScale))
            if (Number.isNaN(width)) {
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
                data-test={`bar-${i}-${index}`}
                y={finalBarYPosition}
                x={value > 0 ? scaleZero(xScale) : xScale(value)}
                width={width}
                height={barHeight}
                onClick={() => this.onBarClick(d, colIndex, index)}
                data-tip={tooltip}
                data-for="chart-element-tooltip"
                style={{ fill: this.props.colorScale(i), fillOpacity: 0.7 }}
              />
            )
          })
        )
        visibleIndex += 1
      }
    })

    return <g data-test="bars">{allBars}</g>
  }
}
