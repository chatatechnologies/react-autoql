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
  enableSlackSharing: true,
  enableTeamsSharing: true,
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
  stringColumnIndex: 0,
  legendColumnIndex: undefined,
  numberColumnIndex: 1,
}

export const getAuthentication = (prop = {}) => {
  return {
    ...authenticationDefault,
    ...prop,
  }
}

export const getDataFormatting = (prop = {}) => {
  return {
    ...dataFormattingDefault,
    ...prop,
  }
}

export const getAutoQLConfig = (prop = {}) => {
  return {
    ...autoQLConfigDefault,
    ...prop,
  }
}

export const getThemeConfig = (prop = {}) => {
  return {
    ...themeConfigDefault,
    ...prop,
  }
}

export const getDataConfig = (prop = {}) => {
  return {
    ...dataConfigDefault,
    ...prop,
  }
}
