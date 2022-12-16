import React, { Component } from 'react'
import _get from 'lodash.get'
import { chartElementDefaultProps, chartElementPropTypes, getTooltipContent, scaleZero, getKey } from '../helpers'

export default class Columns extends Component {
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
    const { columns, legendColumn, numberColumnIndices, stringColumnIndex, dataFormatting, xScale, yScale } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const allBars = []
    const barWidth = xScale.bandwidth() / visibleSeries.length

    let visibleIndex = 0
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        allBars.push(
          this.props.data.map((d, index) => {
            const value = d[colIndex]
            if (!value) {
              return null
            }

            let y = value < 0 ? scaleZero(yScale) : yScale(value)
            let height = Math.abs(yScale(value) - scaleZero(yScale))

            if (isNaN(height) || isNaN(value)) {
              y = scaleZero(yScale)
              height = 0
            }

            if (height < 0.05) {
              return null
            }

            const x0 = xScale(d[stringColumnIndex])
            const dX = visibleIndex * barWidth
            const finalBarXPosition = x0 + dX

            const tooltip = getTooltipContent({
              row: d,
              columns,
              colIndex,
              stringColumnIndex,
              legendColumn,
              dataFormatting,
            })

            const key = getKey(colIndex, index)

            return (
              <rect
                key={key}
                className={`bar${this.state.activeKey === key ? ' active' : ''}`}
                data-test={`bar-${i}-${index}`}
                x={finalBarXPosition}
                y={y}
                height={height}
                width={barWidth}
                onClick={() => this.onColumnClick(d, colIndex, index)}
                data-tip={tooltip}
                data-for={this.props.chartTooltipID}
                style={{ fill: this.props.colorScale(i), fillOpacity: 0.7 }}
              />
            )
          }),
        )
        visibleIndex += 1
      }
    })

    return <g data-test='columns'>{allBars}</g>
  }
}
