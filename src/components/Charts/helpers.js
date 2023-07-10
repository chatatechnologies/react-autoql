import PropTypes from 'prop-types'
import { max, min, bin } from 'd3-array'
import _isEqual from 'lodash.isequal'
import dayjs from '../../js/dayjsWithPlugins'
import { scaleLinear, scaleBand, scaleTime } from 'd3-scale'
import { select } from 'd3-selection'
import { isMobile } from 'react-device-detect'
import { deepEqual, formatElement, getCurrencySymbol, getDayJSObj } from '../../js/Util'
import { getColumnTypeAmounts } from '../QueryOutput/columnHelpers'
import { dataFormattingType } from '../../props/types'
import { dataFormattingDefault } from '../../props/defaults'
import { AGG_TYPES, DAYJS_PRECISION_FORMATS, NUMBER_COLUMN_TYPES } from '../../js/Constants'

const DEFAULT_INNER_PADDING = 0.2
const DEFAULT_OUTER_PADDING = 0.5

export const chartContainerPropTypes = {
  dataFormatting: dataFormattingType,

  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  numberColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndex: PropTypes.number.isRequired,
  numberColumnIndex: PropTypes.number.isRequired,
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

export const dataStructureChanged = (props, prevProps) => {
  return (
    props.data?.length !== prevProps.data?.length ||
    props.stringColumnIndex !== prevProps.stringColumnIndex ||
    props.numberColumnIndex !== prevProps.numberColumnIndex ||
    !_isEqual(props.legendColumn, prevProps.legendColumn) ||
    !_isEqual(props.columns, prevProps.columns) ||
    !_isEqual(props.numberColumnIndices, prevProps.numberColumnIndices) ||
    !_isEqual(props.stringColumnIndices, prevProps.stringColumnIndices) ||
    (props.type === 'pie' && !_isEqual(props.data, prevProps.data))
  )
}

export const onlySeriesVisibilityChanged = (props, prevProps) => {
  if (_isEqual(props.columns, prevProps.columns)) {
    return false
  }

  const columnsFiltered = props.columns.map((col) => {
    return {
      ...col,
      isSeriesHidden: undefined,
    }
  })
  const prevColumnsFiltered = prevProps.columns.map((col) => {
    return {
      ...col,
      isSeriesHidden: undefined,
    }
  })

  return deepEqual(columnsFiltered, prevColumnsFiltered)
}

export const scaleZero = (scale) => {
  const domain = scale?.domain()
  const domainLength = domain?.length

  if (!domainLength) {
    return scale?.(0) || 0
  }

  const min = domain[0]
  const max = domain[domain?.length - 1]
  if (min > 0 && max > 0) {
    return scale(min)
  }
  if (min < 0 && max < 0) {
    return scale(max)
  }
  return scale(0)
}

export const getKey = (rowIndex, cellIndex, extraIndex = 0) => {
  return `${rowIndex}-${cellIndex}-${extraIndex}`
}

export const shouldLabelsRotate = (axisElement) => {
  let prevBBox
  let didOverlap = false
  const padding = 10
  select(axisElement)
    .selectAll('g.tick text')
    .each(function () {
      if (!didOverlap) {
        const textBoundingRect = select(this).node().getBoundingClientRect()
        if (prevBBox) {
          if (textBoundingRect.x < prevBBox.x + prevBBox.width + padding) {
            didOverlap = true
          }
        }

        prevBBox = textBoundingRect
      }
    })

  return didOverlap
}

export const getTooltipContent = ({
  row,
  columns,
  colIndex,
  colIndex2,
  legendColumn,
  dataFormatting,
  aggregated = true,
}) => {
  let tooltipElement = null

  try {
    let tooltipLine1 = ''
    let tooltipLine2 = ''
    let tooltipLine3 = ''

    const column1 = columns[colIndex]
    const column2 = columns[colIndex2]

    if (!!legendColumn && !!column1?.origColumn) {
      tooltipLine1 = `<div><strong>${legendColumn.tooltipTitle ?? legendColumn.title}:</strong> ${
        column1.tooltipTitle ?? column1.title
      }</div>`
    }

    if (column1) {
      let column1Title = column1.origColumn
        ? column1.origColumn.tooltipTitle ?? column1.origColumn.title
        : column1.tooltipTitle ?? column1.title

      if (aggregated) {
        const aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === column1.aggType)?.displayName
        if (aggTypeDisplayName) {
          column1Title = `${column1Title} (${aggTypeDisplayName})`
        }
      }

      const column1Value = formatElement({
        element: row[colIndex] || 0,
        column: columns[colIndex],
        config: dataFormatting,
        isChart: true,
      })

      tooltipLine2 = `<div><strong>${column1Title}:</strong> ${column1Value}</div>`
    }

    if (column2) {
      const stringTitle = column2.tooltipTitle ?? column2.title
      const stringValue = formatElement({
        element: row[colIndex2],
        column: column2,
        config: dataFormatting,
        isChart: true,
      })

      tooltipLine3 = `<div><strong>${stringTitle}:</strong> ${stringValue}</div>`
    }

    tooltipElement = `<div>
        ${tooltipLine1}
        ${tooltipLine2}
        ${tooltipLine3}
      </div>`

    return tooltipElement
  } catch (error) {
    console.error(error)
    return null
  }
}

