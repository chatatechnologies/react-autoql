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
  return type === 'STRING' || type === 'DATE_STRING' || type === 'DATE' || type === 'UNKNOWN'
}

export const isColumnDateType = (col) => {
  try {
    const isDateType = col.type === 'DATE' || col.type === 'DATE_STRING'
    return isDateType
  } catch (error) {
    return false
  }
}

export const getNumberColumnIndices = (columns, isPivot) => {
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

  let numberColumnIndex
  let numberColumnIndices = []
  let numberColumnIndex2
  let numberColumnIndices2 = []
  let numberColumnIndexType

  // Returning highest priority of non-empty arrays
  if (currencyColumnIndices.length) {
    numberColumnIndex = currencyColumnIndices[0]
    numberColumnIndices = currencyColumnIndices
    numberColumnIndexType = 'currency'
  } else if (quantityColumnIndices.length) {
    numberColumnIndex = quantityColumnIndices[0]
    numberColumnIndices = quantityColumnIndices
    numberColumnIndexType = 'quantity'
  } else if (ratioColumnIndices.length) {
    numberColumnIndex = ratioColumnIndices[0]
    numberColumnIndices = ratioColumnIndices
    numberColumnIndexType = 'ratio'
  }

  if (!isPivot) {
    numberColumnIndices = [numberColumnIndex]

    if (numberColumnIndexType === 'currency') {
      if (quantityColumnIndices.length) {
        numberColumnIndex2 = quantityColumnIndices[0]
      } else if (ratioColumnIndices.length) {
        numberColumnIndex2 = ratioColumnIndices[0]
      } else if (currencyColumnIndices.length > 1) {
        numberColumnIndex2 = currencyColumnIndices[1]
      }
    } else if (numberColumnIndexType === 'quantity') {
      if (ratioColumnIndices.length) {
        numberColumnIndex2 = ratioColumnIndices[0]
      } else if (quantityColumnIndices.length > 1) {
        numberColumnIndex2 = quantityColumnIndices[1]
      }
    } else if (numberColumnIndexType === 'ratio' && quantityColumnIndices.length > 1) {
      numberColumnIndex2 = ratioColumnIndices[1]
    }

    if (!isNaN(numberColumnIndex2)) {
      numberColumnIndices2 = [numberColumnIndex2]
    }
  }

  return {
    numberColumnIndex,
    numberColumnIndices,
    numberColumnIndices2,
    numberColumnIndex2,
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

  const stringColumnIndices = []
  const multiSeriesIndex = getMultiSeriesColumnIndex(columns)
  const dateColumnIndex = getDateColumnIndex(columns)

  columns.forEach((col, index) => {
    if ((isColumnStringType(col) || col.groupable) && index !== multiSeriesIndex && col.is_visible) {
      stringColumnIndices.push(index)
    }
  })

  const drilldownIndex = columns.findIndex((col) => col.isDrilldownColumn)
  if (drilldownIndex >= 0) {
    return {
      stringColumnIndices,
      stringColumnIndex: drilldownIndex,
    }
  }

  // We will usually want to take the second column because the first one
  // will most likely have all of the same value. Grab the first column only
  // if it's the only string column
  let stringColumnIndex = stringColumnIndices[0]
  if (supportsPivot) {
    // Use date column if its a groupable, otherwise use first groupable column
    const isDateColumnGroupable = columns[dateColumnIndex]?.groupable
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
