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

    const maxValue = max(maxValuesFromArrays)
    let minValue = min(minValuesFromArrays)

    return {
      minValue,
      maxValue
    }
  } catch (error) {
    console.error(error)
    return { minValue: 0, maxValue: 0 }
  }
}
