import Numbro from 'numbro'
import dayjs from 'dayjs'
import _get from 'lodash.get'

import {
  MONTH_NAMES,
  CHART_TYPES,
  TABLE_TYPES,
  FORECAST_TYPES
} from './Constants'

export const getParameterByName = (
  parameterName,
  url = window.location.href
) => {
  const processedParameterName = parameterName.replace(/[\[\]]/g, '\\$&')
  const regex = new RegExp(`[?&]${processedParameterName}(=([^&#]*)|&|#|$)`)

  const results = regex.exec(url)
  if (!results) {
    return null
  }
  if (!results[2]) {
    return ''
  }
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export const onlyUnique = (value, index, self) => {
  return self.indexOf(value) === index
}

export const makeEmptyArray = (w, h) => {
  var arr = []
  for (let i = 0; i < h; i++) {
    arr[i] = []
    for (let j = 0; j < w; j++) {
      arr[i][j] = ''
    }
  }
  return arr
}

export const isDayJSDateValid = date => {
  return date !== 'Invalid Date'
}

export const formatEpochDate = (value, col) => {
  // Use title to determine significant digits of date format
  const title = col.title
  let date = dayjs.unix(value).format('MMM D, YYYY')

  if (!Number(value)) {
    // Not an epoch time. Try converting using dayjs
    if (title && title.toLowerCase().includes('year')) {
      date = dayjs(value).format('YYYY')
    } else if (title && title.toLowerCase().includes('month')) {
      date = dayjs(value).format('MMM YYYY')
    }
    date = dayjs(value).format('MMM D, YYYY')
  } else if (title && title.toLowerCase().includes('year')) {
    date = dayjs.unix(value).format('YYYY')
  } else if (title && title.toLowerCase().includes('month')) {
    date = dayjs.unix(value).format('MMM YYYY')
  }

  if (isDayJSDateValid(date)) {
    return date
  }

  return value
}

export const formatStringDate = value => {
  if (value && typeof value === 'string') {
    const dateArray = value.split('-')
    const year = _get(dateArray, '[0]')
    const month = _get(dateArray, '[1]')
    const day = _get(dateArray, '[2]')

    if (day) {
      const date = dayjs(value).format('MMM D, YYYY')
      if (isDayJSDateValid(date)) {
        return date
      }
    } else if (month) {
      const date = dayjs(value).format('MMM YYYY')
      if (isDayJSDateValid(date)) {
        return date
      }
    } else if (year) {
      return year
    }
  }

  // Unable to parse...
  return value
}

export const formatChartLabel = (d, col, currencyCode, languageCode) => {
  if (!col || !col.type) {
    return d
  }

  let formattedLabel = d
  switch (col.type) {
    case 'STRING': {
      break
    }
    case 'DOLLAR_AMT': {
      if (Number(d) || Number(d) === 0) {
        const currency = currencyCode || 'USD'
        // const sigDigs = String(parseInt(d)).length
        try {
          formattedLabel = new Intl.NumberFormat(languageCode, {
            style: 'currency',
            currency: `${currency}`,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
            // maximumSignificantDigits: sigDigs
          }).format(d)
        } catch (err) {
          console.error(err)
          formattedLabel = new Intl.NumberFormat(languageCode, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
            // maximumSignificantDigits: sigDigs
          }).format(d)
        }
      }
      break
    }
    case 'QUANTITY': {
      break
    }
    case 'DATE': {
      formattedLabel = formatEpochDate(d, col)
      break
    }
    case 'DATE_STRING': {
      formattedLabel = formatStringDate(d)
      break
    }
    // case 'DATE_MONTH': {
    //   // This will be a string of the month number ie. "2", "12"
    //   const monthNumber = Number(d)
    //   if (monthNumber && MONTH_NAMES[monthNumber]) {
    //     formattedLabel = MONTH_NAMES[monthNumber]
    //   }
    //   break
    // }
    // case 'DATE_YEAR': {
    //   // This should always be a string of the year number ie. "2019"
    //   formattedLabel = Number(d)
    //   break
    // }
    case 'PERCENT': {
      if (Number(d)) {
        formattedLabel = Numbro(d).format('0%')
      }
      break
    }
    default: {
      break
    }
  }

  const fullWidthLabel = formattedLabel
  let isTruncated = false
  if (typeof formattedLabel === 'string' && formattedLabel.length > 25) {
    formattedLabel = `${formattedLabel.substring(0, 18)}...`
    isTruncated = true
  }

  return { fullWidthLabel, formattedLabel, isTruncated }
}

