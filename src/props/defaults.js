export const authenticationDefault = {
  token: undefined,
  apiKey: undefined,
  domain: undefined,
  dprKey: undefined,
  dprDomain: undefined,
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
  enableQueryInterpretation: true,
  enableQueryValidation: true,
  enableQuerySuggestions: true,
  enableColumnVisibilityManager: true,
  enableDrilldowns: true,
  enableNotifications: false,
  enableSlackSharing: true,
  enableTeamsSharing: true,
  enableCSVDownload: false,
  enableReportProblem: true,
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

export const getDataConfig = (prop = {}) => {
  return {
    ...dataConfigDefault,
    ...prop,
  }
}
