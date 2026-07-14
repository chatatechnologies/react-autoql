import {
  currencyInputFromMicros,
  formatBillingPeriod,
  formatMicrosAsCurrency,
  getDefaultBillingHistoryRange,
  microsFromCurrencyInput,
} from '../billingFormatting'

describe('billingFormatting', () => {
  it('formats micros and currency input values', () => {
    expect(formatMicrosAsCurrency(12500000)).toBe('$12.50')
    expect(formatMicrosAsCurrency(0)).toBe('$0.00')
    expect(formatMicrosAsCurrency(null)).toBe('Not set')
    expect(formatMicrosAsCurrency(undefined, 'Unavailable')).toBe('Unavailable')
    expect(currencyInputFromMicros(12500000)).toBe('12.50')
    expect(currencyInputFromMicros(null)).toBe('')
  })

  it('parses valid currency values into integer micros', () => {
    expect(microsFromCurrencyInput('12.3456789')).toBe(12345679)
    expect(microsFromCurrencyInput('0')).toBe(0)
  })

  it('rejects blank, negative, and non-numeric currency values', () => {
    expect(microsFromCurrencyInput('')).toBeNull()
    expect(microsFromCurrencyInput('-1')).toBeNull()
    expect(microsFromCurrencyInput('not-a-number')).toBeNull()
  })

  it('formats billing periods in UTC and preserves invalid values', () => {
    expect(formatBillingPeriod('2026-06')).toBe('June 2026')
    expect(formatBillingPeriod('2026-13')).toBe('2026-13')
    expect(formatBillingPeriod(null)).toBe('Not available')
  })

  it('returns the current UTC month and previous five months', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00Z'))
    expect(getDefaultBillingHistoryRange()).toEqual({ from: '2025-08', to: '2026-01' })
    jest.useRealTimers()
  })
})
