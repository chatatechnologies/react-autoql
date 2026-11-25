import { ColumnTypes, isColumnDateType, dateSortFn } from 'autoql-fe-utils'

// DATE nodes are keyed by their formatted value so timestamps that display the same (e.g. same day) merge into one
// node. DATE_STRING nodes keep their raw value: a drilldown can only filter on one raw DATE_STRING value.
export const getSankeyNodeKey = ({ rawKey, display, column }) => {
  return column?.type === ColumnTypes.DATE && display ? display : rawKey
}

// A link between merged DATE nodes filters on each date's whole range. Only list queries use this: on aggregated
// data the filter would re-run the aggregate, so those use the drilldown endpoint like the node click does.
export const shouldFilterLinkDrilldown = ({ sourceColumn, targetColumn, isAggregatedData }) => {
  if (isAggregatedData) {
    return false
  }
  return sourceColumn?.type === ColumnTypes.DATE || targetColumn?.type === ColumnTypes.DATE
}

// Date columns run chronologically top to bottom; other columns put the largest flows on top.
// Undefined (d3's default crossing-minimizing order) when no path column is a date.
export const getSankeyNodeSort = (columns, pathColumnIndices) => {
  const hasDateColumn = (pathColumnIndices || []).some((index) => isColumnDateType(columns?.[index]))
  if (!hasDateColumn) {
    return undefined
  }

  return (a, b) => {
    const column = columns?.[pathColumnIndices?.[a.stage]]
    if (isColumnDateType(column)) {
      return dateSortFn(a.rawValue, b.rawValue, column)
    }
    return (b.value || 0) - (a.value || 0)
  }
}
