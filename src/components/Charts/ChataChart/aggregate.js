import _sortBy from 'lodash.sortby'
import _cloneDeep from 'lodash.clonedeep'
import { sum, mean, count, deviation, variance, median, min, max } from 'd3-array'

import { sortDataByDate, formatChartLabel, onlyUnique, getBBoxFromRef } from '../../../js/Util.js'
import { isColumnDateType } from '../../QueryOutput/columnHelpers'
import { DEFAULT_AGG_TYPE } from '../../../js/Constants'

const getLabelFromRow = (row, props) => {
  const { stringColumnIndex, columns } = props
  const stringColumn = columns[stringColumnIndex]

  let label
  if (row) {
    label =
      formatChartLabel({
        d: row[stringColumnIndex],
        col: stringColumn,

        config: props.dataFormatting,
      })?.fullWidthLabel ?? row[stringColumnIndex]
  }
  return label
}

const addValuesToAggDataset = (props, datasetsToAggregate, currentRow) => {
  const { numberColumnIndices, columns } = props
  numberColumnIndices.forEach((columnIndex) => {
    const column = columns[columnIndex]
    if (column.visible) {
      const value = Number(currentRow[columnIndex])
      if (datasetsToAggregate[columnIndex]) {
        datasetsToAggregate[columnIndex].push(value)
      } else {
        datasetsToAggregate[columnIndex] = [value]
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
  Object.keys(datasetsToAggregate).forEach((columnIndex) => {
    const aggregateType = columns[columnIndex].aggType || DEFAULT_AGG_TYPE
    newRow[columnIndex] = aggregateFn(datasetsToAggregate[columnIndex], aggregateType)
  })
  return newRow
}

export const aggregateData = (props) => {
  const { stringColumnIndex, data, columns } = props
  const stringColumn = columns[stringColumnIndex]

  if (!(data?.length > 1)) {
    return data
  }

  let sortedData
  if (isColumnDateType(stringColumn)) {
    sortedData = sortDataByDate(data, columns, 'chart')
  } else {
    sortedData = _sortBy(data, (row) => row?.[stringColumnIndex])
  }

  if (props.isPivot) {
    return sortedData
  }

  const aggregatedData = []

  let prevRow
  let datasetsToAggregate = {}
  sortedData.forEach((row, i) => {
    const currentRow = _cloneDeep(row)
    const isLastRow = i === sortedData.length - 1

    const currentLabel = getLabelFromRow(currentRow, props)
    const prevLabel = getLabelFromRow(prevRow, props)
    const labelChanged = currentLabel && prevLabel && currentLabel !== prevLabel

    if (!labelChanged) {
      addValuesToAggDataset(props, datasetsToAggregate, currentRow)
      if (isLastRow) {
        const newRow = aggregateRow(currentRow, datasetsToAggregate, columns)
        aggregatedData.push(newRow)
        return
      }
    } else if (labelChanged) {
      // label changed so we will do the aggregation then push the row to the data array
      const newRow = aggregateRow(prevRow, datasetsToAggregate, columns)
      aggregatedData.push(newRow)

      if (isLastRow) {
        aggregatedData.push(currentRow)
        return
      }

      // then we reset the agg set and add the current row to it
      datasetsToAggregate = {}
      addValuesToAggDataset(props, datasetsToAggregate, currentRow)
    }

    prevRow = currentRow
    return
  })

  return aggregatedData
}
