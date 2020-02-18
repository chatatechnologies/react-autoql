export const authenticationDefault = {
  token: undefined,
  apiKey: undefined,
  customerId: undefined,
  userId: undefined,
  username: undefined,
  domain: undefined,
  demo: false
}

export const dataFormattingDefault = {
  currencyCode: undefined,
  languageCode: undefined,
  currencyDecimals: undefined,
  quantityDecimals: undefined,
  comparisonDisplay: undefined,
  monthYearFormat: undefined,
  dayMonthYearFormat: undefined
}

export const autoQLConfigDefault = {
  debug: false,
  test: false,
  enableAutocomplete: true,
  enableSafetyNet: true,
  enableSuggestions: true,
  disableDrilldowns: false,
  dataFormatting: dataFormattingDefault
}

export const themeConfigDefault = {
  theme: 'light',
  chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
  accentColor: undefined,
  fontFamily: undefined,
  titleColor: '#356f90' // DASHBOARD TILES ONLY
}
