import { buildRoseData, ROSE_OTHER_KEY } from './buildRoseData'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

const data = [
  ['BTC', 10, 1],
  ['ETH', -4, 2],
  ['BTC', 5, 3],
  ['SOL', 2, null],
  [null, 1, 1],
]

describe('buildRoseData', () => {
  test('sums each layer per category, keeping first-appearance order and signs', () => {
    const { categories, totalCategories, isTruncated } = buildRoseData(data, 0, [1, 2])
    expect(categories.map((c) => c.rawValue)).toEqual(['BTC', 'ETH', 'SOL', null])
    expect(categories[0].values).toEqual([15, 4])
    expect(categories[1].values).toEqual([-4, 2])
    expect(categories[2].values).toEqual([2, 0])
    expect(categories[0].total).toBe(19)
    expect(totalCategories).toBe(4)
    expect(isTruncated).toBe(false)
  })

  test('counts rows for the count sentinel', () => {
    const { categories } = buildRoseData(data, 0, [SANKEY_VALUE_COUNT_SENTINEL])
    expect(categories.map((c) => c.values[0])).toEqual([2, 1, 1, 1])
  })

  test('ignores null rows and non-numeric values', () => {
    const { categories } = buildRoseData([null, ['A', 'abc'], ['A', 3]], 0, [1])
    expect(categories).toHaveLength(1)
    expect(categories[0].values).toEqual([3])
  })

  test('keeps the largest categories by magnitude and combines the rest into Other', () => {
    const rows = [
      ['A', 1],
      ['B', -50],
      ['C', 2],
      ['D', 40],
      ['E', 3],
    ]
    const { categories, totalCategories, isTruncated } = buildRoseData(rows, 0, [1], 3)
    expect(categories.map((c) => c.rawValue)).toEqual(['B', 'D', null])
    expect(categories[2]).toMatchObject({ key: ROSE_OTHER_KEY, isOther: true, values: [6], otherCount: 3 })
    expect(totalCategories).toBe(5)
    expect(isTruncated).toBe(true)
  })

  test('returns no categories without a category or value column', () => {
    expect(buildRoseData(data, -1, [1]).categories).toEqual([])
    expect(buildRoseData(data, 0, []).categories).toEqual([])
    expect(buildRoseData(undefined, 0, [1]).categories).toEqual([])
  })
})

describe('buildRoseData with fixed categories', () => {
  test('keeps every fixed category in order, with zeros where a period has no rows', () => {
    const { categories: fixed } = buildRoseData(data, 0, [1])
    const { categories } = buildRoseData([['SOL', 3, 0]], 0, [1], undefined, fixed)
    expect(categories.map((c) => c.rawValue)).toEqual(['BTC', 'ETH', 'SOL', null])
    expect(categories.map((c) => c.values[0])).toEqual([0, 0, 3, 0])
  })

  test('sends rows outside the fixed set to Other', () => {
    const { categories: fixed } = buildRoseData(data, 0, [1], 3)
    expect(fixed.map((c) => c.key)).toContain(ROSE_OTHER_KEY)
    const { categories, isTruncated } = buildRoseData(
      [
        ['SOL', 2, 0],
        [null, 1, 0],
      ],
      0,
      [1],
      3,
      fixed,
    )
    expect(isTruncated).toBe(true)
    expect(categories.find((c) => c.isOther).values[0]).toBe(3)
  })

  test('an empty period still has all of the categories', () => {
    const { categories: fixed } = buildRoseData(data, 0, [1])
    expect(buildRoseData([], 0, [1], undefined, fixed).categories).toHaveLength(4)
  })
})