export const formatElement = ({
  element,
  column,
  currencyCode,
  languageCode,
  htmlElement,
  currencyDecimals,
  quantityDecimals
}) => {
  try {
    let formattedElement = element
    if (column) {
      switch (column.type) {
        case 'STRING': {
          // do nothing
          break
        }
        case 'DOLLAR_AMT': {
          // We will need to grab the actual currency symbol here. Will that be returned in the query response?
          if (Number(element) || Number(element) === 0) {
            const currency = currencyCode || 'USD'
            const validatedCurrencyDecimals =
              currencyDecimals || currencyDecimals === 0
                ? currencyDecimals
                : undefined

            try {
              formattedElement = new Intl.NumberFormat(languageCode, {
                style: 'currency',
                currency: `${currency}`,
                minimumFractionDigits: validatedCurrencyDecimals,
                maximumFractionDigits: validatedCurrencyDecimals
              }).format(element)
            } catch (err) {
              console.error(err)
              formattedElement = new Intl.NumberFormat(languageCode, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: validatedCurrencyDecimals,
                maximumFractionDigits: validatedCurrencyDecimals
              }).format(element)
            }
          }
          break
        }
        case 'QUANTITY': {
          const validatedQuantityDecimals =
            quantityDecimals || quantityDecimals === 0 ? quantityDecimals : 1

          if (Number(element) && Number(element) % 1 !== 0) {
            formattedElement = Numbro(element).format({
              thousandSeparated: true,
              mantissa: validatedQuantityDecimals
            })
          }
          break
        }
        case 'DATE': {
          formattedElement = formatEpochDate(element, column)
          break
        }
        case 'DATE_STRING': {
          formattedElement = formatStringDate(element)
          break
        }
        // case 'DATE_MONTH': {
        //   // This will be a string of the month number ie. "2", "12"
        //   const monthNumber = Number(element)
        //   if (monthNumber && MONTH_NAMES[monthNumber]) {
        //     formattedElement = MONTH_NAMES[monthNumber]
        //   }
        //   break
        // }
        case 'RATIO': {
          if (Number(element)) {
            formattedElement = Numbro(element).format('0.0000')
          }
          break
        }
        // This is for QBO demo ratios. Not sure why it isn't RATIO
        case 'NUMBER': {
          if (Number(element)) {
            formattedElement = Numbro(element).format('0.0000')
          }
          break
        }
        case 'PERCENT': {
          if (Number(element)) {
            formattedElement = Numbro(element).format('0.00%')

            if (htmlElement) {
              htmlElement.classList.add(
                `comparison-value-${element < 0 ? 'negative' : 'positive'}`
              )
            }
          }
          break
        }
        default: {
          break
        }
      }
    }
    return formattedElement
  } catch (error) {
    // If something goes wrong, just display original value
    return element
  }
}

/**
 * converts an svg string to base64 png using the domUrl
 * @param {string} svgElement the svgElement
 * @param {number} [margin=0] the width of the border - the image size will be height+margin by width+margin
 * @param {string} [fill] optionally backgrund canvas fill
 * @return {Promise} a promise to the bas64 png image
 */