export const getLegendLabelsForMultiSeries = (columns, colorScale, numberColumnIndices = []) => {
  try {
    if (!numberColumnIndices?.length) {
      return []
    }

    const numberColumns = numberColumnIndices.map((index) => columns[index])

    if (!numberColumns?.length) {
      return []
    }

    const allAggTypesSame = numberColumns.every((col) => col.aggType === numberColumns[0].aggType)

    const legendLabels = numberColumnIndices.map((columnIndex, i) => {
      const column = columns[columnIndex]
      let label = column.title
      if (!allAggTypesSame) {
        const aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === column?.aggType)?.displayName
        if (aggTypeDisplayName) {
          label = `${label} (${aggTypeDisplayName})`
        }
      }

      return {
        label,
        color: colorScale(columnIndex),
        hidden: column.isSeriesHidden,
        columnIndex,
        column,
      }
    })
    return legendLabels
  } catch (error) {
    console.error(error)
    return []
  }
}

export const getNumberOfSeries = (data) => {
  try {
    const numSeries = data[0].cells.length
    return numSeries
  } catch (error) {
    console.error(error)
    return 1
  }
}

export const convertToNumber = (value) => {
  try {
    const number = Number(value)
    if (isNaN(number)) {
      return 0
    }
    return number
  } catch (error) {
    console.error(error)
    return 0
  }
}

export const calculateMinAndMaxSums = (data, stringColumnIndex, numberColumnIndices, isScaled) => {
  const positiveSumsObject = {}
  const negativeSumsObject = {}

  // Loop through data array to get maximum and minimum sums of postive and negative values
  // These will be used to get the max and min values for the x Scale (data values)
  data.forEach((row) => {
    const label = row[stringColumnIndex]
    numberColumnIndices.forEach((colIndex) => {
      const rawValue = row[colIndex]
      let value = Number(rawValue)
      if (isNaN(value)) {
        value = 0
      }

      if (value >= 0) {
        // Calculate positive sum
        if (positiveSumsObject[label]) {
          positiveSumsObject[label] += value
        } else {
          positiveSumsObject[label] = value
        }
      } else if (value < 0) {
        // Calculate negative sum
        if (negativeSumsObject[label]) {
          negativeSumsObject[label] -= value
        } else {
          negativeSumsObject[label] = value
        }
      }
    })
  })

  // Get max and min sums from those sum objects
  let maxValue = getMaxValueFromKeyValueObj(positiveSumsObject)
  let minValue = getMinValueFromKeyValueObj(negativeSumsObject)

  const scaleRatio = maxValue / minValue
  const disableChartScale = !isScaled || (maxValue > 0 && minValue < 0) || scaleRatio > 1000
  if (disableChartScale) {
    if (maxValue > 0 && minValue > 0) {
      minValue = 0
    } else if (maxValue < 0 && minValue < 0) {
      maxValue = 0
    }
  }

  return {
    maxValue,
    minValue,
  }
}

