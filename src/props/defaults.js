const TIMESTAMP_FORMATS = {
  epoch: 'EPOCH',
  iso8601: 'ISO8601',
}

export const authenticationDefault = {
  token: undefined,
  apiKey: undefined,
  domain: undefined,
  dprKey: undefined,
  dprDomain: undefined,
}

export const dataFormattingDefault = {
  timestampFormat: TIMESTAMP_FORMATS.iso8601,
  currencyCode: 'USD',
  languageCode: 'en-US',
  currencyDecimals: 2,
  quantityDecimals: 2,
  ratioDecimals: 4,
  comparisonDisplay: 'PERCENT',
  monthYearFormat: 'MMMM YYYY',
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
  enableCSVDownload: true,
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
