import React from 'react'
import { formatElement, getDataFormatting, isColumnNumberType } from 'autoql-fe-utils'
import { RB } from '../constants'
import { STRINGS } from '../strings'

// A table on paper is a plain <table>. Tabulator (what QueryOutput renders) is virtualised: only the rows
// in its scroll viewport exist in the DOM, so it can't be measured, split across pages or printed.

const formatCell = (value, column, config) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const formatted = formatElement({ element: value, column, config })
  return formatted === null || formatted === undefined ? '' : formatted
}

export const ReportTable = React.memo(function ReportTable({
  columns,
  rows,
  from = 0,
  dataFormatting,
  showHeader = true,
  total = null,
  measure = false,
}) {
  const config = getDataFormatting(dataFormatting)
  return (
    <table className={`${RB}-table`} data-measure-table={measure || undefined}>
      {showHeader ? (
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.name ?? col.index} scope='col' data-numeric={isColumnNumberType(col) || undefined}>
                {col.display_name || col.name}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((row, i) => (
          <tr key={from + i} data-row=''>
            {columns.map((col) => (
              <td key={col.name ?? col.index} data-numeric={isColumnNumberType(col) || undefined}>
                {formatCell(row?.[col.index], col, config)}
              </td>
            ))}
          </tr>
        ))}
        {total ? (
          <tr data-total=''>
            {columns.map((col) => {
              const isLabel = col.index === total.labelIndex
              const sum = total.sums[col.index]
              return (
                <td key={col.name ?? col.index} data-numeric={(!isLabel && isColumnNumberType(col)) || undefined}>
                  {isLabel ? STRINGS.data.total : sum !== undefined ? formatCell(sum, col, config) : ''}
                </td>
              )
            })}
          </tr>
        ) : null}
      </tbody>
    </table>
  )
})
