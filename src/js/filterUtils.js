// Utility to normalize Tabulator-style filters to canonical format
export function normalizeFilters(filters, columns) {
  if (!Array.isArray(filters)) return []
  return filters.map((f) => {
    // Tabulator filter: { field, type, value }
    // Canonical: { name, operator, value }
    const col = columns?.find((c) => c.field === f.field || c.name === f.field)
    let operator = '='
    if (f.type === 'like' || f.type === 'contains') operator = 'contains'
    else if (f.type === 'between') operator = 'between'
    else if (['=', '!=', '>', '<', '>=', '<='].includes(f.type)) operator = f.type
    else if (f.type === 'is') operator = 'is'
    // BETWEEN: value may be a string 'a to b' or array [a, b]
    let value = f.value
    if (operator === 'between' && typeof value === 'string' && value.includes(' to ')) {
      value = value.split(' to ')
    }
    return {
      name: col?.name || f.field,
      operator,
      value,
    }
  })
}
import dayjs from './dayjsWithPlugins'
import { ColumnTypes, getDayJSObj } from 'autoql-fe-utils'

export const normalizeValue = (raw, column, config, { treatEmptyStringAsNull = true } = {}) => {
  if (raw == null) return null
  if (treatEmptyStringAsNull && raw === '') return null

  switch (column?.type) {
    case ColumnTypes.DOLLAR_AMT:
    case ColumnTypes.QUANTITY:
    case ColumnTypes.RATIO:
    case ColumnTypes.PERCENT: {
      if (typeof raw === 'string') {
        const cleaned = raw.replace(/[, %$]/g, '')
        const n = Number(cleaned)
        return isNaN(n) ? null : n
      }
      return typeof raw === 'number' ? raw : Number(raw)
    }
    case ColumnTypes.DATE: {
      const d = getDayJSObj({ value: raw, column, config })
      return d?.isValid?.() ? d : null
    }
    default:
      return raw
  }
}

export const compareValue = ({ value, filterValue, operator, column, config, options = {} }) => {
  const { caseInsensitiveContains = true } = options

  if (operator === 'is') {
    if (filterValue === 'NULL') return value == null
    if (filterValue === 'NOT NULL') return value != null
  }

  const vNorm = normalizeValue(value, column, config)
  let fNorm = filterValue

  if (column?.type === ColumnTypes.DATE) {
    if (filterValue && operator !== 'between') {
      const d = dayjs.utc(filterValue)
      fNorm = d?.isValid?.() ? d : null
    } else if (operator === 'between' && Array.isArray(filterValue)) {
      fNorm = filterValue.map((fv) => {
        const d = dayjs.utc(fv)
        return d?.isValid?.() ? d : null
      })
    }
  } else if (
    [ColumnTypes.DOLLAR_AMT, ColumnTypes.QUANTITY, ColumnTypes.RATIO, ColumnTypes.PERCENT].includes(column?.type)
  ) {
    if (operator === 'between' && Array.isArray(filterValue)) {
      fNorm = filterValue.map((fv) => {
        if (typeof fv === 'string') {
          const cleaned = fv.replace(/[, %$]/g, '')
          const n = Number(cleaned)
          return isNaN(n) ? null : n
        }
        return typeof fv === 'number' ? fv : Number(fv)
      })
    } else if (typeof filterValue === 'string') {
      const cleaned = filterValue.replace(/[, %$]/g, '')
      const n = Number(cleaned)
      fNorm = isNaN(n) ? filterValue : n
    }
  }

  switch (operator) {
    case '=':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return vNorm.isSame(fNorm)
      return String(vNorm) === String(fNorm)
    case '!=':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return !vNorm.isSame(fNorm)
      return String(vNorm) !== String(fNorm)
    case '>':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return vNorm.isAfter(fNorm)
      return Number(vNorm) > Number(fNorm)
    case '<':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return vNorm.isBefore(fNorm)
      return Number(vNorm) < Number(fNorm)
    case '>=':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return vNorm.isSame(fNorm) || vNorm.isAfter(fNorm)
      return Number(vNorm) >= Number(fNorm)
    case '<=':
      if (column?.type === ColumnTypes.DATE && vNorm && fNorm) return vNorm.isSame(fNorm) || vNorm.isBefore(fNorm)
      return Number(vNorm) <= Number(fNorm)
    case 'contains': {
      if (vNorm == null) return false
      const lhs = vNorm.toString()
      const rhs = fNorm != null ? fNorm.toString() : ''
      return caseInsensitiveContains ? lhs.toLowerCase().includes(rhs.toLowerCase()) : lhs.includes(rhs)
    }
    case 'between': {
      if (!Array.isArray(fNorm) || fNorm.length < 2) return true
      const [min, max] = fNorm
      if (column?.type === ColumnTypes.DATE && vNorm && min && max) {
        return (vNorm.isSame(min) || vNorm.isAfter(min)) && (vNorm.isSame(max) || vNorm.isBefore(max))
      }
      const vNum = Number(vNorm)
      return vNum >= Number(min) && vNum <= Number(max)
    }
    default:
      return true
  }
}

export const applyFiltersToData = (
  data,
  filters,
  columns,
  config,
  options = { caseInsensitiveContains: true, failOnUnknownColumn: true, treatEmptyStringAsNull: true },
) => {
  if (!filters?.length || !data?.length || !columns?.length) return data

  const { failOnUnknownColumn } = options

  const enrichedFilters = filters
    .filter((f) => f && f.name && f.operator != null)
    .map((f) => {
      const colIndex = columns.findIndex((c) => c.name === f.name)
      const column = colIndex >= 0 ? columns[colIndex] : undefined
      return { ...f, colIndex, column }
    })
    .filter((f) => {
      if (f.colIndex === -1 && failOnUnknownColumn) return false
      return true
    })

  if (!enrichedFilters.length) return data

  return data.filter((row) =>
    enrichedFilters.every((f) => {
      if (f.colIndex === -1) return true // skipped if failOnUnknownColumn = false
      const cellValue = row[f.colIndex]
      return compareValue({
        value: cellValue,
        filterValue: f.value,
        operator: f.operator,
        column: f.column,
        config,
        options,
      })
    }),
  )
}
