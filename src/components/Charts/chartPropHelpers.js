import PropTypes from 'prop-types'
import {
  isColumnDateType,
  ColumnTypes,
  getDayJSObj,
  getPrecisionForDayJS,
  DisplayTypes,
  dataFormattingDefault,
} from 'autoql-fe-utils'

import { dataFormattingType } from '../../props/types'

/** Threshold for dense bar/column layout (zero band padding, zero series gaps). */
export const DENSE_CATEGORY_THRESHOLD = 100

/** True when the category axis alone is crowded (many rows). */
export const isDenseCategoryChart = (data) => Array.isArray(data) && data.length > DENSE_CATEGORY_THRESHOLD

/**
 * Resolves which numeric column indices define legend series for layout (matches ChataBarChart / Columns).
 */
const resolveSeriesColumnIndices = ({ visibleSeriesIndices, numberColumnIndices }) =>
  visibleSeriesIndices?.length ? visibleSeriesIndices : numberColumnIndices

export const isStackedBarOrColumnDisplayType = (type) =>
  type === DisplayTypes.STACKED_BAR || type === DisplayTypes.STACKED_COLUMN

/**
 * Count of visible legend series used for grouped charts — includes every series column
 * even when some rows have no value (no bar), so layout matches the legend.
 * Stacked bar/column charts use one slot per category (the whole stack), not per segment.
 */
export const getVisibleLegendSeriesSlotCount = (props) => {
  const { columns, numberColumnIndices, numberColumnIndices2, visibleSeriesIndices, visibleSeriesIndices2 } = props
  if (!columns || !numberColumnIndices?.length) {
    return 1
  }

  const countVisible = (indices) =>
    indices.filter((i) => columns[i] && !columns[i].isSeriesHidden).length

  let total = countVisible(resolveSeriesColumnIndices({ visibleSeriesIndices, numberColumnIndices }))

  if (numberColumnIndices2?.length) {
    total += countVisible(
      resolveSeriesColumnIndices({
        visibleSeriesIndices: visibleSeriesIndices2,
        numberColumnIndices: numberColumnIndices2,
      }),
    )
  }

  return Math.max(1, total)
}

/**
 * Dense when there are many categories, or many grouped cells (categories × visible series).
 * Stacked bar/column: only category count matters (one stack per category, not segment count).
 */
export const isDenseChartLayout = (data, chartProps) => {
  const n = Array.isArray(data) ? data.length : 0
  const props = chartProps || {}
  const seriesSlots = isStackedBarOrColumnDisplayType(props.type)
    ? 1
    : getVisibleLegendSeriesSlotCount(props)
  return n > DENSE_CATEGORY_THRESHOLD || n * seriesSlots > DENSE_CATEGORY_THRESHOLD
}

/** Options for getBandScale when the layout is dense — removes padding between bands. */
export const getDenseBandScaleOptions = (data, chartProps) =>
  isDenseChartLayout(data, chartProps) ? { innerPadding: 0, outerPadding: 0 } : {}

export const chartContainerPropTypes = {
  dataFormatting: dataFormattingType,

  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  numberColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndex: PropTypes.number,
  numberColumnIndex: PropTypes.number,
  legendColumnIndex: PropTypes.number,
  enableDynamicCharting: PropTypes.bool,
  legendLocation: PropTypes.string,
  isResizing: PropTypes.bool,
  onLegendClick: PropTypes.func,
  onLabelChange: PropTypes.func,
  onXAxisClick: PropTypes.func,
  onYAxisClick: PropTypes.func,
}

export const chartContainerDefaultProps = {
  dataFormatting: dataFormattingDefault,

  enableDynamicCharting: true,
  legendColumnIndex: undefined,
  isResizing: false,
  onLegendClick: () => {},
  onXAxisClick: () => {},
  onYAxisClick: () => {},
  onLabelChange: () => {},
}

export const chartPropTypes = {
  ...chartContainerPropTypes,
  visibleSeriesIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  deltaX: PropTypes.number,
  deltaY: PropTypes.number,
}

export const chartDefaultProps = {
  ...chartContainerDefaultProps,
  deltaX: 0,
  deltaY: 0,
}

export const axesPropTypes = {
  ...chartPropTypes,
  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
  innerHeight: PropTypes.number,
  innerWidth: PropTypes.number,
  onLabelRotation: PropTypes.func,
}

export const axesDefaultProps = {
  ...chartDefaultProps,
  innerHeight: 0,
  innerWidth: 0,
  onLabelRotation: () => {},
}

export const chartElementPropTypes = {
  ...chartPropTypes,
  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
}

export const chartElementDefaultProps = {
  activeKey: undefined,
  onChartClick: () => {},
}

/**
 * Creates a "between" filter for date drilldowns when the string axis is a DATE column.
 * Returns null if the column is not a DATE type or if the date value is invalid.
 * 
 * @param {Object} params - Parameters object
 * @param {Object} params.stringColumn - The column object for the string axis
 * @param {*} params.dateValue - The date value from the row data
 * @param {Object} params.dataFormatting - Data formatting configuration
 * @returns {Object|null} Filter object with "between" operator, or null if not applicable
 */
export const createDateDrilldownFilter = ({ stringColumn, dateValue, dataFormatting }) => {
  // Only handle absolute DATE types, not cyclical DATE_STRING types
  if (!stringColumn || !isColumnDateType(stringColumn) || stringColumn.type !== ColumnTypes.DATE) {
    return null
  }

  if (dateValue == null) {
    return null
  }

  try {
    const isoDate = getDayJSObj({ value: dateValue, column: stringColumn, config: dataFormatting })
    const precision = getPrecisionForDayJS(stringColumn.precision)
    const isoDateStart = isoDate.startOf(precision).toISOString()
    const isoDateEnd = isoDate.endOf(precision).toISOString()

    return {
      name: stringColumn.name,
      operator: 'between',
      value: `${isoDateStart},${isoDateEnd}`,
      column_type: ColumnTypes.DATE,
    }
  } catch (error) {
    console.error('Error creating date drilldown filter:', error)
    return null
  }
}