export const svgToPng = (svgElement, margin = 0, fill) => {
  return new Promise(function (resolve, reject) {
    try {
      const domUrl = window.URL || window.webkitURL || window
      if (!domUrl) {
        throw new Error('(browser doesnt support this)')
      } else if (!svgElement) {
        throw new Error('(svg element does not exist)')
      }

      // get svg data
      var xml = new XMLSerializer().serializeToString(svgElement)
      // make it base64
      var svg64 = btoa(xml)
      var b64Start = 'data:image/svg+xml;base64,'
      // prepend a "header"
      var image64 = b64Start + svg64

      const bbox = svgElement.getBoundingClientRect()
      const width = bbox.width * 2
      const height = bbox.height * 2

      // create a canvas element to pass through
      var canvas = document.createElement('canvas')
      canvas.width = width + margin
      canvas.height = height + margin

      var ctx = canvas.getContext('2d')
      // ctx.imageSmoothingEnabled = true

      // create a new image to hold it the converted type
      var img = new Image()

      // when the image is loaded we can get it as base64 url
      img.onload = function () {
        // draw it to the canvas
        ctx.drawImage(this, margin, margin, width, height)

        // if it needs some styling, we need a new canvas
        if (fill) {
          var styled = document.createElement('canvas')
          styled.width = canvas.width
          styled.height = canvas.height
          var styledCtx = styled.getContext('2d')
          styledCtx.save()
          styledCtx.fillStyle = fill
          styledCtx.fillRect(0, 0, canvas.width, canvas.height)
          styledCtx.strokeRect(0, 0, canvas.width, canvas.height)
          styledCtx.restore()
          styledCtx.drawImage(canvas, 0, 0)
          canvas = styled
        }
        resolve(canvas.toDataURL('image/png', 1))
      }
      img.onerror = function (error) {
        reject('failed to load image with that url' + url)
      }

      // load image
      img.src = image64
    } catch (err) {
      reject('failed to convert svg to png ' + err)
    }
  })
}

export const getNumberOfGroupables = columns => {
  if (columns) {
    let numberOfGroupables = 0
    columns.forEach(col => {
      if (col.groupable) {
        numberOfGroupables += 1
      }
    })
    return numberOfGroupables
  }
  return null
}

export const isChartType = type => CHART_TYPES.includes(type)
export const isTableType = type => TABLE_TYPES.includes(type)
export const isForecastType = type => FORECAST_TYPES.includes(type)

export const getSupportedDisplayTypes = response => {
  if (!_get(response, 'data.data.display_type')) {
    return []
  }

  // For CaaS there should be 3 types: data, suggestion, help
  const displayType = response.data.data.display_type

  if (displayType === 'suggestion' || displayType === 'help') {
    return [displayType]
  }

  const columns = _get(response, 'data.data.columns')

  if (!columns) {
    return []
  }

  if (getNumberOfGroupables(columns) === 1) {
    // Is direct key-value query (ie. Avg days to pay per customer)
    const supportedDisplayTypes = ['bar', 'column', 'line', 'table']

    if (columns.length === 2) {
      supportedDisplayTypes.push('pie')
    }

    // create pivot based on month and year
    if (
      columns[0].type === 'DATE' &&
      columns[0].name.includes('month') &&
      columns.length === 2
    ) {
      supportedDisplayTypes.push('pivot_table')
    }
    return supportedDisplayTypes
  } else if (getNumberOfGroupables(columns) === 2) {
    // Is pivot query (ie. Sale per customer per month)
    return [
      'multi_line',
      'stacked_bar',
      'stacked_column',
      'bubble',
      'heatmap',
      'table',
      'pivot_table'
    ]
  }

  // We should always be able to display the table type by default
  return ['table']
}

export const isDisplayTypeValid = (displayType, supportedDisplayTypes) => {
  const isValid = supportedDisplayTypes.includes(displayType)
  if (!isValid) {
    console.error('provided display type is not valid for this response data')
  }
  return isValid
}

