import _sortBy from 'lodash.sortby'
import _cloneDeep from 'lodash.clonedeep'
import { sum, mean, count, deviation, variance, median, min, max } from 'd3-array'

import { formatChartLabel, onlyUnique } from '../../../js/Util.js'
import { DEFAULT_AGG_TYPE } from '../../../js/Constants'

const getLabelFromRow = ({ row, index, columns, dataFormatting }) => {
  const column = columns[index]

  let label
  if (row) {
    label = formatChartLabel({ d: row[index], column, dataFormatting })?.fullWidthLabel ?? row[index]
  }
  return label
}

const addValuesToAggDataset = ({ numberIndices, columns, datasetsToAggregate, row }) => {
  numberIndices.filter(onlyUnique).forEach((index) => {
    const column = columns[index]
    if (column.visible) {
      const value = Number(row[index])
      if (datasetsToAggregate[index]) {
        datasetsToAggregate[index].push(value)
      } else {
        datasetsToAggregate[index] = [value]
      }
    }
  })
}

const aggregateFn = (dataset, aggType) => {
  switch (aggType) {
    case 'avg': {
      return mean(dataset)
    }
    case 'median': {
      return median(dataset)
    }
    case 'min': {
      return min(dataset)
    }
    case 'max': {
      return max(dataset)
    }
    case 'deviation': {
      return deviation(dataset)
    }
    case 'variance': {
      return variance(dataset)
    }
    case 'count': {
      return count(dataset)
    }
    case 'count-distinct': {
      const uniqueDataset = dataset.filter(onlyUnique)
      return count(uniqueDataset)
    }
    default: {
      // SUM by default
      return sum(dataset)
    }
  }
}

const aggregateRow = (row, datasetsToAggregate, columns) => {
  const newRow = _cloneDeep(row)
  Object.keys(datasetsToAggregate).forEach((index) => {
    const aggregateType = columns[index].aggType || DEFAULT_AGG_TYPE
    newRow[index] = aggregateFn(datasetsToAggregate[index], aggregateType)
  })
  return newRow
}

export const aggregateData = ({ data, aggColIndex, columns, numberIndices, dataFormatting }) => {
  if (!data?.length) {
    return data
  }

  const validatedNumberIndices = numberIndices.filter(onlyUnique)

  const aggregatedData = []
  const sortedData = _sortBy(data, (row) => row?.[aggColIndex])

  let prevRow
  let datasetsToAggregate = {}
  sortedData.forEach((row, i) => {
    const currentRow = _cloneDeep(row)
    const isLastRow = i === sortedData.length - 1

    const currentLabel = getLabelFromRow({ row: currentRow, index: aggColIndex, columns, dataFormatting })
    const prevLabel = getLabelFromRow({ row: prevRow, index: aggColIndex, columns, dataFormatting })
    const labelChanged = currentLabel && prevLabel && currentLabel !== prevLabel

    if (labelChanged) {
      // label changed so we will do the aggregation then push the row to the data array
      const newRow = aggregateRow(prevRow, datasetsToAggregate, columns)
      aggregatedData.push(newRow)

      // then we reset the agg set and add the current row to it
      datasetsToAggregate = {}
    }

    addValuesToAggDataset({ numberIndices: validatedNumberIndices, columns, datasetsToAggregate, row: currentRow })
    if (isLastRow) {
      const lastRow = aggregateRow(currentRow, datasetsToAggregate, columns)
      aggregatedData.push(lastRow)
      return
    }

    prevRow = currentRow
    return
  })

  return aggregatedData
}