export const getObjSize = (obj) => {
  if (typeof obj !== 'object') {
    return undefined
  }

  return Object.keys(obj).length
}

export const getMaxValueFromKeyValueObj = (obj) => {
  const size = getObjSize(obj)

  let maxValue = 0
  if (size === 1) {
    maxValue = obj[Object.keys(obj)[0]]
  } else if (size > 1) {
    const numberValues = [...Object.values(obj)].filter((value) => {
      return !isNaN(Number(value))
    })
    maxValue = Math.max(...numberValues)
  }
  return maxValue
}

export const getMinValueFromKeyValueObj = (obj) => {
  const size = getObjSize(obj)

  let minValue = 0
  if (size === 1) {
    minValue = obj[Object.keys(obj)[0]]
  } else if (size > 1) {
    const numberValues = [...Object.values(obj)].filter((value) => {
      return !isNaN(Number(value))
    })
    minValue = Math.min(...numberValues)
  }
  return minValue
}

export const getMinAndMaxValues = (data, numberColumnIndices, isScaled, sum, stringColumnIndex) => {
  if (sum) {
    return calculateMinAndMaxSums(data, stringColumnIndex, numberColumnIndices, isScaled)
  }

  try {
    const maxValuesFromArrays = []
    const minValuesFromArrays = []
    numberColumnIndices.forEach((colIndex, i) => {
      maxValuesFromArrays.push(max(data, (d) => convertToNumber(d[colIndex])))
      minValuesFromArrays.push(min(data, (d) => convertToNumber(d[colIndex])))
    })
    let maxValue = max(maxValuesFromArrays)
    let minValue = min(minValuesFromArrays)
    // In order to see the chart elements we need to make sure
    // that the max and min values are different.
    // Use this if block below is commented out
    if (maxValue === minValue) {
      if (minValue > 0) {
        minValue = 0
      } else if (maxValue < 0) {
        maxValue = 0
      }
    }

    // Always show 0 on the y axis
    // Keep this for future use
    const scaleRatio = maxValue / minValue
    const disableChartScale = !isScaled || (maxValue > 0 && minValue < 0) || scaleRatio > 1000

    if (disableChartScale) {
      if (maxValue > 0 && minValue > 0) {
        minValue = 0
      } else if (maxValue < 0 && minValue < 0) {
        maxValue = 0
      }
    }

    return {
      minValue,
      maxValue,
    }
  } catch (error) {
    console.error(error)
    return { minValue: 0, maxValue: 0 }
  }
}

export const getLegendLocation = (seriesArray, displayType, preferredLocation = 'right') => {
  const bottom = 'bottom'
  const legendLocation = isMobile ? bottom : preferredLocation

  // Always show legend for column line combo charts
  if (displayType === 'column_line') {
    return bottom
  }

  const displayTypesWithoutLegends = ['pie', 'heatmap', 'bubble', 'scatterplot', 'histogram']

  if (seriesArray?.length < 2 || displayTypesWithoutLegends.includes(displayType)) {
    return undefined
  } else if (displayType === 'stacked_column' || displayType === 'stacked_bar' || displayType === 'stacked_line') {
    return legendLocation
  } else if (seriesArray?.length > 2) {
    return legendLocation
  } else if (seriesArray?.length > 1) {
    return legendLocation
  }

  return undefined
}

export const getRangeForAxis = (props, axis) => {
  let rangeStart
  let rangeEnd
  if (axis === 'x') {
    rangeStart = 0
    rangeEnd = rangeStart + props.width

    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart
    }
  } else if (axis === 'y') {
    rangeEnd = 0 // props.deltaY
    rangeStart = props.height // + rangeEnd

    if (rangeStart < rangeEnd) {
      rangeStart = rangeEnd
    }
  }

  return [rangeStart, rangeEnd]
}