export const getInitialDisplayType = response => {
  const supportedDisplayTypes = getSupportedDisplayTypes(response)
  const responseDisplayType = _get(response, 'data.data.display_type')

  // If the display type is a recognized non-chart or non-table type
  if (responseDisplayType === 'suggestion' || responseDisplayType === 'help') {
    return responseDisplayType
  }

  // We want to default on pivot table if it is one of the supported types
  if (supportedDisplayTypes.includes('pivot_table')) {
    return 'pivot_table'
  }

  // If there is no display type in the response, default to regular table
  if (!responseDisplayType || responseDisplayType === 'data') {
    return 'table'
  }

  // ----------------- This probably won't happen anymore with CaaS ---------------
  // If the display type is a recognized table type
  if (isTableType(responseDisplayType)) {
    return 'table'
  }

  // If the display type is a recognized chart type
  // This probably won't happen with chata.io, it is
  // usually returned as a table type initially
  if (isChartType(responseDisplayType)) {
    return responseDisplayType
  }
  // ------------------------------------------------------------------------------

  // Default to table type
  return 'table'
}

export const getGroupBysFromPivotTable = (
  cell,
  tableColumns,
  pivotTableColumns,
  originalColumnData,
  demo
) => {
  let groupByName1
  let groupByValue1
  let groupByName2
  let groupByValue2
  try {
    if (tableColumns[0].type === 'DATE') {
      const year = Number(pivotTableColumns[cell.getField()].name)
      const month = cell.getData()[0]
      groupByName1 = tableColumns[0].name
      groupByValue1 = `${originalColumnData[year][month]}`
    } else {
      groupByName1 = tableColumns[0].name
      groupByValue1 = cell.getData()[0]

      groupByName2 = tableColumns[1].name
      groupByValue2 = pivotTableColumns[cell.getField()].name
    }

    if (demo) {
      if (groupByName2) {
        return {
          [groupByName1]: groupByValue1
        }
      }
      return {
        [groupByName1]: groupByValue1,
        [groupByName2]: groupByValue2
      }
    } else if (groupByName2) {
      return [
        {
          name: groupByName1,
          value: groupByValue1
        }
      ]
    }
    return [
      {
        name: groupByName1,
        value: groupByValue1
      },
      {
        name: groupByName2,
        value: groupByValue2
      }
    ]
  } catch (error) {
    console.error(error)
    return undefined
  }
}

export const nameValueObject = (name, value) => {
  return {
    name,
    value
  }
}

export const getGroupBysFromTable = (cell, tableColumns, demo) => {
  const numGroupables = getNumberOfGroupables(tableColumns)
  if (!numGroupables) {
    return {}
  }

  // const groupByIndices = []
  // tableColumns.forEach((col, i) => {
  //   if (col.groupable) {
  //     groupByIndices.push(i)
  //   }
  // })

  const groupByName = tableColumns[0].name
  let groupByValue = cell.getData()[0]
  if (tableColumns[0].type === 'DATE') {
    groupByValue = `${groupByValue}`
  }

  if (numGroupables === 1) {
    if (demo) {
      return { [groupByName]: groupByValue }
    }
    // Not demo. Need to format groupbys differently
    return [nameValueObject(groupByName, groupByValue)]
  }

  const groupByName2 = tableColumns[1].name
  let groupByValue2 = cell.getData()[1]
  if (tableColumns[1].type === 'DATE') {
    groupByValue2 = `${groupByValue2}`
  }

  if (demo) {
    return {
      [groupByName]: groupByValue,
      [groupByName2]: groupByValue2
    }
  }

  // Not demo. Need to format groupbys differently
  return [
    nameValueObject(groupByName, groupByValue),
    nameValueObject(groupByName2, groupByValue2)
  ]
}

export const getgroupByObjectFromTable = (
  rowData,
  origColumns,
  forceDateAxis
) => {
  const jsonData = {}
  let columns = [...origColumns]

  if (!columns[0]) {
    return
  }

  if (forceDateAxis) {
    // Swap first two columns if second one is DATE and first is not
    // rowData is already swapped here if necessary so don't swap again.
    if (
      columns[1] &&
      (columns[0].type !== 'DATE' && columns[1].type === 'DATE')
    ) {
      columns = [columns[1], columns[0], ...columns.slice(2)]
    }
  }

  columns.forEach((column, index) => {
    if (column.groupable) {
      const columnName = column.name
      if (column.type === 'DATE') {
        jsonData[columnName] = `${rowData[index]}`
      } else {
        jsonData[columnName.toLowerCase()] = `${rowData[index]}`
      }
    }
  })
  return jsonData
}

