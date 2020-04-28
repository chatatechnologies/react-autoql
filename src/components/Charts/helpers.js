import { max, min } from 'd3-array'
import _get from 'lodash.get'
import { nameValueObject } from '../../js/Util'

export const getDrilldownDataFrom3dChart = ({ d = {} }) => {
  const { origColumns } = d

  const [groupBy1Name, groupBy2Name] = [
    origColumns[0].name,
    origColumns[1].name
  ]

  let groupBy1Value = d.labelY
  let groupBy2Value = d.labelX
  if (typeof groupBy1Value !== 'string') {
    groupBy1Value = `${groupBy1Value}`
  }
  if (typeof groupBy2Value !== 'string') {
    groupBy2Value = `${groupBy2Value}`
  }

  const drilldownData = [
    nameValueObject(groupBy1Name, groupBy1Value),
    nameValueObject(groupBy2Name, groupBy2Value)
  ]

  return {
    supportedByAPI: true,
    data: drilldownData
  }
}

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
        hidden: columns[columnIndex].isSeriesHidden
      }
    })

    return legendLabels
  } catch (error) {
    console.error(error)
    return []
  }
}

export const getNumberOfSeries = data => {
  try {
    const numSeries = data[0].cells.length
    return numSeries
  } catch (error) {
    console.error(error)
    return 1
  }
}

export const getMinAndMaxValues = data => {
  try {
    const numSeries = getNumberOfSeries(data)
    const maxValuesFromArrays = []
    const minValuesFromArrays = []

    for (let i = 0; i < numSeries; i++) {
      maxValuesFromArrays.push(max(data, d => d.cells[i].value))
      minValuesFromArrays.push(min(data, d => d.cells[i].value))
    }

    let maxValue = max(maxValuesFromArrays)
    let minValue = min(minValuesFromArrays)

    // In order to see the chart elements we need to make sure
    // that the max and min values are different.
    if (maxValue === minValue) {
      if (minValue > 0) {
        minValue = 0
      } else if (minValue < 0) {
        maxValue = 0
      }
    }

    return {
      minValue,
      maxValue
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
    displayType === 'stacked_bar'
  ) {
    return 'right'
  } else if (_get(seriesArray, 'length') > 3) {
    return 'right'
  } else if (_get(seriesArray, 'length') > 1) {
    return 'bottom'
  }
  return undefined
}
