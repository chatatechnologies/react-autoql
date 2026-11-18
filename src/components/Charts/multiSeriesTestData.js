// Test fixture: one category column and several number columns of the same row (not pivot, not split-by).
// Stub scales have real ranges so element geometry and hover lines can be checked.

export const MULTI_SERIES_CATEGORIES = ['Alpha', 'Beta', 'Gamma']

const multiSeriesColumns = [
  { name: 'category', display_name: 'Category', type: 'STRING', groupable: true, is_visible: true },
  { name: 'sales', display_name: 'Sales <b>', type: 'QUANTITY', is_visible: true },
  { name: 'cost', display_name: 'Cost', type: 'QUANTITY', is_visible: true },
  { name: 'units', display_name: 'Units', type: 'QUANTITY', is_visible: true },
]

const multiSeriesData = [
  ['Alpha', 1234, 567, 89],
  ['Beta', 2345, 678, 91],
  ['Gamma', 3456, 789, 12],
]

const makeBandScale = (length) => {
  const bandwidth = length / MULTI_SERIES_CATEGORIES.length
  const scale = (value) => MULTI_SERIES_CATEGORIES.indexOf(value) * bandwidth
  scale.getValue = scale
  scale.bandwidth = () => bandwidth
  scale.tickSize = bandwidth
  scale.domain = () => MULTI_SERIES_CATEGORIES
  scale.range = () => [0, length]
  return scale
}

// Value 0 maps to `zeroAt`, the max stack (~5000) fits inside the range
const makeLinearScale = (range, reversed) => {
  const [r0, r1] = range
  const length = Math.abs(r1 - r0)
  const scale = (value) => (reversed ? length - (Number(value) / 5000) * length : (Number(value) / 5000) * length)
  scale.getValue = scale
  scale.domain = () => [0, 5000]
  scale.range = () => range
  return scale
}

// Vertical charts (columns, lines): band x axis, linear y axis with the plot from y=0 (top) to y=200 (bottom)
export const makeMultiSeriesVerticalProps = (props = {}) => ({
  columns: multiSeriesColumns,
  data: multiSeriesData,
  numberColumnIndices: [1, 2, 3],
  stringColumnIndex: 0,
  stringColumnIndices: [0],
  xScale: makeBandScale(300),
  yScale: makeLinearScale([200, 0], true),
  colorScale: () => 'red',
  isAggregated: false,
  height: 200,
  width: 300,
  chartTooltipID: 'chart-tooltip',
  ...props,
})

// Horizontal charts (bars): linear x axis, band y axis
export const makeMultiSeriesHorizontalProps = (props = {}) => ({
  ...makeMultiSeriesVerticalProps(),
  xScale: makeLinearScale([0, 300], false),
  yScale: makeBandScale(200),
  ...props,
})

// Pivot data: every series is one value of the legend column (columns carry origColumn)
export const toPivotProps = (props) => ({
  ...props,
  isAggregated: true,
  legendColumn: { name: 'region', display_name: 'Region', groupable: true },
  columns: props.columns.map((column, i) => (i === 0 ? column : { ...column, origColumn: { name: 'amount' } })),
})

// Split-by series: every series is one value of the split column
export const toSplitProps = (props) => ({
  ...props,
  splitBy: { isActive: true, columnIndex: 0 },
  columns: props.columns.map((column, i) => (i === 0 ? column : { ...column, isSplitSeries: true })),
})
