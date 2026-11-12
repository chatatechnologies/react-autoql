import { getFilterLockLabel, getFilterLockSummary } from './filterLockSummary'

describe('getFilterLockSummary', () => {
  test('nothing without filters', () => {
    expect(getFilterLockSummary([], 'Title')).toBeUndefined()
    expect(getFilterLockSummary(undefined, 'Title')).toBeUndefined()
  })

  test('groups by category and include/exclude, capping each group', () => {
    const filters = ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value, show_message: 'Letter' }))
    filters.push({ value: 'z', show_message: 'Letter', filter_type: 'exclude' }, { value: 'q' })

    expect(getFilterLockSummary(filters, 'Title')).toBe(
      'Title\nLetter: a, b, c, d, +1 more\nLetter (excluded): z\nFilter: q',
    )
  })
})

describe('getFilterLockLabel', () => {
  test('prefers the display text', () => {
    expect(getFilterLockLabel({ value: 'bakery', format_txt: 'Bakery' })).toBe('Bakery')
    expect(getFilterLockLabel({ value: 'bakery' })).toBe('bakery')
  })
})
