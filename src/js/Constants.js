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

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const SEASON_NAMES = ['SP', 'SU', 'FA', 'HO']
export const TIMESTAMP_FORMATS = {
  epoch: 'epoch',
  iso8601: 'ISO_8601',
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
