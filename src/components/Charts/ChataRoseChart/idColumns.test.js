import { isIdLikeColumn } from './idColumns'

const quantity = (display_name, name = display_name.toLowerCase().replace(/ /g, '_')) => ({
  display_name,
  name: `public.store_transaction.${name}`,
  type: 'QUANTITY',
})

describe('isIdLikeColumn', () => {
  test.each(['Customer Key', 'Store Transaction Number', 'Product ID', 'Invoice No', 'Account Num', 'Postal Code'])(
    '"%s" reads as an identifier by its name',
    (name) => {
      expect(isIdLikeColumn(quantity(name), [])).toBe(true)
    },
  )

  test('the raw column name counts too', () => {
    expect(isIdLikeColumn({ display_name: 'Customer', name: 'sales.customer_id', type: 'QUANTITY' }, [])).toBe(true)
  })

  test.each(['Quantity', 'Number of Items', 'Units Sold', 'Keystrokes'])('"%s" is a real measure', (name) => {
    expect(isIdLikeColumn(quantity(name), [1, 2, 2, 3])).toBe(false)
  })

  test('money, percentages and ratios are never identifiers', () => {
    expect(isIdLikeColumn({ display_name: 'Sale Number', type: 'DOLLAR_AMT' }, [])).toBe(false)
    expect(isIdLikeColumn({ display_name: 'Rate Code', type: 'PERCENT' }, [])).toBe(false)
  })

  test('a quantity whose values are nearly all distinct whole numbers reads as an identifier', () => {
    const ids = Array.from({ length: 40 }, (_, i) => 100000 + i * 7)
    expect(isIdLikeColumn(quantity('Ref'), ids)).toBe(true)
  })

  test('repeated or fractional values, or too few rows to tell, are a real measure', () => {
    expect(
      isIdLikeColumn(
        quantity('Units'),
        Array.from({ length: 40 }, (_, i) => i % 5),
      ),
    ).toBe(false)
    expect(
      isIdLikeColumn(
        quantity('Weight'),
        Array.from({ length: 40 }, (_, i) => i + 0.5),
      ),
    ).toBe(false)
    expect(isIdLikeColumn(quantity('Ref'), [101, 102, 103])).toBe(false)
  })
})
