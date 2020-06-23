import dayjs from './dayjsWithPlugins'

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

export const MONTH_NAMES = {
  1: dayjs('1-1-2020').format('MMMM'),
  2: dayjs('2-2-2020').format('MMMM'),
  3: dayjs('3-3-2020').format('MMMM'),
  4: dayjs('4-4-2020').format('MMMM'),
  5: dayjs('5-5-2020').format('MMMM'),
  6: dayjs('6-6-2020').format('MMMM'),
  7: dayjs('7-7-2020').format('MMMM'),
  8: dayjs('8-8-2020').format('MMMM'),
  9: dayjs('9-9-2020').format('MMMM'),
  10: dayjs('10-10-2020').format('MMMM'),
  11: dayjs('11-11-2020').format('MMMM'),
  12: dayjs('12-12-2020').format('MMMM'),
}

export const WEEKDAY_NAMES = {
  1: 'Sunday',
  2: 'Monday',
  3: 'Tuesday',
  4: 'Wednesday',
  5: 'Thursday',
  6: 'Friday',
  7: 'Saturday',
}

export const MAX_ROW_LIMIT = 10000