export const getTimeScale = ({ props, columnIndex, axis, domain }) => {
  let error = false
  const dateArray = props.data.map((d) => {
    const dayjsObj = getDayJSObj({
      value: d[columnIndex],
      column: props.columns[columnIndex],
      config: props.dataFormatting,
    })

    if (dayjsObj?.isValid()) {
      return DateUTC(dayjsObj.valueOf())
    }

    error = true
    return
  })

  if (error) {
    // There was an error converting all values to dates - use band scale instead
    return getBandScale({ props, columnIndex, axis, domain })
  }

  const range = getRangeForAxis(props, axis)
  const minDate = min(dateArray)
  const maxDate = max(dateArray)
  const scaleDomain = domain ?? [minDate, maxDate]
  const axisColumns = props.stringColumnIndices?.map((index) => props.columns[index])

  const scale = scaleTime().domain(scaleDomain).range(range)

  scale.type = 'TIME'
  scale.minValue = minDate
  scale.maxValue = maxDate
  scale.dataFormatting = props.dataFormatting
  scale.column = props.columns[columnIndex]
  scale.title = scale.column?.display_name
  scale.fields = axisColumns
  scale.hasDropdown = props.enableAxisDropdown && props.stringColumnIndices?.length > 1
  scale.tickLabels = getTickValues({ scale, props })

  scale.tickSize = 0
  scale.getValue = (value) => {
    return scale(getDayJSObj({ value, column: scale.column }).toDate())
  }

  return scale
}

export const getBandScale = ({
  props,
  columnIndex,
  axis,
  outerPadding = DEFAULT_OUTER_PADDING,
  innerPadding = DEFAULT_INNER_PADDING,
  domain,
  changeColumnIndices,
}) => {
  const range = getRangeForAxis(props, axis)
  const scaleDomain = domain ?? props.data.map((d) => d[columnIndex])
  const axisColumns = props.stringColumnIndices?.map((index) => props.columns[index])

  const scale = scaleBand().domain(scaleDomain).range(range).paddingInner(innerPadding).paddingOuter(outerPadding)

  scale.type = 'BAND'
  scale.dataFormatting = props.dataFormatting
  scale.column = props.columns[columnIndex]
  scale.title = scale.column?.display_name
  scale.fields = axisColumns
  scale.tickSize = scale.bandwidth()
  scale.hasDropdown = props.enableAxisDropdown && props.stringColumnIndices?.length > 1
  scale.getValue = (value) => {
    return scale(value)
  }

  scale.changeColumnIndices = changeColumnIndices ?? props.changeStringColumnIndex
  scale.tickLabels = getTickValues({ scale, props, initialTicks: scaleDomain, innerPadding, outerPadding })

  return scale
}

export const getUnitsForColumn = (column, useAgg = true) => {
  if (!column) {
    return
  }

  let aggUnit
  if (useAgg && column.aggType) {
    aggUnit = AGG_TYPES.find((aggType) => aggType.value === column.aggType)?.unit
  }

  switch (aggUnit) {
    case 'none': {
      return 'none'
    }
    case 'inherit':
    default: {
      break
    }
  }

  if (column.type === NUMBER_COLUMN_TYPES.CURRENCY) {
    return 'currency'
  } else if (column.type === NUMBER_COLUMN_TYPES.QUANTITY) {
    return 'none'
  } else if (column.type === NUMBER_COLUMN_TYPES.RATIO) {
    return 'none'
  } else if (column.type === NUMBER_COLUMN_TYPES.PERCENT) {
    return 'percent'
  }
}

export const getUnitSymbol = ({ column, dataFormatting }) => {
  const units = getUnitsForColumn(column, false)
  let unitSymbol = ''
  if (units === 'currency') {
    const currencySymbol = getCurrencySymbol(dataFormatting)
    if (currencySymbol) {
      unitSymbol = currencySymbol
    }
  } else if (units === 'percent') {
    unitSymbol = '%'
  }

  return unitSymbol
}

