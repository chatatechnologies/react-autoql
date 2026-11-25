import { isColumnDateType, dateSortFn } from 'autoql-fe-utils'

// Date nodes are keyed by their formatted value so timestamps that display the same (e.g. same day) merge into one node
export const getSankeyNodeKey = ({ rawKey, display, column }) => {
  return isColumnDateType(column) && display ? display : rawKey
}

// Date columns run chronologically top to bottom; other columns put the largest flows on top.
// Undefined (d3's default crossing-minimizing order) when no path column is a date.
export const getSankeyNodeSort = (columns, pathColumnIndices) => {
  const hasDateColumn = (pathColumnIndices || []).some((index) => isColumnDateType(columns?.[index]))
  if (!hasDateColumn) return undefined

  return (a, b) => {
    const column = columns?.[pathColumnIndices?.[a.stage]]
    if (isColumnDateType(column)) {
      return dateSortFn(a.rawValue, b.rawValue, column)
    }
    return (b.value || 0) - (a.value || 0)
  }
}
