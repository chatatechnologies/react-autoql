export const TABLE_TYPES = [
  'pivot_table',
  'pivot_column',
  'date_pivot',
  'table',
  'compare_table',
  'compare_table_budget',
]

export const CHART_TYPES = [
  'bar',
  'bubble',
  'chart',
  'column',
  'heatmap',
  'line',
  'pie',
  'stacked_bar',
  'stacked_column',
  'stacked_line',
  'column_line',
]

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const COLUMN_TYPES = {
  CURRENCY: 'DOLLAR_AMT',
  QUANTITY: 'QUANTITY',
  RATIO: 'RATIO',
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const SEASON_NAMES = ['SP', 'SU', 'FA', 'HO']
export const TIMESTAMP_FORMATS = {
  epoch: 'EPOCH',
  iso8601: 'ISO8601',
}

export const PRECISION_TYPES = {
  DAY: 'DAY',
  MONTH: 'MONTH',
  YEAR: 'YEAR',
  WEEK: 'WEEK',
  QUARTER: 'QUARTER',
  DATE_HOUR: 'DATE_HOUR',
  DATE_MINUTE: 'DATE_MINUTE',
  HOUR: 'HOUR',
  MINUTE: 'MINUTE',
}

export const DAYJS_PRECISION_FORMATS = {
  DAY: 'll',
  MONTH: 'MMMM YYYY',
  YEAR: 'YYYY',
  DATE_HOUR: 'll h:00A',
  DATE_MINUTE: 'll h:mmA',
}

export const DEFAULT_AGG_TYPE = 'sum'

export const AGG_TYPES = [
  {
    displayName: 'Sum',
    value: 'sum',
    tooltip: '<strong>Sum:</strong> Values that have the same chart axis label will be added up.',
  },
  {
    displayName: 'Average',
    value: 'avg',
    tooltip: '<strong>Average:</strong> Values that have the same chart axis label will be averaged.',
  },
  // {
  //   displayName: 'Median',
  //   value: 'median',
  //   tooltip: 'The median (middle) value will be shown for all data points with same label.',
  // },
  // {
  //   displayName: 'Minimum',
  //   value: 'min',
  //   tooltip: 'The smallest value will be shown for all data points with same label.',
  // },
  // {
  //   displayName: 'Maximum',
  //   value: 'max',
  //   tooltip: 'The largest value will be shown for all data points with same label.',
  // },
  // {
  //   displayName: 'Standard deviation',
  //   value: 'deviation',
  //   tooltip: 'The standard deviation will be shown for all data points with the same label.',
  // },
  // {
  //   displayName: 'Variance',
  //   value: 'variance',
  //   tooltip: 'The variance will be shown for all data points with the same label.',
  // },
  {
    displayName: 'Count',
    value: 'count',
    tooltip:
      '<strong>Count:</strong> The total number of non-blank values will be shown for all data points with the same label.',
  },
  // {
  //   displayName: 'Distinct Count',
  //   value: 'count-distinct',
  // },
]
