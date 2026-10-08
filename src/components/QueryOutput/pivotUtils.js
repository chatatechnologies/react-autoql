// Small utility helpers used by QueryOutput for pivot numeric coercion and initialization.
// These are exported as pure functions so they can be unit-tested independently.
export const coerceToNumber = (value) => {
  if (typeof value === 'number') return value
  if (value === null || value === undefined) return NaN
  const str = `${value}`.trim()
  if (str === '') return NaN
  // Remove common formatting characters like $ and , and any non-numeric except dot and minus
  const cleaned = str.replace(/[^0-9.\-]/g, '')
  if (cleaned === '') return NaN
  const parsed = parseFloat(cleaned)
  return Number.isNaN(parsed) ? NaN : parsed
}

export const coerceExistingCellToNumber = (cell) => {
  if (cell === null || cell === undefined || cell === '') return 0
  if (typeof cell === 'number') return cell
  const coerced = coerceToNumber(cell)
  return Number.isNaN(coerced) ? 0 : coerced
}

export const initPivotNumericCells = (pivotTableData, rowCount, colCount) => {
  for (let r = 0; r < rowCount; r++) {
    if (!pivotTableData[r]) pivotTableData[r] = []
    for (let c = 0; c < colCount; c++) {
      if (pivotTableData[r][c] === undefined) pivotTableData[r][c] = null
    }
  }
}

export const ensureRowNumericCells = (rowArray, numCols) => {
  if (!rowArray || !Array.isArray(rowArray)) return
  for (let c = 0; c < numCols; c++) {
    if (rowArray[c] === undefined) {
      // leave header (index 0) as-is if provided; if missing set null
      rowArray[c] = c === 0 ? rowArray[c] ?? null : null
    }
  }
}

// Stable name for the column that holds everything the column limit dropped. Kept constant
// (rather than "Other (12)") so legend visibility and sorts survive a regeneration that drops
// a different number of columns. What the user reads is the column's title.
export const PIVOT_OTHER_COLUMN_NAME = '__autoql_pivot_other__'

// "Round 2" before "Round 10", "2" before "10". Plain localeCompare puts them the other way.
export const naturalCompare = (a, b) => `${a ?? ''}`.localeCompare(`${b ?? ''}`, undefined, { numeric: true })

const ORDINAL_SUFFIX_REGEX = /^(.*?)\s*(\d+)$/

// A column whose values have an order of their own - dates, plain numbers, or a shared
// label with a counter ("Round 1", "Week 12"). Dropping the smallest of these would punch
// holes in a sequence, so the column limit keeps them in order instead of by size.
export const isOrdinalPivotHeader = (values = [], isDateColumn = false) => {
  if (isDateColumn) return true
  if (!values.length) return false

  const strings = values.map((v) => `${v}`.trim())
  if (strings.every((s) => s !== '' && Number.isFinite(Number(s)))) {
    return true
  }

  let prefix
  return strings.every((s) => {
    const match = s.match(ORDINAL_SUFFIX_REGEX)
    if (!match || !match[1]) return false
    const p = match[1].toLowerCase()
    if (prefix === undefined) prefix = p
    return p === prefix
  })
}

// Total size of each pivot column. Absolute values, so a column of large losses counts as
// significant rather than sorting below a column of zeros.
export const getPivotColumnMagnitudes = (rows = [], legendColumnIndex, numberColumnIndex) => {
  const magnitudes = new Map()
  rows.forEach((row) => {
    const header = row?.[legendColumnIndex]
    const value = Number(row?.[numberColumnIndex])
    if (!Number.isFinite(value)) return
    magnitudes.set(header, (magnitudes.get(header) ?? 0) + Math.abs(value))
  })
  return magnitudes
}

// Picks which pivot columns survive the column limit. Headers come in display order and the
// kept ones stay in that order - only the choice of which to keep changes:
//  - ordinal headers keep the first `keepCount` in order
//  - everything else keeps the `keepCount` largest by magnitude
// When `reserveOther` is set, one slot of the limit goes to the "Other" column, so the
// table never grows past maxColumns.
export const selectPivotColumnHeaders = ({
  headers = [],
  maxColumns,
  magnitudes = new Map(),
  isOrdinal = false,
  reserveOther = false,
}) => {
  if (!(maxColumns > 0) || headers.length <= maxColumns) {
    return { keptHeaders: headers, droppedHeaders: [] }
  }

  const keepCount = reserveOther ? Math.max(maxColumns - 1, 1) : maxColumns

  let keptSet
  if (isOrdinal) {
    keptSet = new Set(headers.slice(0, keepCount))
  } else {
    const ranked = headers
      .map((header, index) => ({ header, index, magnitude: magnitudes.get(header) ?? 0 }))
      .sort((a, b) => b.magnitude - a.magnitude || a.index - b.index)
    keptSet = new Set(ranked.slice(0, keepCount).map(({ header }) => header))
  }

  return {
    keptHeaders: headers.filter((h) => keptSet.has(h)),
    droppedHeaders: headers.filter((h) => !keptSet.has(h)),
  }
}

const NON_ADDITIVE_AGG_TYPES = ['AVG', 'MIN', 'MAX', 'MEDIAN', 'STD_DEV', 'VARIANCE', 'COUNT_DISTINCT']
const NON_ADDITIVE_COLUMN_TYPES = ['PERCENT', 'RATIO']

// Summing the dropped columns into "Other" only means something when the values add up.
// An "Other" of averages or percentages would be a number nobody could read correctly.
export const canAggregateIntoOther = (numberColumn) => {
  if (!numberColumn) return false
  if (NON_ADDITIVE_COLUMN_TYPES.includes(numberColumn.type)) return false
  if (NON_ADDITIVE_AGG_TYPES.includes(numberColumn.aggType)) return false
  return true
}

export default {
  coerceToNumber,
  coerceExistingCellToNumber,
  initPivotNumericCells,
  ensureRowNumericCells,
  naturalCompare,
  isOrdinalPivotHeader,
  getPivotColumnMagnitudes,
  selectPivotColumnHeaders,
  canAggregateIntoOther,
}
