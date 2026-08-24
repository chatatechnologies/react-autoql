import {
  formatNumberTermValue,
  isPartialNumberInput,
  parseFormattedNumber,
  stripNumberFormatting,
} from '../numberTermValue'

describe('isPartialNumberInput', () => {
  it('accepts values with any number of thousands separators', () => {
    expect(isPartialNumberInput('5,000,000')).toBe(true)
    expect(isPartialNumberInput('1,234,567,890')).toBe(true)
    expect(isPartialNumberInput('5 000 000')).toBe(true)
  })

  it('accepts currency symbols and other formatting', () => {
    expect(isPartialNumberInput('$5,000,000')).toBe(true)
    expect(isPartialNumberInput('€1 500,50')).toBe(true)
    expect(isPartialNumberInput('-$5,000')).toBe(true)
  })

  it('still accepts percentages', () => {
    expect(isPartialNumberInput('100%')).toBe(true)
    expect(isPartialNumberInput('40.%')).toBe(true)
    expect(isPartialNumberInput('12.5%')).toBe(true)
    expect(isPartialNumberInput('1,000%')).toBe(true)
  })

  it('allows partial entries while typing', () => {
    expect(isPartialNumberInput('')).toBe(true)
    expect(isPartialNumberInput('-')).toBe(true)
    expect(isPartialNumberInput('1,')).toBe(true)
    expect(isPartialNumberInput('1.')).toBe(true)
    expect(isPartialNumberInput('.5')).toBe(true)
  })

  it('rejects letters and stray decimal points', () => {
    expect(isPartialNumberInput('5 dollars')).toBe(false)
    expect(isPartialNumberInput('1..2')).toBe(false)
    expect(isPartialNumberInput('1.2.3')).toBe(false)
  })
})

describe('stripNumberFormatting', () => {
  it('keeps only the number, its sign and a trailing percent', () => {
    expect(stripNumberFormatting('$5,000,000')).toBe('5000000')
    expect(stripNumberFormatting('-$5,000')).toBe('-5000')
    expect(stripNumberFormatting('1 500.50')).toBe('1500.50')
    expect(stripNumberFormatting('1,000%')).toBe('1000%')
    expect(stripNumberFormatting('')).toBe('')
    expect(stripNumberFormatting(undefined)).toBe('')
  })
})

describe('parseFormattedNumber', () => {
  it('parses formatted values into floats', () => {
    expect(parseFormattedNumber('$5,000,000')).toBe(5000000)
    expect(parseFormattedNumber('1 500.5')).toBe(1500.5)
    expect(parseFormattedNumber('-5,000')).toBe(-5000)
    expect(parseFormattedNumber(42)).toBe(42)
  })

  it('drops the percent sign rather than dividing', () => {
    expect(parseFormattedNumber('40%')).toBe(40)
  })

  it('is NaN when there is no number', () => {
    expect(parseFormattedNumber('$')).toBeNaN()
    expect(parseFormattedNumber('')).toBeNaN()
  })
})

describe('formatNumberTermValue', () => {
  it('sends a plain number to the backend', () => {
    expect(formatNumberTermValue('5,000,000')).toBe('5000000')
    expect(formatNumberTermValue('$5,000,000')).toBe('5000000')
    expect(formatNumberTermValue('1 500.50')).toBe('1500.5')
    expect(formatNumberTermValue('-$5,000')).toBe('-5000')
    expect(formatNumberTermValue('.5')).toBe('0.5')
  })

  it('preserves percentages, including a trailing decimal point', () => {
    expect(formatNumberTermValue('100%')).toBe('100%')
    expect(formatNumberTermValue('40.%')).toBe('40%')
    expect(formatNumberTermValue('1,000.25%')).toBe('1000.25%')
  })

  it('leaves values holding no number untouched', () => {
    expect(formatNumberTermValue('')).toBe('')
    expect(formatNumberTermValue('$')).toBe('$')
  })
})
