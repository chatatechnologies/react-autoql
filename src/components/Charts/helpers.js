import { max, min } from 'd3-array'

export const getLegendLabelsForMultiSeries = (columns, colorScale) => {
  try {
    const legendLabels = columns.slice(1).map((column, i) => {
      return {
        label: column.title,
        color: colorScale(i),
        hidden: column.isSeriesHidden
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

    const maxValue = max(maxValuesFromArrays)
    let minValue = min(minValuesFromArrays)

    // Make sure 0 is always visible on the y axis
    if (minValue > 0) {
      minValue = 0
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
