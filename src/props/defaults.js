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
  currencyCode: 'USD',
  languageCode: 'en-US',
  currencyDecimals: 2,
  quantityDecimals: 1,
  comparisonDisplay: 'PERCENT',
  monthYearFormat: 'MMM YYYY',
  dayMonthYearFormat: 'MMM D, YYYY'
}

export const autoQLConfigDefault = {
  debug: false,
  test: false,
  enableAutocomplete: true,
  enableQueryValidation: true,
  enableQuerySuggestions: true,
  enableColumnEditor: true,
  enableDrilldowns: true
}

export const themeConfigDefault = {
  theme: 'light',
  chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
  accentColor: undefined,
  fontFamily: 'sans-serif',
  titleColor: '#356f90' // DASHBOARD TILES ONLY
}
