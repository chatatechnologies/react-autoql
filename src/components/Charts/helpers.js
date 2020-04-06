import { max, min } from 'd3-array'

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
