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

export default {
  coerceToNumber,
  coerceExistingCellToNumber,
  initPivotNumericCells,
  ensureRowNumericCells,
}
