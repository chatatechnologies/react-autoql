import React, { PureComponent } from 'react'
import { getKey, scaleZero, getTooltipContent } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

export default class Bars extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onBarClick = (row, colIndex, rowIndex) => {
    const newActiveKey = getKey(colIndex, rowIndex)
    const { columns, stringColumnIndex, dataFormatting } = this.props

    // Create date drilldown filter if string axis is a DATE column
    const stringColumn = columns[stringColumnIndex]
    const filter = createDateDrilldownFilter({
      stringColumn,
      dateValue: row[stringColumnIndex],
      dataFormatting,
    })

    this.props.onChartClick({
      row,
      columnIndex: colIndex,
      columns,
      stringColumnIndex,
      legendColumn: this.props.legendColumn,
      activeKey: newActiveKey,
      filter, // Pass filter if date column, otherwise let QueryOutput construct it
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
    const gradientDefs = []
    // Calculate bar height with 0.5px gap between series
    const totalHeight = yScale.tickSize
    const gapHeight = (visibleSeries.length - 1) * 0.5 // 0.5px gap between each series
    const barHeight = visibleSeries.length > 0 ? (totalHeight - gapHeight) / visibleSeries.length : 0

    let visibleIndex = 0
    numberColumnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        const color = this.props.colorScale(colIndex)
        const gradientId = `bar-gradient-${colIndex}-${i}`
        
        // Create horizontal gradient for bars (left to right)
        gradientDefs.push(
          <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="50%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
        )
        
        allBars.push(
          this.props.data.map((d, index) => {
            const value = d[colIndex]
            if (!value) {
              return null
            }

            let width = Math.abs(xScale.getValue(value) - scaleZero(xScale))
            if (isNaN(width)) {
              width = 0
            }

            if (width < 0.05) {
              return null
            }

            const y0 = yScale.getValue(d[stringColumnIndex])
            // Add 0.5px gap between series
            const dY = visibleIndex * (barHeight + 0.5)
            const finalBarYPosition = y0 + dY

            const tooltip = getTooltipContent({
              row: d,
              columns,
              colIndex,
              colIndex2: stringColumnIndex,
              legendColumn,
              dataFormatting,
              aggregated: this.props.isAggregated,
            })

            // Round corners - use smaller of width/height for radius, but cap at 4px
            const cornerRadius = Math.min(Math.min(width, barHeight) / 2, 4)

            return (
              <rect
                key={getKey(colIndex, index)}
                className={`bar${this.state.activeKey === getKey(colIndex, index) ? ' active' : ''}`}
                data-test={`bar-${i}-${index}`}
                y={finalBarYPosition}
                x={value > 0 ? scaleZero(xScale) : xScale(value)}
                width={width}
                height={barHeight}
                rx={cornerRadius}
                ry={cornerRadius}
                onClick={() => this.onBarClick(d, colIndex, index)}
                data-tooltip-html={tooltip}
                data-tooltip-id={this.props.chartTooltipID}
                fill={`url(#${gradientId})`}
              />
            )
          }),
        )
        visibleIndex += 1
      }
    })

    return (
      <g data-test='bars'>
        <defs>{gradientDefs}</defs>
        {allBars}
      </g>
    )
  }
}
