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
  const dollarAmtIndices = []
  const quantityIndices = []
  const ratioIndices = []

  columns.forEach((col, index) => {
    const { type } = col
    if (col.is_visible && !col.pivot) {
      if (type === 'DOLLAR_AMT') {
        dollarAmtIndices.push(index)
      } else if (type === 'QUANTITY') {
        quantityIndices.push(index)
      } else if (type === 'PERCENT' || type === 'RATIO') {
        ratioIndices.push(index)
      }
    }
  })

  let numberColumnIndices
  let numberColumnIndex
  let numberColumnIndices2
  let numberColumnIndex2

  // Returning highest priority of non-empty arrays
  if (dollarAmtIndices.length) {
    if (!numberColumnIndices) {
      numberColumnIndices = dollarAmtIndices
      numberColumnIndex = dollarAmtIndices[0]
    } else if (!numberColumnIndices2) {
      numberColumnIndices2 = dollarAmtIndices
      numberColumnIndex2 = dollarAmtIndices[0]
    }
  }

  if (quantityIndices.length) {
    if (!numberColumnIndices) {
      numberColumnIndices = quantityIndices
      numberColumnIndex = quantityIndices[0]
    } else if (!numberColumnIndices2) {
      numberColumnIndices2 = quantityIndices
      numberColumnIndex2 = quantityIndices[0]
    }
  }

  if (ratioIndices.length) {
    if (!numberColumnIndices) {
      numberColumnIndices = ratioIndices
      numberColumnIndex = ratioIndices[0]
    } else if (!numberColumnIndices2) {
      numberColumnIndices2 = ratioIndices
      numberColumnIndex2 = ratioIndices[0]
    }
  }

  return {
    numberColumnIndices: numberColumnIndices ?? [],
    numberColumnIndex: numberColumnIndex ?? undefined,
    numberColumnIndices2: numberColumnIndices2 ?? [],
    numberColumnIndex2: numberColumnIndex2 ?? undefined,
    dollarAmtIndices,
    quantityIndices,
    ratioIndices,
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
