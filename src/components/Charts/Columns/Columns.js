import React, { PureComponent } from 'react'
import { getKey, getTooltipContent, isColumnNumberType, scaleZero } from 'autoql-fe-utils'

import { chartElementDefaultProps, chartElementPropTypes, createDateDrilldownFilter } from '../chartPropHelpers'

export default class Columns extends PureComponent {
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

  getBars = (columnIndices, yScale, startIndex = 0) => {
    const { columns, legendColumn, stringColumnIndex, dataFormatting, xScale } = this.props

    if (!columnIndices?.length || !yScale || !this.barWidth) {
      return null
    }

    let visibleIndex = startIndex
    const allBars = []
    columnIndices.forEach((colIndex, i) => {
      if (!columns[colIndex].isSeriesHidden) {
        const color = this.props.colorScale(colIndex)
        allBars.push(
          this.props.data.map((d, index) => {
            const value = d[colIndex]
            if (!value) {
              return null
            }

            let y = value < 0 ? scaleZero(yScale) : yScale.getValue(value)
            let height = Math.abs(yScale.getValue(value) - scaleZero(yScale))

            if (isNaN(height) || isNaN(value)) {
              y = scaleZero(yScale)
              height = 0
            }

            if (height < 0.05) {
              return null
            }

            const x0 = xScale.getValue(d[stringColumnIndex])
            const dX = visibleIndex * this.barWidth
            const finalBarXPosition = x0 + dX

            const tooltip = getTooltipContent({
              row: d,
              columns,
              colIndex,
              colIndex2: stringColumnIndex,
              legendColumn,
              dataFormatting,
              aggregated: this.props.isAggregated,
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
                width={this.barWidth}
                onClick={() => this.onColumnClick(d, colIndex, index)}
                data-tooltip-html={tooltip}
                data-tooltip-id={this.props.chartTooltipID}
                style={{ fill: color }}
              />
            )
          }),
        )
        visibleIndex += 1
      }
    })
    return allBars
  }

  render = () => {
    if (this.props.isLoading) {
      return null
    }

    const { columns, numberColumnIndices, numberColumnIndices2, xScale, yScale, yScale2 } = this.props

    const visibleSeries = numberColumnIndices.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    const visibleSeries2 = numberColumnIndices2?.filter((colIndex) => {
      return !columns[colIndex].isSeriesHidden
    })

    if (!visibleSeries.length) {
      return null
    }

    const numBarsSeries1 = visibleSeries.length
    const numBarsSeries2 = yScale2 ? visibleSeries2?.length ?? 0 : 0
    const numBars = numBarsSeries1 + numBarsSeries2

    this.barWidth = (xScale.bandwidth ? xScale.bandwidth() : 0) / numBars

    const bars = this.getBars(numberColumnIndices, yScale)

    return <g data-test='columns'>{bars}</g>
  }
}
