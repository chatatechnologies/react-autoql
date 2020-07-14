export const authenticationDefault = {
  token: undefined,
  apiKey: undefined,
  domain: undefined,
}

export const dataFormattingDefault = {
  currencyCode: 'USD',
  languageCode: 'en-US',
  currencyDecimals: 2,
  quantityDecimals: 1,
  comparisonDisplay: 'PERCENT',
  monthYearFormat: 'MMM YYYY',
  dayMonthYearFormat: 'll',
}

export const autoQLConfigDefault = {
  debug: false,
  test: false,
  enableAutocomplete: true,
  enableQueryValidation: true,
  enableQuerySuggestions: true,
  enableColumnVisibilityManager: true,
  enableDrilldowns: true,
  enableNotifications: false,
}

export const themeConfigDefault = {
  theme: 'light',
  chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
  accentColor: '#26A7E9',
  fontFamily: 'sans-serif',
  titleColor: '#356f90', // DASHBOARD TILES ONLY
  dashboardBackground: '#fafafa',
}

export const dataConfigDefault = {
  stringColumnIndices: [],
  numberColumnIndices: [],
  seriesIndices: [],
  stringColumnIndex: 0,
  legendColumnIndex: undefined,
  numberColumnIndex: 1,
}