export const getLinearAxisTitle = ({ numberColumns, aggregated }) => {
  let title = 'Amount'

  try {
    if (!numberColumns?.length) {
      return undefined
    }

    // If there are different titles for any of the columns, return a generic label based on the type
    const allTitlesEqual =
      numberColumns.length === 1 ||
      !numberColumns.find((col) => {
        return col.display_name !== numberColumns[0].display_name
      })

    if (allTitlesEqual) {
      title = numberColumns[0].display_name
    }

    if (aggregated) {
      const aggTypeArray = numberColumns.map((col) => col.aggType)
      const allAggTypesEqual = !aggTypeArray.find((agg) => agg !== aggTypeArray[0])
      if (allAggTypesEqual) {
        const aggName = AGG_TYPES.find((agg) => agg.value === aggTypeArray[0])?.displayName
        if (aggName) {
          title = `${title} (${aggName})`
        }
      }
    }

    // Remove this for simplicity, we may want to add the units to the title later
    // const units = getNumberAxisUnits(numberColumns)
    // if (units === 'currency') {
    //   const currencySymbol = getCurrencySymbol(dataFormatting)
    //   if (currencySymbol) {
    //     title = `${title} (${currencySymbol})`
    //   }
    // } else if (units === 'percent') {
    //   title = `${title} (%)`
    // }

    return title
  } catch (error) {
    console.error(error)
    return title
  }
}

export const getNumberAxisUnits = (numberColumns) => {
  const unitsArray = numberColumns.map((col) => {
    return getUnitsForColumn(col)
  })

  const allUnitsEqual = !unitsArray.find((unit) => unit !== unitsArray[0])
  if (allUnitsEqual) {
    return unitsArray[0]
  }

  return 'none'
}

export const getBinLinearScale = ({ props, columnIndex, axis, buckets, bins, changeColumnIndices } = {}) => {
  const { amountOfNumberColumns } = getColumnTypeAmounts(props.columns)

  const domain = [bins[0], bins[bins.length - 1]]

  const range = getRangeForAxis(props, axis)
  const scale = scaleLinear().domain(domain).range(range)

  scale.type = 'BIN'
  scale.minValue = domain[0]
  scale.maxValue = domain[1]
  scale.column = props.columns[columnIndex]
  scale.fields = [columnIndex]
  scale.columnIndex = columnIndex
  scale.dataFormatting = {
    ...props.dataFormatting,
    isBinScale: true,
  }
  scale.hasDropdown = props.enableAxisDropdown && amountOfNumberColumns > 1 // todo: allow user to switch column here
  scale.stacked = false
  scale.units = getUnitsForColumn(props.columns[columnIndex], false)
  scale.title = props.columns[columnIndex]?.display_name
  scale.tickSize = (axis === 'x' ? props.innerWidth : props.innerHeight) / buckets.length
  scale.isScaled = false
  scale.aggregated = false
  scale.changeColumnIndices = changeColumnIndices ?? props.changeNumberColumnIndices
  scale.getValue = (value) => {
    return scale(value)
  }

  scale.tickLabels = getTickValues({
    initialTicks: bins,
    props,
    scale,
    isScaled: false,
  })

  return scale
}

export const getHistogramScale = ({ props, axis, buckets, columnIndex }) => {
  const maxBins = max(buckets, (d) => d.length)
  const range = getRangeForAxis(props, axis)
  const domain = [0, maxBins]
  const units = 'none'
  const allowMultipleSeries = false
  const hasDropdown = false
  const disableAutoScale = true
  const title = 'Count'

  return getLinearScale({
    props,
    units,
    domain,
    range,
    columnIndex,
    allowMultipleSeries,
    hasDropdown,
    axis,
    title,
    disableAutoScale,
  })
}

