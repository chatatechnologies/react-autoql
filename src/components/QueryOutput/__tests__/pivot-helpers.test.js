import { QueryOutput } from '../QueryOutput'

describe('QueryOutput pivot helpers', () => {
  test('_coerceToNumber parses formatted numeric strings and numbers', () => {
    const instance = new QueryOutput({})
    expect(instance._coerceToNumber(123)).toBe(123)
    expect(instance._coerceToNumber('$1,234.56')).toBeCloseTo(1234.56)
    expect(Number.isNaN(instance._coerceToNumber('abc'))).toBeTruthy()
  })

  test('_coerceExistingCellToNumber handles null/empty/string/number', () => {
    const instance = new QueryOutput({})
    expect(instance._coerceExistingCellToNumber(null)).toBe(0)
    expect(instance._coerceExistingCellToNumber(undefined)).toBe(0)
    expect(instance._coerceExistingCellToNumber('')).toBe(0)
    expect(instance._coerceExistingCellToNumber('$2,000')).toBe(2000)
    expect(instance._coerceExistingCellToNumber(42)).toBe(42)
  })

  test('_initPivotNumericCells initializes numeric cells to null', () => {
    const instance = new QueryOutput({})
    // create 3 rows x 4 cols matrix (some rows may be empty arrays)
    const matrix = [[], [], []]
    instance._initPivotNumericCells(matrix, 3, 4)
    // each row should have null at indices 1..3
    for (let r = 0; r < 3; r++) {
      expect(matrix[r][0]).toBeNull()
      expect(matrix[r][1]).toBeNull()
      expect(matrix[r][2]).toBeNull()
      expect(matrix[r][3]).toBeNull()
    }
  })

  test('_ensureRowNumericCells ensures row has numeric nulls for missing indices', () => {
    const instance = new QueryOutput({})
    const row = ['header']
    instance._ensureRowNumericCells(row, 4)
    expect(row[0]).toBe('header')
    expect(row[1]).toBeNull()
    expect(row[2]).toBeNull()
    expect(row[3]).toBeNull()
  })
})
