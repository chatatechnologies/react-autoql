import _get from 'lodash.get'

export const isColumnNumberType = (col) => {
  const { type } = col
  return (
    type === 'DOLLAR_AMT' ||
    type === 'QUANTITY' ||
    type === 'PERCENT' ||
    type === 'RATIO'
  )
}

export const isColumnStringType = (col) => {
  const { type } = col
  return type === 'STRING' || type === 'DATE_STRING' || type === 'DATE'
}

export const isColumnDateType = (col) => {
  return col.type === 'DATE' || col.type === 'DATE_STRING'
}

export const getNumberColumnIndices = (columns) => {
  const dollarAmtIndices = []
  const quantityIndices = []
  const ratioIndices = []

  columns.forEach((col, index) => {
    const { type } = col
    if (type === 'DOLLAR_AMT') {
      dollarAmtIndices.push(index)
    } else if (type === 'QUANTITY') {
      quantityIndices.push(index)
    } else if (type === 'PERCENT' || type === 'RATIO') {
      ratioIndices.push(index)
    }
  })

  // Returning highest priority of non-empty arrays
  if (dollarAmtIndices.length) {
    return {
      numberColumnIndices: dollarAmtIndices,
      numberColumnIndex: dollarAmtIndices[0],
    }
  }

  if (quantityIndices.length) {
    return {
      numberColumnIndices: quantityIndices,
      numberColumnIndex: dquantityIndices[0],
    }
  }

  if (ratioIndices.length) {
    return {
      numberColumnIndices: ratioIndices,
      numberColumnIndex: ratioIndices[0],
    }
  }

  return {
    numberColumnIndices: [],
    numberColumnIndex: undefined,
  }
}

export const hasMultiSeriesColumn = (columns) => {
  const multiSeriesIndex = columns.findIndex((col) => col.multi_series === true)

  return multiSeriesIndex >= 0
}

export const getMultiSeriesColumnIndex = (columns) => {
  return columns.findIndex((col) => col.multi_series === true)
}

export const getDateColumnIndex = (columns) => {
  return columns.findIndex(
    (col) => col.type === 'DATE' || col.type === 'DATE_STRING'
  )
}

export const getStringColumnIndices = (columns, supportsPivot) => {
  if (!columns) {
    return undefined
  }

  const multiSeriesIndex = getMultiSeriesColumnIndex(columns)
  const dateColumnIndex = getDateColumnIndex(columns)
  const stringColumnIndices = []

  columns.forEach((col, index) => {
    if (
      (isColumnStringType(col) || col.groupable) &&
      index !== multiSeriesIndex
    ) {
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
    stringColumnIndex = isDateColumnGroupable
      ? dateColumnIndex
      : columns.findIndex((col) => col.groupable)
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
    if (isColumnNumberType(col)) {
      amountOfNumberColumns += 1
    } else if (isColumnStringType(col)) {
      amountOfStringColumns += 1
    }
  })

  return { amountOfNumberColumns, amountOfStringColumns }
}