export const getLinearScale = ({
  props,
  minValue,
  maxValue,
  axis,
  range,
  domain,
  tickValues,
  numTicks,
  stacked,
  isScaled,
  columns,
  units,
  title,
  columnIndex,
  columnIndices,
  hasDropdown,
  allowMultipleSeries = true,
  changeColumnIndices,
  disableAutoScale = false,
}) => {
  let domainFinal = domain
  if (!domain) {
    let min = minValue ?? tickValues?.[0]
    let max = maxValue ?? tickValues?.[tickValues?.length - 1]

    if (isNaN(min)) {
      min = 0
    }

    if (isNaN(max)) {
      max = min
    }

    domainFinal = [min, max]
  }

  const cols = columns ?? props.columns
  const colIndices = columnIndices ?? [columnIndex]

  const scaleRange = range ?? getRangeForAxis(props, axis)
  const axisColumns = colIndices?.map((index) => cols[index]) ?? []
  const axisTitleWithAggType = getLinearAxisTitle({
    numberColumns: axisColumns,
    dataFormatting: props.dataFormatting,
    aggregated: props.aggregated,
  })

  const axisTitle = title ?? axisTitleWithAggType

  const scale = scaleLinear().domain(domainFinal).range(scaleRange)
  scale.disableAutoScale = disableAutoScale
  scale.minValue = domainFinal[0]
  scale.maxValue = domainFinal[1]
  scale.columnIndex = columnIndex
  scale.column = cols[columnIndex]
  scale.fields = axisColumns
  scale.dataFormatting = props.dataFormatting
  scale.hasDropdown = hasDropdown ?? props.enableAxisDropdown
  scale.stacked = !!stacked
  scale.type = 'LINEAR'
  scale.units = units ?? getNumberAxisUnits(axisColumns)
  scale.title = axisTitle
  scale.tickSize = 0
  scale.isScaled = isScaled
  scale.aggregated = props.aggregated
  scale.allowMultipleSeries = allowMultipleSeries
  scale.changeColumnIndices = changeColumnIndices ?? props.changeNumberColumnIndices
  scale.getValue = (value) => {
    return scale(value)
  }

  scale.tickLabels =
    tickValues ??
    getTickValues({
      props,
      scale,
      numTicks,
      isScaled,
    })

  return scale
}

export const getLinearScales = ({ props, columnIndices1 = [], columnIndices2 = [], axis, stacked, isScaled }) => {
  const minMax = getMinAndMaxValues(props.data, columnIndices1, isScaled, stacked, props.stringColumnIndex)
  const minValue = minMax.minValue
  const maxValue = minMax.maxValue
  const tempScale1 = getLinearScale({
    props,
    minValue,
    maxValue,
    axis,
    stacked,
    isScaled,
    columnIndex: columnIndices1[0],
    columnIndices: columnIndices1,
  })

  if (!columnIndices2?.length) {
    return {
      scale: tempScale1,
    }
  }

  // If there are 2 y axes, we need to line up the number of ticks and their values
  const minMax2 = getMinAndMaxValues(props.data, columnIndices2, isScaled, stacked, props.stringColumnIndex)
  const minValue2 = minMax2.minValue
  const maxValue2 = minMax2.maxValue

  const tempScale2 = getLinearScale({
    props,
    minValue: minValue2,
    maxValue: maxValue2,
    range: tempScale1.range(),
    numTicks: tempScale1.tickLabels?.length ?? undefined,
    stacked,
    isScaled,
    columnIndex: columnIndices2[0],
    columnIndices: columnIndices2,
  })

  const tickValues1 = tempScale1.tickLabels || []
  const tickValues2 = tempScale2.tickLabels || []

  const numTickValues1 = tickValues1.length
  const numTickValues2 = tickValues2.length

  const newTickValues1 = [...tickValues1]
  const newTickValues2 = [...tickValues2]
  if (numTickValues1 === numTickValues2) {
    // do nothing, ticks line up already
  } else if (numTickValues2 < numTickValues1) {
    const difference = numTickValues1 - numTickValues2
    const interval = tickValues2[1] - tickValues2[0]
    const maxTickValue = tickValues2[numTickValues2 - 1]

    for (let i = 0; i < difference; i++) {
      const nextTickValue = maxTickValue + i * interval
      newTickValues2.push(nextTickValue)
    }
  } else if (numTickValues2 > numTickValues1) {
    const difference = numTickValues2 - numTickValues1
    const interval = tickValues1[1] - tickValues1[0]
    const maxTickValue = tickValues1[numTickValues1 - 1]

    for (let i = 1; i <= difference; i++) {
      const nextTickValue = maxTickValue + i * interval
      newTickValues1.push(nextTickValue)
    }
  }

  const scale = getLinearScale({
    props,
    axis,
    tickValues: newTickValues1,
    stacked,
    isScaled,
    columnIndex: columnIndices1[0],
    columnIndices: columnIndices1,
  })

  const scale2 = getLinearScale({
    props,
    range: scale.range(),
    tickValues: newTickValues2,
    stacked,
    isScaled,
    columnIndex: columnIndices2[0],
    columnIndices: columnIndices2,
  })

  scale.secondScale = scale2
  scale2.secondScale = scale

  return { scale, scale2 }
}