export const getGroupBysFrom3dChart = (row, column, tableColumns, demo) => {
  const groupBy1Name = tableColumns[0].name
  const groupBy2Name = tableColumns[1].name

  let groupBy1Value = column
  let groupBy2Value = row

  if (typeof groupBy1Value !== 'string') {
    groupBy1Value = `${groupBy1Value}`
  }
  if (typeof groupBy2Value !== 'string') {
    groupBy2Value = `${groupBy2Value}`
  }

  if (demo) {
    return {
      [groupBy1Name]: groupBy1Value,
      [groupBy2Name]: groupBy2Value
    }
  }

  // Not demo. Need to format groupbys differently
  return [
    nameValueObject(groupBy1Name, groupBy1Value),
    nameValueObject(groupBy2Name, groupBy2Value)
  ]
}

export const getGroupBysFrom2dChart = (row, tableColumns, demo) => {
  const groupByName = tableColumns[0].name

  let groupByValue = row[0]
  if (typeof groupByValue !== 'string') {
    groupByValue = `${groupByValue}`
  }

  if (demo) {
    return {
      [groupByName]: groupByValue
    }
  }

  return [nameValueObject(groupByName, groupByValue)]
}

export const getObjSize = obj => Object.keys(obj).length

export const getMaxValueFromKeyValueObj = obj => {
  const size = getObjSize(obj)

  let maxValue = 0
  if (size === 1) {
    maxValue = obj[Object.keys(obj)[0]]
  } else if (size > 1) {
    maxValue = Math.max(...Object.values(obj))
  }
  return maxValue
}

export const getMinValueFromKeyValueObj = obj => {
  const size = getObjSize(obj)

  let minValue = 0
  if (size === 1) {
    minValue = obj[Object.keys(obj)[0]]
  } else if (size > 1) {
    minValue = Math.min(...Object.values(obj))
  }
  return minValue
}

export const calculateMinAndMaxSums = (data, labelValue, dataValue) => {
  const positiveSumsObject = {}
  const negativeSumsObject = {}

  // Loop through data array to get maximum and minimum sums of postive and negative values
  // These will be used to get the max and min values for the x Scale (data values)
  for (let i = 0; i < data.length; i++) {
    const value = data[i][dataValue]

    if (value >= 0) {
      // Calculate positive sum
      if (positiveSumsObject[data[i][labelValue]]) {
        positiveSumsObject[data[i][labelValue]] += value
      } else {
        positiveSumsObject[data[i][labelValue]] = value
      }
    } else if (value < 0) {
      // Calculate negative sum
      if (negativeSumsObject[data[i][labelValue]]) {
        negativeSumsObject[data[i][labelValue]] -= value
      } else {
        negativeSumsObject[data[i][labelValue]] = value
      }
    }
  }

  // Get max and min sums from those sum objects
  const maxValue = getMaxValueFromKeyValueObj(positiveSumsObject)
  const minValue = getMinValueFromKeyValueObj(negativeSumsObject)

  return {
    max: maxValue,
    min: minValue
  }
}

export const changeTooltipText = (id, text, tooltipShiftDistance, duration) => {
  const tooltip = document.getElementById(id)
  const prevText = tooltip.innerHTML

  tooltip.innerHTML = text
  if (tooltipShiftDistance) {
    tooltip.style.left = `${Number(
      tooltip.style.left.substring(0, tooltip.style.left.length - 2)
    ) + tooltipShiftDistance}px`
  }

  if (duration) {
    setTimeout(() => {
      tooltip.innerHTML = prevText
      if (tooltipShiftDistance) {
        tooltip.style.left = `${Number(
          tooltip.style.left.substring(0, tooltip.style.left.length - 2)
        ) - tooltipShiftDistance}px`
      }
    }, duration)
  }
}
