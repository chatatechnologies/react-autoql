import React from 'react'
import { mean, sum } from 'd3-array'
import { isColumnSummable, formatElement, getDayJSObj, ColumnTypes } from 'autoql-fe-utils'
import dayjs from '../../js/dayjsWithPlugins'

export class SummaryStatsCalculator {
  constructor(dataFormatting) {
    this.dataFormatting = dataFormatting
  }

  calculate(props) {
    const stats = {}

    try {
      const rows = this.getAllRows(props)

      props.columns?.forEach((column, columnIndex) => {
        if (column.mutator) return

        if (isColumnSummable(column)) {
          stats[columnIndex] = this.calculateNumberStats(rows, columnIndex, column)
        } else if (column?.type === ColumnTypes.DATE) {
          stats[columnIndex] = this.calculateDateStats(rows, columnIndex, column)
        }
      })
    } catch (error) {
      console.error('Error calculating summary stats:', error)
    }

    return stats
  }

  calculateNumberStats(rows, columnIndex, column) {
    const columnData = rows
      .map((r) => r[columnIndex])
      .filter((v) => typeof v === 'number' || (!isNaN(parseFloat(v)) && v !== null && v !== undefined))
      .map((v) => (typeof v === 'number' ? v : parseFloat(v)))

    return {
      avg: mean(columnData),
      sum: sum(columnData),
    }
  }

  calculateDateStats(rows, columnIndex, column) {
    const dates = rows.map((r) => r[columnIndex]).filter((date) => !!date)

    const columnData = dates.map((date) => getDayJSObj({ value: date, column })).filter((r) => r?.isValid?.())

    const min = dayjs.min(columnData)
    const max = dayjs.max(columnData)

    if (min?.length > 0 && max?.length > 0) {
      return {
        min: formatElement({
          element: min.toISOString(),
          column,
          config: this.dataFormatting,
        }),
        max: formatElement({
          element: max.toISOString(),
          column,
          config: this.dataFormatting,
        }),
      }
    }

    return null
  }

  getAllRows(props) {
    return props.pivot ? props.data : props.response?.data?.data?.rows
  }
}
