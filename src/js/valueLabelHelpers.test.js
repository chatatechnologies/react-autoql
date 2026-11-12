import { buildValueLabelLock, isValueLabelColumn, pickValueLabelMatch } from './valueLabelHelpers'

const bakery = {
  keyword: 'bakery',
  format_txt: 'Bakery',
  canonical: 'category_canonical',
  column_name: 'category',
  show_message: 'Category',
}

describe('isValueLabelColumn', () => {
  test('treats string columns as value label columns', () => {
    expect(isValueLabelColumn({ type: 'STRING' })).toBe(true)
    expect(isValueLabelColumn({ type: 'DOLLAR_AMT' })).toBe(false)
    expect(isValueLabelColumn(undefined)).toBe(false)
  })
})

describe('pickValueLabelMatch', () => {
  test('matches the display text, ignoring case and padding', () => {
    expect(pickValueLabelMatch([bakery], ' BAKERY ', { name: 'category' })).toBe(bakery)
  })

  test('ignores partial matches from the ranked search', () => {
    const supplies = { ...bakery, keyword: 'bakery supplies', format_txt: 'Bakery Supplies' }
    expect(() => pickValueLabelMatch([supplies], 'Bakery', { name: 'category' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  test('prefers the match from the cell column over the same text elsewhere', () => {
    const vendor = { ...bakery, canonical: 'vendor_canonical', column_name: 'vendor', show_message: 'Vendor' }
    expect(pickValueLabelMatch([vendor, bakery], 'Bakery', { name: 'category' })).toBe(bakery)
  })

  test('refuses the same text under two other columns', () => {
    const vendor = { ...bakery, canonical: 'vendor_canonical', column_name: 'vendor', show_message: 'Vendor' }
    expect(() => pickValueLabelMatch([vendor, bakery], 'Bakery', { name: 'item' })).toThrow(
      expect.objectContaining({ code: 'AMBIGUOUS' }),
    )
  })

  test('treats duplicates that build the same lock as one match', () => {
    expect(pickValueLabelMatch([bakery, { ...bakery }], 'Bakery', { name: 'item' })).toEqual(bakery)
  })
})

describe('buildValueLabelLock', () => {
  test('builds a session lock in the shape FilterLockPopover uses', () => {
    expect(buildValueLabelLock(bakery)).toEqual({
      value: 'bakery',
      format_txt: 'Bakery',
      show_message: 'Category',
      key: 'category_canonical',
      filter_type: 'include',
      canonical_key: 'category',
      isSession: true,
    })
  })
})
