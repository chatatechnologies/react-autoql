import PropTypes from 'prop-types'
import { isColumnDateType, ColumnTypes, getDayJSObj, getPrecisionForDayJS } from 'autoql-fe-utils'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { dataFormattingType } from '../../props/types'

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

  if (dateValue === null) {
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
