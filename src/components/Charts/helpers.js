import PropTypes from 'prop-types'
import { max, min, ticks } from 'd3-array'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import { scaleLinear, scaleBand } from 'd3-scale'

import { formatChartLabel, formatElement } from '../../js/Util'
import { dataFormattingType } from '../../props/types'
import { dataFormattingDefault } from '../../props/defaults'
import { AGG_TYPES } from '../../js/Constants'

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
  innerHeight: PropTypes.number.isRequired,
  innerWidth: PropTypes.number.isRequired,
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
  xCol: PropTypes.shape({}).isRequired,
  yCol: PropTypes.shape({}).isRequired,
  xTicks: PropTypes.array,
  yTicks: PropTypes.array,
  xGridLines: PropTypes.bool,
  yGridLines: PropTypes.bool,
  rotateLabels: PropTypes.bool,
  hasRightLegend: PropTypes.bool,
  hasBottomLegend: PropTypes.bool,
  hasXDropdown: PropTypes.bool,
  hasYDropdown: PropTypes.bool,
  xAxisTitle: PropTypes.string,
  yAxisTitle: PropTypes.string,
  legendTitle: PropTypes.string,
}

export const axesDefaultProps = {
  ...chartDefaultProps,
  xTicks: undefined,
  yTicks: undefined,
  xGridLines: false,
  yGridLines: false,
  rotateLabels: false,
  hasRightLegend: false,
  hasBottomLegend: false,
  hasXDropdown: false,
  hasYDropdown: false,
  xAxisTitle: undefined,
  yAxisTitle: undefined,
  legendTitle: undefined,
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

export const getKey = (rowIndex, cellIndex) => {
  return `${rowIndex}-${cellIndex}`
}

export const shouldRecalculateLongestLabel = (prevProps, props) => {
  return (
    props.marginAdjustmentFinished &&
    (prevProps?.data?.length !== props.data?.length ||
      !_isEqual(prevProps.numberColumnIndices, props.numberColumnIndices) ||
      !_isEqual(prevProps.legendLabels, props.legendLabels) ||
      prevProps.stringColumnIndex !== props.stringColumnIndex)
  )
}

export const getTooltipContent = ({ row, columns, colIndex, stringColumnIndex, legendColumn, dataFormatting }) => {
  let tooltipElement = null
  try {
    const stringColumn = columns[stringColumnIndex]
    const numberColumn = columns[colIndex]

    const stringTitle = stringColumn.title
    let numberTitle = numberColumn.origColumn ? numberColumn.origColumn.title : numberColumn.title
    const aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === numberColumn.aggType)?.displayName
    if (aggTypeDisplayName) {
      numberTitle = `${numberTitle} (${aggTypeDisplayName})`
    }

    const stringValue = formatElement({
      element: row[stringColumnIndex],
      column: stringColumn,
      config: dataFormatting,
      isChart: true,
    })

    const numberValue = formatElement({
      element: row[colIndex] || 0,
      column: columns[colIndex],
      config: dataFormatting,
      isChart: true,
    })

    const column = columns[colIndex]
    const tooltipLine1 =
      !!legendColumn && !!column?.origColumn ? `<div><strong>${legendColumn.title}:</strong> ${column.title}</div>` : ''
    const tooltipLine2 = `<div><strong>${stringTitle}:</strong> ${stringValue}</div>`
    const tooltipLine3 = `<div><strong>${numberTitle}:</strong> ${numberValue}</div>`

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
    if (numberColumnIndices.length < 1) {
      return []
    }

    const numberColumns = numberColumnIndices.map((index) => columns[index])
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
        color: colorScale(i),
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
    return 0
  }
}

