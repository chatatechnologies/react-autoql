import { shape, number, string, oneOf, bool, arrayOf } from 'prop-types'

export const authenticationType = shape({
  token: string,
  apiKey: string,
  customerId: string,
  userId: string,
  username: string,
  domain: string,
  demo: bool
})

export const dataFormattingType = shape({
  currencyCode: string,
  languageCode: string,
  currencyDecimals: number,
  quantityDecimals: number,
  comparisonDisplay: string,
  monthYearFormat: string,
  dayMonthYearFormat: string
})

export const autoQLConfigType = shape({
  debug: bool,
  test: bool,
  enableAutocomplete: bool,
  enableSafetyNet: bool,
  disableDrilldowns: bool,
  enableSuggestions: bool
})

export const themeConfigType = shape({
  theme: oneOf(['light', 'dark']),
  chartColors: arrayOf(string),
  accentColor: string,
  fontFamily: string
})
