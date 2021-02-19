import { shape, number, string, oneOf, bool, arrayOf } from 'prop-types'

export const authenticationType = shape({
  token: string,
  apiKey: string,
  domain: string,
})

export const dataFormattingType = shape({
  currencyCode: string,
  languageCode: string,
  currencyDecimals: number,
  quantityDecimals: number,
  comparisonDisplay: string,
  monthYearFormat: string,
  dayMonthYearFormat: string,
})

export const autoQLConfigType = shape({
  debug: bool,
  test: bool,
  enableAutocomplete: bool,
  enableQueryValidation: bool,
  enableDrilldowns: bool,
  enableQuerySuggestions: bool,
  enableColumnVisibilityManager: bool,
  enableNotifications: bool,
})

export const themeConfigType = shape({
  theme: oneOf(['light', 'dark']),
  chartColors: arrayOf(string),
  accentColor: string,
  fontFamily: string,
  dashboardBackground: string,
})

export const dataConfigType = shape({
  stringColumnIndices: arrayOf(number),
  numberColumnIndices: arrayOf(number),
  stringColumnIndex: number,
  legendColumnIndex: number,
  numberColumnIndex: number,
})
