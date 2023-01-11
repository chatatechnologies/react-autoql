import _get from 'lodash.get'

export const isAggregation = (columns) => {
  try {
    let isAgg = false
    if (columns) {
      isAgg = !!columns.find((col) => col.groupable)
    }
    return isAgg
  } catch (error) {
    console.error(error)
    return false
  }
}

export const isColumnNumberType = (col) => {
  const type = col?.type

  return type === 'DOLLAR_AMT' || type === 'QUANTITY' || type === 'PERCENT' || type === 'RATIO'
}

export const isColumnStringType = (col) => {
  const type = col?.type
  return type === 'STRING' || type === 'DATE_STRING' || type === 'DATE'
}

export const isColumnDateType = (col) => {
  try {
    const isDateType = col.type === 'DATE' || col.type === 'DATE_STRING'
    return isDateType
  } catch (error) {
    return false
  }
}

export const getNumberColumnIndices = (columns) => {
  const currencyColumnIndices = []
  const quantityColumnIndices = []
  const ratioColumnIndices = []

  columns.forEach((col, index) => {
    const { type } = col
    if (col.is_visible && !col.pivot) {
      if (type === 'DOLLAR_AMT') {
        currencyColumnIndices.push(index)
      } else if (type === 'QUANTITY') {
        quantityColumnIndices.push(index)
      } else if (type === 'PERCENT' || type === 'RATIO') {
        ratioColumnIndices.push(index)
      }
    }
  })

  let allNumberColumnIndices = []

  // Returning highest priority of non-empty arrays
  if (currencyColumnIndices.length) {
    allNumberColumnIndices = currencyColumnIndices
  } else if (quantityColumnIndices.length) {
    allNumberColumnIndices = quantityColumnIndices
  } else if (ratioColumnIndices.length) {
    allNumberColumnIndices = ratioColumnIndices
  }

  const numberColumnIndex = allNumberColumnIndices[0]
  const numberColumnIndices = !isNaN(numberColumnIndex) ? [numberColumnIndex] : []

  return {
    numberColumnIndex,
    numberColumnIndices,
    numberColumnIndices2: [],
    numberColumnIndex2: undefined,
    currencyColumnIndices: currencyColumnIndices ?? [],
    currencyColumnIndex: currencyColumnIndices[0],
    quantityColumnIndices: quantityColumnIndices ?? [],
    quantityColumnIndex: quantityColumnIndices[0],
    ratioColumnIndices: ratioColumnIndices ?? [],
    ratioColumnIndex: ratioColumnIndices[0],
  }
}

export const shouldPlotMultiSeries = (columns) => {
  if (isAggregation(columns)) {
    return false
  }

  const multiSeriesIndex = columns.findIndex((col) => col.multi_series === true)
  return multiSeriesIndex >= 0
}

export const getMultiSeriesColumnIndex = (columns) => {
  if (!columns || !shouldPlotMultiSeries(columns)) {
    return undefined
  }

  return columns.findIndex((col) => col && col.is_visible && col.multi_series === true)
}

export const getDateColumnIndex = (columns) => {
  return columns.findIndex((col) => col.is_visible && (col.type === 'DATE' || col.type === 'DATE_STRING'))
}

export const getStringColumnIndices = (columns, supportsPivot) => {
  if (!columns) {
    return undefined
  }

  const drilldownIndex = columns.findIndex((col) => col.isDrilldownColumn)
  if (drilldownIndex >= 0) {
    return {
      stringColumnIndices: [drilldownIndex],
      stringColumnIndex: drilldownIndex,
    }
  }

  const multiSeriesIndex = getMultiSeriesColumnIndex(columns)
  const dateColumnIndex = getDateColumnIndex(columns)
  const stringColumnIndices = []

  columns.forEach((col, index) => {
    if ((isColumnStringType(col) || col.groupable) && index !== multiSeriesIndex && col.is_visible) {
      stringColumnIndices.push(index)
    }
  })

  // We will usually want to take the second column because the first one
  // will most likely have all of the same value. Grab the first column only
  // if it's the only string column
  let stringColumnIndex = stringColumnIndices[0]
  if (supportsPivot) {
    // Use date column if its a groupable, otherwise use first groupable column
    const isDateColumnGroupable = _get(columns[dateColumnIndex], 'groupable')
    stringColumnIndex = isDateColumnGroupable ? dateColumnIndex : columns.findIndex((col) => col.groupable)
  } else if (dateColumnIndex >= 0) {
    stringColumnIndex = dateColumnIndex
  } else if (stringColumnIndices[1] >= 0) {
    stringColumnIndex = stringColumnIndices[1]
  }

  return { stringColumnIndex, stringColumnIndices }
}

export const getColumnTypeAmounts = (columns) => {
  let amountOfStringColumns = 0
  let amountOfNumberColumns = 0

  columns.forEach((col) => {
    if (isColumnNumberType(col) && col.is_visible) {
      amountOfNumberColumns += 1
    } else if (isColumnStringType(col) && col.is_visible) {
      amountOfStringColumns += 1
    }
  })

  return { amountOfNumberColumns, amountOfStringColumns }
}