export const doesElementOverflowContainer = (element, container) => {
  const elementBBox = element.getBBox()
  const containerBBox = container.getBBox()

  // intersects top
  if (elementBBox.y < containerBBox.y) {
    return true
  }

  // intersects bottom
  if (elementBBox.y + elementBBox.height < containerBBox.y + containerBBox.height) {
    return true
  }

  // intersects left
  if (elementBBox.x < containerBBox.x) {
    return true
  }

  // intersects right
  if (elementBBox.x + elementBBox.width < containerBBox.x + containerBBox.width) {
    return true
  }

  return false
}

const getEpochFromDate = (date, precision, precisionFrame) => {
  if (date?.getTime) {
    if (precision && precisionFrame === 'start') {
      return dayjs(date).utc().startOf(precision).valueOf()
    } else if (precision && precisionFrame === 'end') {
      return dayjs(date).utc().endOf(precision).valueOf()
    }
    return date.getTime()
  }

  return
}

export const DateUTC = (d) => {
  const date = new Date(d)
  date.setTime(date.getTime() + date.getTimezoneOffset() * 60 * 1000)
  return date
}

export const getNiceDateTickValues = ({ tickValues, scale }) => {
  try {
    if (tickValues?.length < 2) {
      // Can not make nice labels with only 1 tick
      return tickValues
    }

    const { minValue, maxValue } = scale

    if (minValue === undefined || maxValue === undefined) {
      throw new Error('Tried to make nice labels but max/min values were not provided')
    }

    const minSeconds = getEpochFromDate(minValue)
    const maxSeconds = getEpochFromDate(maxValue)

    if (!minSeconds || !maxSeconds) {
      throw new Error('Tried to make nice labels but could not convert min and max dates to epoch')
    }

    const newTickValues = [...tickValues]
    const tickRange = getEpochFromDate(tickValues[1]) - getEpochFromDate(tickValues[0])

    const dayjsPrecision = DAYJS_PRECISION_FORMATS[scale?.column?.precision]
    const minTickValue = getEpochFromDate(tickValues[0], dayjsPrecision, 'start')
    const maxTickValue = getEpochFromDate(tickValues[tickValues.length - 1], dayjsPrecision, 'end')

    if (!tickRange || isNaN(minTickValue) || isNaN(maxTickValue)) {
      throw new Error('Tried to make nice labels but could not convert tick values to epoch')
    }

    let newMinTickValue = minTickValue
    let newMaxTickValue = maxTickValue
    if (minSeconds < minTickValue) {
      newMinTickValue = minTickValue - tickRange
      newTickValues.unshift(DateUTC(newMinTickValue))
    }

    if (maxSeconds > maxTickValue) {
      newMaxTickValue = maxTickValue + tickRange
      newTickValues.push(DateUTC(newMaxTickValue))
    }

    scale.domain([DateUTC(newTickValues[0]), DateUTC(newTickValues[newTickValues.length - 1])])
    return newTickValues
  } catch (error) {
    console.error(error)
    return tickValues
  }
}

export const getNiceTickValues = ({ tickValues, scale }) => {
  const { minValue, maxValue } = scale

  if (minValue === undefined || maxValue === undefined) {
    console.warn('Tried to make nice labels but max/min values were not provided')
    return tickValues
  } else if (tickValues?.length === 1) {
    // Could not make nice labels because there was only 1 tick
    return tickValues
  }

  const newTickValues = [...tickValues]

  try {
    const minTickValue = tickValues[0]
    const maxTickValue = tickValues[tickValues.length - 1]
    const tickRange = Math.abs(tickValues[1] - tickValues[0])

    let newMinTickValue = minTickValue
    let newMaxTickValue = maxTickValue

    if (minValue < minTickValue) {
      newMinTickValue = minTickValue - tickRange
      newTickValues.unshift(newMinTickValue)
    }

    if (maxValue > maxTickValue) {
      newMaxTickValue = maxTickValue + tickRange
      newTickValues.push(newMaxTickValue)
    }

    scale.domain([newTickValues[0], newTickValues[newTickValues.length - 1]])
  } catch (error) {
    console.error(error)
  }

  return newTickValues
}

