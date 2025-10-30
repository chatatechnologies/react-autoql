import { coerceToNumber, coerceExistingCellToNumber, initPivotNumericCells, ensureRowNumericCells } from '../pivotUtils'

describe('pivotUtils', () => {
  test('coerceToNumber parses formatted numeric strings and numbers', () => {
    expect(coerceToNumber(123)).toBe(123)
    expect(coerceToNumber('$1,234.56')).toBeCloseTo(1234.56)
    expect(Number.isNaN(coerceToNumber('abc'))).toBeTruthy()
  })

  test('coerceExistingCellToNumber handles null/empty/string/number', () => {
    expect(coerceExistingCellToNumber(null)).toBe(0)
    expect(coerceExistingCellToNumber(undefined)).toBe(0)
    expect(coerceExistingCellToNumber('')).toBe(0)
    expect(coerceExistingCellToNumber('$2,000')).toBe(2000)
    expect(coerceExistingCellToNumber(42)).toBe(42)
  })

  test('initPivotNumericCells initializes numeric cells to null', () => {
    // create 3 rows x 4 cols matrix (some rows may be empty arrays)
    const matrix = [[], [], []]
    initPivotNumericCells(matrix, 3, 4)
    // each row should have null at indices 0..3
    for (let r = 0; r < 3; r++) {
      expect(matrix[r][0]).toBeNull()
      expect(matrix[r][1]).toBeNull()
      expect(matrix[r][2]).toBeNull()
      expect(matrix[r][3]).toBeNull()
    }
  })

  test('ensureRowNumericCells ensures row has numeric nulls for missing indices', () => {
    const row = ['header']
    ensureRowNumericCells(row, 4)
    expect(row[0]).toBe('header')
    expect(row[1]).toBeNull()
    expect(row[2]).toBeNull()
    expect(row[3]).toBeNull()
  })
})
