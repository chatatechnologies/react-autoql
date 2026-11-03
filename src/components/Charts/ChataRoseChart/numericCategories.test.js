import { buildNumericCategories } from './numericCategories'

const rowsOf = (values) => values.map((value) => [value, 1])

describe('buildNumericCategories', () => {
  test('one category per value, smallest first, when they fit', () => {
    const { categories, getKey } = buildNumericCategories(rowsOf([3, 1, 2, 3, 1]), 0, 10)
    expect(categories.map((c) => c.rawValue)).toEqual([1, 2, 3])
    expect(categories.every((c) => !c.range)).toBe(true)
    expect(getKey([2, 1])).toBe(categories[1].key)
  })

  test('nice equal-width ranges, smallest first, when there are too many values', () => {
    const values = Array.from({ length: 100 }, (_, i) => i * 10 + 3) // 3..993
    const { categories, getKey } = buildNumericCategories(rowsOf(values), 0, 12)
    expect(categories.length).toBeGreaterThan(1)
    expect(categories.length).toBeLessThanOrEqual(12)
    categories.forEach((category, i) => {
      expect(category.range[0]).toBeLessThan(category.range[1])
      if (i > 0) expect(category.range[0]).toBe(categories[i - 1].range[1])
    })
    expect(categories[0].range[0]).toBeLessThanOrEqual(3)
    expect(categories[categories.length - 1].range[1]).toBeGreaterThanOrEqual(993)
    // Every value lands in the range that contains it, the maximum included
    values.forEach((value) => {
      const category = categories.find((c) => c.key === getKey([value, 1]))
      expect(value).toBeGreaterThanOrEqual(category.range[0])
      expect(value).toBeLessThanOrEqual(category.range[1])
    })
  })

  test('blank values get their own category, last', () => {
    const { categories, getKey } = buildNumericCategories(rowsOf([1, null, 2, undefined, '']), 0, 10)
    expect(categories.map((c) => c.rawValue)).toEqual([1, 2, null])
    expect(getKey([null, 1])).toBe(categories[2].key)
    expect(getKey(['', 1])).toBe(categories[2].key)
  })

  test('reads numbers stored as strings', () => {
    const { categories } = buildNumericCategories(rowsOf(['10', '2', '10']), 0, 10)
    expect(categories.map((c) => c.rawValue)).toEqual([2, 10])
  })

  test('returns null when there are no numbers', () => {
    expect(buildNumericCategories(rowsOf([null, 'abc']), 0, 10)).toBeNull()
    expect(buildNumericCategories(undefined, 0, 10)).toBeNull()
  })
})
