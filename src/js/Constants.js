import React from 'react'

export const TOOLTIP_TIMER_KEY = 'react-autoql-tooltip-rebuild-timer'

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
  'histogram',
  'scatterplot',
]

export const DATE_ONLY_CHART_TYPES = ['line', 'stacked_line']

export const DOUBLE_AXIS_CHART_TYPES = ['column_line']

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

export const NUMBER_COLUMN_TYPES = {
  CURRENCY: 'DOLLAR_AMT',
  QUANTITY: 'QUANTITY',
  RATIO: 'RATIO',
  PERCENT: 'PERCENT',
}

export const NUMBER_COLUMN_TYPE_DISPLAY_NAMES = {
  DOLLAR_AMT: 'Currency',
  QUANTITY: 'Quantity',
  RATIO: 'Ratio',
  PERCENT: 'Percent',
}

export const DEFAULT_DATA_PAGE_SIZE = 500
export const MAX_DATA_PAGE_SIZE = 5000

export const WEEKDAY_NAMES_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAY_NAMES_SUN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DOW_STYLES = ['NUM_1_MON', 'NUM_1_SUN', 'NUM_0_MON', 'NUM_0_SUN', 'ALPHA_MON', 'ALPHA_SUN']

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

export const MAX_LEGEND_LABELS = 22
export const MIN_HISTOGRAM_SAMPLE = 20

export const CHARTS_WITHOUT_AGGREGATED_DATA = ['histogram', 'scatterplot']