export const getTickSizeFromNumTicks = ({
  scale,
  numTicks,
  innerPadding = DEFAULT_INNER_PADDING,
  outerPadding = DEFAULT_OUTER_PADDING,
}) => {
  const fontSize = 12
  const rangeStart = scale?.range()?.[1] ?? 0
  const rangeEnd = scale?.range()?.[0] ?? 0
  const fullSize = Math.abs(rangeEnd - rangeStart) + fontSize

  if (scale.type !== 'BAND') {
    const tickSize = fullSize / numTicks
    return tickSize
  }

  const tickSizeWithoutPadding = fullSize / (2 * outerPadding + numTicks + (numTicks + 1) * innerPadding)
  const tickSizeWithInnerPadding = tickSizeWithoutPadding + innerPadding * tickSizeWithoutPadding

  return tickSizeWithInnerPadding
}

export const getTickValues = ({ scale, initialTicks, props, numTicks, innerPadding, outerPadding }) => {
  try {
    let tickValues = scale.tickLabels
    if (initialTicks) {
      tickValues = [...initialTicks]
    } else if (typeof scale?.ticks === 'function') {
      tickValues = scale.ticks(numTicks)
    }

    const tickSize = getTickSizeFromNumTicks({ scale, numTicks: tickValues?.length, innerPadding, outerPadding })

    if (!tickValues) {
      console.error('Unable to set tick labels for scale. tickValues is undefined')
      return
    }

    const fontSize = 12
    const minimumTickSize = 20
    const fullSize = (Math.abs(scale?.range()?.[1] - scale?.range()?.[0]) ?? 1) + fontSize
    const interval = Math.ceil((tickValues.length * minimumTickSize) / fullSize)

    let newTickValues = [...tickValues]

    if (tickSize < minimumTickSize) {
      // We only want to do this if we dont already want a specific number
      // of ticks (numTicks) since it will change the number of ticks
      newTickValues = []

      // We want to do this in the reverse direction so the highest value is always included
      tickValues.forEach((label, index) => {
        if (index % interval === 0) {
          newTickValues.push(label)
        }
      })
    }

    if (scale?.type === 'LINEAR' || scale?.type === 'BIN') {
      return getNiceTickValues({
        tickValues: newTickValues,
        scale,
        props,
      })
    } else if (scale?.type === 'TIME') {
      return getNiceDateTickValues({
        tickValues: newTickValues,
        scale,
        props,
      })
    }

    return newTickValues
  } catch (error) {
    console.error(error)
  }

  return initialTicks || []
}

export const mergeBboxes = (boundingBoxes) => {
  const filteredBBoxes = boundingBoxes.filter((bbox) => !!bbox)

  if (!filteredBBoxes?.length) {
    return undefined
  }

  try {
    let minLeft
    let maxBottom
    let maxRight
    let minTop

    filteredBBoxes.forEach(({ left, bottom, right, top } = {}) => {
      if (isNaN(left) || isNaN(bottom) || isNaN(right) || isNaN(top)) {
        return
      }

      const width = right - left
      const height = bottom - top

      if (width <= 0 && height <= 0) {
        return
      }

      if (minLeft === undefined || left < minLeft) minLeft = left
      if (maxBottom === undefined || bottom > maxBottom) maxBottom = bottom
      if (maxRight === undefined || right > maxRight) maxRight = right
      if (minTop === undefined || top < minTop) minTop = top
    })

    return { x: minLeft, y: minTop, height: Math.abs(maxBottom - minTop), width: Math.abs(maxRight - minLeft) }
  } catch (error) {
    console.error(error)
    return undefined
  }
}
