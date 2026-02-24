import React, { PureComponent } from 'react'
import { getKey, getTooltipContent } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

export default class StackedColumns extends PureComponent {
  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  onColumnClick = (row, colIndex, rowIndex) => {
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

    if (!columns || !numberColumnIndices) {
      return null
    }

    // numberColumnIndices is already sorted by total aggregates in ChataChart (biggest to smallest)
    // Use this order for all stacks to ensure consistent ordering and legend matching
    const visibleIndices = numberColumnIndices.filter(
      (colIndex) => columns[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    if (!visibleIndices.length) {
      return null
    }

    const gradientDefs = []
    const gradientIds = new Map()
    
    // Create gradients for each series
    visibleIndices.forEach((colIndex, i) => {
      const color = this.props.colorScale(colIndex)
      const gradientId = `stacked-column-gradient-${colIndex}-${i}`
      gradientIds.set(colIndex, gradientId)
      
      // Vertical gradient for stacked columns (top to bottom)
      gradientDefs.push(
        <linearGradient key={gradientId} id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="50%" stopColor={color} stopOpacity="0.75" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      )
    })

    const stackedColumns = this.props.data.map((d, index) => {
      let prevPosValue = 0
      let prevNegValue = 0
      const bandwidth = xScale.bandwidth()
      const cornerRadius = Math.min(bandwidth / 2, 3) // Slight rounding for modern look
      
      const bars = visibleIndices
        .map((colIndex) => {
          const rawValue = d[colIndex]
          const valueNumber = Number(rawValue)
          const value = !isNaN(valueNumber) ? valueNumber : 0
          return { colIndex, value }
        })
        .filter(({ value }) => value !== 0 && value !== null && value !== undefined)
        .map(({ colIndex, value }) => {
          const gradientId = gradientIds.get(colIndex)

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
              width={bandwidth}
              height={Math.abs(height)}
              rx={cornerRadius}
              ry={cornerRadius}
              onClick={() => this.onColumnClick(d, colIndex, index)}
              data-tooltip-html={tooltip}
              data-tooltip-id={this.props.chartTooltipID}
              fill={`url(#${gradientId})`}
            />
          )
        })
      return bars
    })
    
    return (
      <g data-test='stacked-columns'>
        <defs>{gradientDefs}</defs>
        {stackedColumns}
      </g>
    )
  }
}
