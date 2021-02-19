import { max, min } from 'd3-array'
import _get from 'lodash.get'

export const getLegendLabelsForMultiSeries = (
  columns,
  colorScale,
  seriesIndices = []
) => {
  try {
    if (seriesIndices.length <= 1) {
      return []
    }

    const legendLabels = seriesIndices.map((columnIndex, i) => {
      return {
        label: columns[columnIndex].title,
        color: colorScale(i),
        hidden: columns[columnIndex].isSeriesHidden,
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

export const getMinAndMaxValues = (data) => {
  try {
    const numSeries = getNumberOfSeries(data)
    const maxValuesFromArrays = []
    const minValuesFromArrays = []

    for (let i = 0; i < numSeries; i++) {
      maxValuesFromArrays.push(max(data, (d) => d.cells[i].value))
      minValuesFromArrays.push(min(data, (d) => d.cells[i].value))
    }

    let maxValue = max(maxValuesFromArrays)
    let minValue = min(minValuesFromArrays)

    // In order to see the chart elements we need to make sure
    // that the max and min values are different.
    if (maxValue === minValue) {
      if (minValue > 0) {
        minValue = 0
      } else if (maxValue < 0) {
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
  if (
    displayType === 'pie' ||
    displayType === 'heatmap' ||
    displayType === 'bubble'
  ) {
    return undefined
  } else if (
    displayType === 'stacked_column' ||
    displayType === 'stacked_bar' ||
    displayType === 'stacked_line'
  ) {
    return 'right'
  } else if (_get(seriesArray, 'length') > 2) {
    return 'right'
  } else if (_get(seriesArray, 'length') > 1) {
    return 'bottom'
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
  if (
    elementBBox.y + elementBBox.height <
    containerBBox.y + containerBBox.height
  ) {
    return true
  }

  // intersects left
  if (elementBBox.x < containerBBox.x) {
    return true
  }

  // intersects right
  if (
    elementBBox.x + elementBBox.width <
    containerBBox.x + containerBBox.width
  ) {
    return true
  }

  return false
}

export const getTickValues = (labelWidth, fullWidth, labelArray) => {
  try {
    const interval = Math.ceil((labelArray.length * 20) / fullWidth)
    let tickValues

    if (labelWidth < 20) {
      tickValues = []
      labelArray.forEach((label, index) => {
        if (index % interval === 0) {
          tickValues.push(label)
        }
      })
    }

    return tickValues
  } catch (error) {
    console.error(error)
    return []
  }
}
