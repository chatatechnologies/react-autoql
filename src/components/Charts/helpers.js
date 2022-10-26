import PropTypes from 'prop-types'
import { max, min } from 'd3-array'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { formatElement } from '../../js/Util'
import { dataFormattingType } from '../../props/types'
import { dataFormattingDefault } from '../../props/defaults'

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
  leftMargin: PropTypes.number,
  rightMargin: PropTypes.number,
  topMargin: PropTypes.number,
  bottomMargin: PropTypes.number,
}

export const chartDefaultProps = {
  ...chartContainerDefaultProps,
  leftMargin: 0,
  rightMargin: 0,
  topMargin: 0,
  bottomMargin: 0,
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
    const numberTitle = numberColumn.origColumn ? numberColumn.origColumn.title : numberColumn.title

    const stringValue = formatElement({
      element: row[stringColumnIndex],
      column: stringColumn,
      config: dataFormatting,
    })

    const numberValue = formatElement({
      element: row[colIndex] || 0,
      column: columns[colIndex],
      config: dataFormatting,
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

// export const getLegendLabelsForMultiSeries = (
//   data,
//   columns,
//   legendColumnIndex,
//   colorScale
// ) => {
//   if (isNaN(legendColumnIndex)) {
//     return undefined
//   }

//   try {
//     const labelArray = data.map((r) => r[legendColumnIndex])
//     const uniqueLabels = [...new Set(labelArray)]
//     const legendLabels = {}
//     uniqueLabels.forEach((label, i) => {
//       legendLabels[label] = {
//         color: colorScale(i),
//         hidden: columns[columnIndex].isSeriesHidden,
//       }
//     })
//     return uniqueLabels
//   } catch (error) {
//     console.error(error)
//     return []
//   }
// }

export const getLegendLabelsForMultiSeries = (columns, colorScale, numberColumnIndices = []) => {
  try {
    if (numberColumnIndices.length < 1) {
      return []
    }

    const legendLabels = numberColumnIndices.map((columnIndex, i) => {
      const column = columns[columnIndex]
      return {
        label: column.title,
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

export const getMinAndMaxValues = (data, numberColumnIndices) => {
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
    // if (maxValue === minValue) {
    //   if (minValue > 0) {
    //     minValue = 0
    //   } else if (maxValue < 0) {
    //     maxValue = 0
    //   }
    // }

    // Always show 0 on the y axis
    // Keep this for future use
    if (maxValue > 0 && minValue > 0) {
      minValue = 0
    } else if (maxValue < 0 && minValue < 0) {
      maxValue = 0
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

export const getNiceTickValues = ({ tickValues, scale }) => {
  const { minValue, maxValue } = scale
  if (minValue === undefined || maxValue === undefined) {
    console.warn('Tried to make nice labels but max/min values were not provided')
    return tickValues
  } else if (tickValues?.length < 2) {
    // Could not make nice labels because there was only 1 tick
    return tickValues
  }

  try {
    const minTickValue = tickValues[0]
    const maxTickValue = tickValues[tickValues.length - 1]
    const tickSize = Math.abs(tickValues[1] - tickValues[0])
    const newTickValues = [...tickValues]

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

    scale.domain([newMinTickValue, newMaxTickValue])
    return newTickValues
  } catch (error) {
    return tickValues
  }
}

export const getTickValues = ({ tickHeight, fullHeight, labelArray, scale }) => {
  try {
    const minTextHeightInPx = 16
    const interval = Math.ceil((labelArray.length * minTextHeightInPx) / fullHeight)

    let tickValues = labelArray
    if (tickHeight < minTextHeightInPx) {
      tickValues = []

      // We want to do this in the reverse direction so the highest value is always included
      labelArray.forEach((label, index) => {
        if (index % interval === 0) {
          tickValues.push(label)
        }
      })
    }

    if (scale?.type === 'LINEAR') {
      tickValues = getNiceTickValues({
        tickValues,
        scale,
      })
    }

    return tickValues
  } catch (error) {
    console.error(error)
  }

  return labelArray
}