export const calculateMinAndMaxSums = (data, stringColumnIndex, numberColumnIndices) => {
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
  const maxValue = getMaxValueFromKeyValueObj(positiveSumsObject)
  const minValue = getMinValueFromKeyValueObj(negativeSumsObject)

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

export const getMinAndMaxValues = (data, numberColumnIndices, isChartScaled) => {
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
    const isDisableChartScale = !isChartScaled || (maxValue > 0 && minValue < 0) || scaleRatio > 1000

    if (isDisableChartScale) {
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

export const getLegendLocation = (seriesArray, displayType) => {
  if (seriesArray?.length < 2) {
    return undefined
  }

  if (displayType === 'pie' || displayType === 'heatmap' || displayType === 'bubble') {
    return undefined
  } else if (displayType === 'stacked_column' || displayType === 'stacked_bar' || displayType === 'stacked_line') {
    return 'right'
  } else if (_get(seriesArray, 'length') > 2) {
    return 'right'
  } else if (_get(seriesArray, 'length') > 1) {
    return 'right'
    // Todo: the margins are not working correctly, disable this for now
    // return 'bottom'
  }

  return undefined
}

export const getBandScales = ({ props, columnIndex, axis }) => {
  const scale = getBandScale({ props, columnIndex, axis })
  const scale2 = getBandScale({ props, columnIndex, axis })
  return { scale, scale2 }
}

export const getRangeForAxis = (props, axis) => {
  let rangeStart
  let rangeEnd
  if (axis === 'x') {
    rangeStart = 0
    const innerWidth = props.width - props.deltaX
    rangeEnd = rangeStart + innerWidth
    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart
    }
  } else if (axis === 'y') {
    const innerHeight = props.height
    rangeEnd = 0
    rangeStart = rangeEnd + innerHeight

    if (rangeStart < rangeEnd) {
      rangeStart = rangeEnd
    }
  }

  return [rangeStart, rangeEnd]
}

export const getBandScale = ({ props, columnIndex, axis }) => {
  const range = getRangeForAxis(props, axis)
  const domain = props.data.map((d) => d[columnIndex])

  const scale = scaleBand()
    .domain(domain)
    .range(range)
    .paddingInner(props.innerPadding)
    .paddingOuter(props.outerPadding)

  scale.type = 'BAND'
  scale.tickLabels = getTickValues({ scale, props, axis, initialTicks: domain })
  scale.tickSizePx = getTickSize(props, scale)

  return scale
}

export const getLinearScale = ({ props, minValue, maxValue, axis, tickValues, numTicks }) => {
  const range = getRangeForAxis(props, axis)
  const min = minValue ?? tickValues?.[0] ?? 0
  const max = maxValue ?? tickValues?.[tickValues?.length - 1] ?? min
  const domain = [min, max]

  const scale = scaleLinear().domain(domain).range(range)
  scale.minValue = min
  scale.maxValue = max
  scale.type = 'LINEAR'

  if (tickValues) {
    scale.tickLabels = [...tickValues]
    scale.ticks(tickValues)
  } else {
    const niceTickValues = getTickValues({
      props,
      axis,
      scale,
      numTicks,
    })

    scale.tickLabels = [...niceTickValues]
    scale.ticks(niceTickValues)
  }

  const tickSizePx = getTickSize(props, scale, tickValues)
  scale.tickSizePx = tickSizePx

  return scale
}

export const getLinearScales = ({ props, columnIndices1, columnIndices2, axis }) => {
  const minMax = getMinAndMaxValues(props.data, columnIndices1, props.isChartScaled)
  const minValue = minMax.minValue
  const maxValue = minMax.maxValue
  const tempScale1 = getLinearScale({ props, minValue, maxValue, axis })

  if (!columnIndices2?.length) {
    return {
      scale: tempScale1,
    }
  }

  // If there are 2 y axes, we need to line up the number of ticks and their values
  const minMax2 = getMinAndMaxValues(props.data, columnIndices2, props.isChartScaled)
  const minValue2 = minMax2.minValue
  const maxValue2 = minMax2.maxValue

  const tempScale2 = getLinearScale({
    props,
    minValue: minValue2,
    maxValue: maxValue2,
    axis,
    numTicks: tempScale1.tickLabels?.length ?? undefined,
  })

  const tickValues1 = tempScale1.tickLabels
  const tickValues2 = tempScale2.tickLabels

  const numTickValues1 = tickValues1?.length
  const numTickValues2 = tickValues2?.length

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

  const scale = getLinearScale({ props, axis, tickValues: newTickValues1 })
  const scale2 = getLinearScale({ props, axis, tickValues: newTickValues2 })

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

export const getNiceTickValues = ({ tickValues, scale, props }) => {
  const { minValue, maxValue } = scale

  if (minValue === undefined || maxValue === undefined) {
    console.warn('Tried to make nice labels but max/min values were not provided')
    return tickValues
  } else if (tickValues?.length < 2) {
    // Could not make nice labels because there was only 1 tick
    return tickValues
  }

  const newTickValues = [...tickValues]

  try {
    const minTickValue = tickValues[0]
    const maxTickValue = tickValues[tickValues.length - 1]
    const tickSize = Math.abs(tickValues[1] - tickValues[0])

    let newMinTickValue = minTickValue
    let newMaxTickValue = maxTickValue

    if (minValue < minTickValue) {
      newMinTickValue = minTickValue - tickSize
      newTickValues.unshift(newMinTickValue)
    }

    if (maxValue > maxTickValue) {
      newMaxTickValue = maxTickValue + tickSize
      newTickValues.push(newMaxTickValue)
    }

    scale.domain([newTickValues[0], newTickValues[newTickValues.length - 1]])
    scale.ticks(newTickValues)
    const tickSizePx = getTickSize(props, scale, newTickValues)
    scale.tickSizePx = tickSizePx
  } catch (error) {
    console.error(error)
  }

  return newTickValues
}

export const getTickSize = (props, scale, tickValues) => {
  let numTicks = 1
  if (tickValues) {
    numTicks = tickValues.length
  } else if (scale.tickLabels) {
    numTicks = scale.tickLabels?.length
  }

  const rangeStart = scale?.range()?.[1] ?? 0
  const rangeEnd = scale?.range()?.[0] ?? 0
  const fullSize = Math.abs(rangeEnd - rangeStart)

  const tickSizeWithoutPadding = fullSize / (2 * props.outerPadding + numTicks + (numTicks + 1) * props.innerPadding)
  const tickSizeWithInnerPadding = tickSizeWithoutPadding + props.innerPadding * tickSizeWithoutPadding

  return tickSizeWithInnerPadding
}

export const getTickValues = ({ scale, initialTicks, props, axis, numTicks }) => {
  try {
    let ticksArray
    if (initialTicks) {
      ticksArray = [...initialTicks]
    } else if (scale?.ticks && typeof scale.ticks === 'function') {
      ticksArray = scale.ticks(numTicks)
    }

    if (!ticksArray) {
      return []
    }

    const tickSizePx = getTickSize(props, scale, initialTicks)
    const minTextHeightInPx = 16

    const fullSize = Math.abs(scale?.range()?.[1] - scale?.range()?.[0]) ?? 1
    const interval = Math.ceil((ticksArray.length * minTextHeightInPx) / fullSize)

    let tickValues = [...ticksArray]
    if (tickSizePx < minTextHeightInPx) {
      tickValues = []

      // We want to do this in the reverse direction so the highest value is always included
      ticksArray.forEach((label, index) => {
        if (index % interval === 0) {
          tickValues.push(label)
        }
      })
    }

    if (scale?.type === 'LINEAR') {
      tickValues = getNiceTickValues({
        tickValues: [...tickValues],
        scale,
        props,
      })
    }

    return tickValues
  } catch (error) {
    console.error(error)
  }

  return initialTicks || []
}

export const mergeBboxes = (boundingBoxes) => {
  let minLeft
  let maxBottom
  let maxRight
  let minTop

  boundingBoxes.forEach(({ left, bottom, right, top }) => {
    if (minLeft === undefined || left < minLeft) minLeft = left
    if (maxBottom === undefined || bottom > maxBottom) maxBottom = bottom
    if (maxRight === undefined || right > maxRight) maxRight = right
    if (minTop === undefined || top < minTop) minTop = top
  })

  return { x: minLeft, y: minTop, height: Math.abs(maxBottom - minTop), width: Math.abs(maxRight - minLeft) }
}
