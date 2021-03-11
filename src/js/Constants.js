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
  1: dayjs('2020-1-1').format('MMMM'),
  2: dayjs('2020-2-2').format('MMMM'),
  3: dayjs('2020-3-3').format('MMMM'),
  4: dayjs('2020-4-4').format('MMMM'),
  5: dayjs('2020-5-5').format('MMMM'),
  6: dayjs('2020-6-6').format('MMMM'),
  7: dayjs('2020-7-7').format('MMMM'),
  8: dayjs('2020-8-8').format('MMMM'),
  9: dayjs('2020-9-9').format('MMMM'),
  10: dayjs('2020-10-10').format('MMMM'),
  11: dayjs('2020-11-11').format('MMMM'),
  12: dayjs('2020-12-12').format('MMMM'),
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
