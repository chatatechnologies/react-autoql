import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { select } from 'd3-selection'
import { isMobile } from 'react-device-detect'
import { formatElement, AGG_TYPES } from 'autoql-fe-utils'

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
        const aggTypeDisplayName = AGG_TYPES[column1.aggType]?.displayName
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
