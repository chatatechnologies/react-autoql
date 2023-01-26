import _get from 'lodash.get'
import _filter from 'lodash.filter'
import _isEqual from 'lodash.isequal'
import dayjs from './dayjsWithPlugins'

import {
  CHART_TYPES,
  TABLE_TYPES,
  WEEKDAY_NAMES,
  MONTH_NAMES,
  SEASON_NAMES,
  TIMESTAMP_FORMATS,
  PRECISION_TYPES,
} from './Constants'
import { dataFormattingDefault } from '../props/defaults'

import {
  getColumnTypeAmounts,
  shouldPlotMultiSeries,
  isAggregation,
  getDateColumnIndex,
  getStringColumnIndices,
  isColumnDateType,
} from '../components/QueryOutput/columnHelpers'

export const onlyUnique = (value, index, self) => {
  return self.indexOf(value) === index
}

export const makeEmptyArray = (w, h, value = '') => {
  var arr = []
  for (let i = 0; i < h; i++) {
    arr[i] = []
    for (let j = 0; j < w; j++) {
      arr[i][j] = value
    }
  }
  return arr
}

export const getCurrencySymbol = (dataFormatting) => {
  try {
    const formattedParts = new Intl.NumberFormat(dataFormatting.languageCode, {
      style: 'currency',
      currency: dataFormatting.currencyCode,
    }).formatToParts(0)
    const symbol = formattedParts.find((part) => part?.type === 'currency')?.value
    return symbol
  } catch (error) {
    console.error(error)
    return
  }
}

export const isDayJSDateValid = (date) => {
  return date !== 'Invalid Date'
}

export const formatDateType = (element, column = {}, config = {}, precision) => {
  if (config.timestampFormat === TIMESTAMP_FORMATS.iso8601 && column.precision) {
    return formatISODateWithPrecision(element, column, config, precision)
  }

  return formatEpochDate(element, column, config)
}

export const formatDateStringType = (element, column = {}, config = {}) => {
  if (config.timestampFormat === TIMESTAMP_FORMATS.iso8601 && column.precision) {
    return formatStringDateWithPrecision(element, column, config)
  }

  return formatStringDate(element, config)
}

export const formatISODateWithPrecision = (value, col = {}, config = {}, customPrecision) => {
  if (!value) {
    return undefined
  }

  const precision = customPrecision ?? col.precision
  const dayMonthYearFormat = config.dayMonthYearFormat || dataFormattingDefault.dayMonthYearFormat
  const dateDayJS = dayjs(value).utc()
  let date = dateDayJS.format(dayMonthYearFormat)

  try {
    switch (precision) {
      case PRECISION_TYPES.DAY: {
        // default
        break
      }
      case PRECISION_TYPES.WEEK: {
        const dateJSStart = dateDayJS.startOf('week').format('MMM D')
        const dateJSEnd = dateDayJS.endOf('week').format('MMM D')
        const week = dateDayJS.week()
        const year = dateDayJS.format('YYYY')
        date = `${dateJSStart} - ${dateJSEnd}, ${year} (Week ${week})`
        break
      }
      case PRECISION_TYPES.MONTH: {
        const monthYearFormat = config.monthYearFormat || dataFormattingDefault.monthYearFormat
        date = dateDayJS.format(monthYearFormat)
        break
      }
      case PRECISION_TYPES.QUARTER: {
        const quarter = dateDayJS.quarter()
        const year = dateDayJS.format('YYYY')
        date = `${year}-Q${quarter}`
        break
      }
      case PRECISION_TYPES.YEAR: {
        date = dateDayJS.format('YYYY')
        break
      }
      case PRECISION_TYPES.DATE_HOUR: {
        date = dateDayJS.format(`${dayMonthYearFormat} h:00A`)
        break
      }
      case PRECISION_TYPES.DATE_MINUTE: {
        date = dateDayJS.format(`${dayMonthYearFormat} h:mmA`)
        break
      }
      default: {
        break
      }
    }
    return date
  } catch (error) {
    console.error(error)
  }
}

export const formatEpochDate = (value, col = {}, config = {}) => {
  if (!value) {
    // If this is 0, its most likely not the right date
    // Any other falsy values are invalid
    return undefined
  }

  try {
    const { monthYearFormat, dayMonthYearFormat } = config
    const year = 'YYYY'
    const monthYear = monthYearFormat || dataFormattingDefault.monthYearFormat
    const dayMonthYear = dayMonthYearFormat || dataFormattingDefault.dayMonthYearFormat

    // Use title to determine significant digits of date format
    const title = col.title

    let dayJSObj
    if (isNaN(parseFloat(value))) {
      dayJSObj = dayjs(value).utc()
    } else {
      dayJSObj = dayjs.unix(value).utc()
    }

    let date = dayJSObj.format(dayMonthYear)

    if (isNaN(parseFloat(value))) {
      // Not an epoch time. Try converting using dayjs
      if (title && title.toLowerCase().includes('year')) {
        date = dayJSObj.format(year)
      } else if (title && title.toLowerCase().includes('month')) {
        date = dayJSObj.format(monthYear)
      }
      date = dayJSObj.format(dayMonthYear)
    } else if (title && title.toLowerCase().includes('year')) {
      date = dayJSObj.format(year)
    } else if (title && title.toLowerCase().includes('month')) {
      date = dayJSObj.format(monthYear)
    }

    if (isDayJSDateValid(date)) {
      return date
    }

    return value
  } catch (error) {
    console.error(error)
    return value
  }
}

export const formatStringDateWithPrecision = (value, col, config = {}) => {
  if (!value) {
    return undefined
  }

  let formattedValue = value
  try {
    switch (col.precision) {
      case 'DOW': {
        if (!isNaN(value) && value >= 1 && value <= 7) {
          formattedValue = WEEKDAY_NAMES[value - 1]
        }
        break
      }
      case 'HOUR': {
        const dayjsTime = dayjs(value, 'THH:mm:ss.SSSZ').utc()
        formattedValue = dayjsTime.format('h:00A')
        break
      }
      case 'MINUTE': {
        const dayjsTime = dayjs(value, 'THH:mm:ss.SSSZ').utc()
        formattedValue = dayjsTime.format('h:mmA')
        break
      }
      case 'MONTH': {
        formattedValue = value
        break
      }
      default: {
        formattedValue = value
        break
      }
    }
    return formattedValue
  } catch (error) {
    console.error(error)
    return value
  }
}

export const formatStringDate = (value, config) => {
  if (!value) {
    return undefined
  }

  if (value && typeof value === 'string') {
    const dateArray = value.split('-')
    const year = _get(dateArray, '[0]')
    const day = _get(dateArray, '[2]')

    let month
    let week
    if (_get(dateArray, '[1]', '').includes('W')) {
      week = _get(dateArray, '[1]')
    } else {
      month = _get(dateArray, '[1]')
    }

    const { monthYearFormat, dayMonthYearFormat } = config
    const monthYear = monthYearFormat || dataFormattingDefault.monthYearFormat
    const dayMonthYear = dayMonthYearFormat || dataFormattingDefault.dayMonthYearFormat
    const dayJSObj = dayjs(value).utc()

    if (day) {
      const date = dayJSObj.format(dayMonthYear)
      if (isDayJSDateValid(date)) {
        return date
      }
    } else if (month) {
      const date = dayJSObj.format(monthYear)
      if (isDayJSDateValid(date)) {
        return date
      }
    } else if (week) {
      // dayjs doesn't format this correctly
      return value
    } else if (year) {
      return year
    }
  }

  // Unable to parse...
  return value
}

export const formatChartLabel = ({ d, col = {}, config = {} }) => {
  if (d === null) {
    return {
      fullWidthLabel: 'Untitled Category',
      formattedLabel: 'Untitled Category',
      isTruncated: false,
    }
  }

  if (!col || !col.type) {
    return {
      fullWidthLabel: d,
      formattedLabel: d,
      isTruncated: false,
    }
  }

  const { currencyCode, languageCode } = config

  let type = col.type
  if (['count', 'deviation', 'variance'].includes(col.aggType)) {
    type = 'QUANTITY'
  }

  let formattedLabel = d
  switch (type) {
    case 'STRING': {
      break
    }
    case 'DOLLAR_AMT': {
      if (Number(d) || Number(d) === 0) {
        const currency = currencyCode || 'USD'
        try {
          formattedLabel = new Intl.NumberFormat(languageCode, {
            style: 'currency',
            currency: `${currency}`,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(d)
        } catch (error) {
          console.error(error)
          formattedLabel = new Intl.NumberFormat(languageCode, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(d)
        }
      }
      break
    }
    case 'QUANTITY': {
      if (!isNaN(parseFloat(d))) {
        formattedLabel = new Intl.NumberFormat(languageCode).format(d)
      }
      break
    }
    case 'DATE': {
      formattedLabel = formatDateType(d, col, config)
      break
    }
    case 'DATE_STRING': {
      formattedLabel = formatDateStringType(d, col, config)
      break
    }
    case 'PERCENT': {
      if (Number(d)) {
        const p = Number(d) / 100
        formattedLabel = new Intl.NumberFormat(languageCode, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(p)
      }
      break
    }
    default: {
      break
    }
  }

  const fullWidthLabel = formattedLabel
  let isTruncated = false
  if (typeof formattedLabel === 'string' && formattedLabel.length > 20) {
    formattedLabel = `${formattedLabel.substring(0, 20)}...`
    isTruncated = true
  }

  return { fullWidthLabel, formattedLabel, isTruncated }
}

export const getDayJSObj = ({ value, column, config }) => {
  if (config.timestampFormat === TIMESTAMP_FORMATS.iso8601 && column.precision) {
    return dayjs(value).utc()
  }

  return dayjs.unix(value).utc()
}

export const formatElement = ({ element, column, config = {}, htmlElement, precision, isChart }) => {
  try {
    let formattedElement = element
    const { currencyCode, languageCode, currencyDecimals, quantityDecimals } = config

    let type = column?.type
    if (isChart && ['count', 'deviation', 'variance'].includes(column?.aggType)) {
      type = 'QUANTITY'
    }

    if (column) {
      switch (type) {
        case 'STRING': {
          // do nothing
          break
        }
        case 'DOLLAR_AMT': {
          // We will need to grab the actual currency symbol here. Will that be returned in the query response?
          if (!isNaN(parseFloat(element))) {
            const currency = currencyCode || 'USD'
            const validatedCurrencyDecimals = currencyDecimals || currencyDecimals === 0 ? currencyDecimals : undefined

            try {
              formattedElement = new Intl.NumberFormat(languageCode, {
                style: 'currency',
                currency: `${currency}`,
                minimumFractionDigits: validatedCurrencyDecimals,
                maximumFractionDigits: validatedCurrencyDecimals,
              }).format(element)
            } catch (error) {
              console.error(error)
              formattedElement = new Intl.NumberFormat(languageCode, {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: validatedCurrencyDecimals,
                maximumFractionDigits: validatedCurrencyDecimals,
              }).format(element)
            }
          }
          break
        }
        case 'QUANTITY': {
          const validatedQuantityDecimals = quantityDecimals || quantityDecimals === 0 ? quantityDecimals : 1

          if (!isNaN(parseFloat(element))) {
            const numDecimals = parseFloat(element) % 1 !== 0 ? validatedQuantityDecimals : 0

            formattedElement = new Intl.NumberFormat(languageCode, {
              minimumFractionDigits: numDecimals,
              maximumFractionDigits: numDecimals,
            }).format(element)
          }

          break
        }
        case 'DATE': {
          formattedElement = formatDateType(element, column, config, precision)
          break
        }
        case 'DATE_STRING': {
          formattedElement = formatDateStringType(element, column, config)
          break
        }
        case 'RATIO': {
          if (!isNaN(parseFloat(element))) {
            formattedElement = new Intl.NumberFormat(languageCode, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            }).format(element)
          }
          break
        }
        case 'PERCENT': {
          if (!isNaN(parseFloat(element))) {
            const p = parseFloat(element) / 100

            formattedElement = new Intl.NumberFormat(languageCode, {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(p)

            if (htmlElement) {
              if (element < 0) {
                htmlElement.classList.add('comparison-value-negative')
              } else if (element > 0) {
                htmlElement.classList.add('comparison-value-positive')
              }
              // If element is "0" leave as default colour
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
    console.error(error)
    // If something goes wrong, just display original value
    return element
  }
}

export const getPNGBase64 = (svgElement) => {
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
    var svg64 = btoa(unescape(encodeURIComponent(xml))) // we added non-Latin1 chars for the axis selector
    var b64Start = 'data:image/svg+xml;base64,'
    // prepend a "header"
    var image64 = b64Start + svg64
    return image64
  } catch (error) {
    return undefined
  }
}

export const getBBoxFromRef = (ref) => {
  if (!ref || !ref.getBBox) {
    return
  }

  return ref.getBBox()
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
      const image64 = getPNGBase64(svgElement)

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
      img.onerror = function () {
        reject('failed to load image')
      }

      // load image
      img.src = image64
    } catch (error) {
      console.error(error)
      reject('failed to convert svg to png ' + error)
    }
  })
}

export const getNumberOfGroupables = (columns) => {
  let numberOfGroupables = 0
  if (columns) {
    columns.forEach((col) => {
      if (col.groupable) {
        numberOfGroupables += 1
      }
    })
  }
  return numberOfGroupables
}

export const getGroupableColumns = (columns) => {
  const groupableColumns = []
  if (columns) {
    columns.forEach((col, index) => {
      if (col.groupable) {
        groupableColumns.push(index)
      }
    })
  }
  return groupableColumns
}

export const isChartType = (type) => CHART_TYPES.includes(type)
export const isTableType = (type) => TABLE_TYPES.includes(type)

export const supportsDatePivotTable = (columns) => {
  const dateColumnIndex = columns.findIndex((col) => col.type === 'DATE' || col.type === 'DATE_STRING')
  const dateColumn = columns[dateColumnIndex]

  // Todo: use new date column precision instead of substr search for "month"
  return dateColumn && dateColumn?.display_name?.toLowerCase().includes('month') && columns?.length === 2
}

export const supportsRegularPivotTable = (columns, dataLength) => {
  if (dataLength <= 1) {
    return false
  }

  const hasTwoGroupables = getNumberOfGroupables(columns) === 2
  return hasTwoGroupables && columns.length === 3
}

export const hasDateColumn = (columns) => {
  const hasDateColumn = !!columns.filter((col) => isColumnDateType(col))
  return hasDateColumn
}

export const supports2DCharts = (columns, dataLength) => {
  if (dataLength <= 1) {
    return false
  }

  const { amountOfNumberColumns, amountOfStringColumns } = getColumnTypeAmounts(columns)

  return amountOfNumberColumns > 0 && amountOfStringColumns > 0
}

export const supportsPieChart = (columns, chartData) => {
  if (shouldPlotMultiSeries(columns)) {
    return false
  }
  if (chartData) {
    // Pie charts really shouldn't have any more than 6 slices
    return chartData.length < 7
  }

  return true
}

export const getHiddenColumns = (columns) => {
  return _filter(columns, (col) => !col.is_visible)
}

export const getVisibleColumns = (columns) => {
  return _filter(columns, (col) => col.is_visible)
}

export const areSomeColumnsHidden = (columns) => {
  const hasColumns = columns?.length
  const hiddenColumns = getHiddenColumns(columns)
  return hasColumns && !!hiddenColumns.length
}

export const areAllColumnsHidden = (columns) => {
  const visibleColumns = getVisibleColumns(columns)
  return columns?.length && !visibleColumns.length
}

export const isSingleValueResponse = (response) => {
  if (!response) {
    return false
  }

  return _get(response, 'data.data.rows.length') === 1 && _get(response, 'data.data.rows[0].length') === 1
}

export const getSupportedDisplayTypes = ({ response, columns, dataLength, pivotDataLength, isDataLimited } = {}) => {
  try {
    if (!_get(response, 'data.data.display_type')) {
      return []
    }
    // There should be 3 types: data, suggestion, help
    const displayType = response.data.data.display_type

    if (displayType === 'suggestion' || displayType === 'help' || displayType === 'html') {
      return [displayType]
    }

    const rows = _get(response, 'data.data.rows', [])
    const allColumns = columns || _get(response, 'data.data.columns')
    const visibleColumns = getVisibleColumns(allColumns)

    if (!_get(visibleColumns, 'length') || !_get(rows, 'length')) {
      return ['text']
    }

    if (isSingleValueResponse(response)) {
      return ['single-value']
    }

    const maxRowsForPivot = 1000
    const maxRowsForPieChart = 10
    const numRows = dataLength ?? rows.length

    let pivotDataHasLength = true
    const pivotDataLengthProvided = pivotDataLength !== undefined && pivotDataLength !== null
    if (pivotDataLengthProvided) {
      pivotDataHasLength = !!pivotDataLength
    }

    if (supportsRegularPivotTable(visibleColumns, numRows)) {
      // The only case where 3D charts are supported (ie. heatmap, bubble, etc.)
      const supportedDisplayTypes = ['table']

      if (!isDataLimited) {
        supportedDisplayTypes.push('pivot_table')
      }

      if (
        // Comment out for now so chart row count doesnt change display type
        // numRows <= maxRowsForPivot &&
        pivotDataHasLength
      ) {
        supportedDisplayTypes.push('stacked_column', 'stacked_bar', 'column', 'bar', 'bubble', 'heatmap')

        if (hasDateColumn(visibleColumns)) {
          supportedDisplayTypes.push('stacked_line', 'line')
        }
      }
      // Comment out for now so chart row count doesnt change display type
      // else if (numRows > maxRowsForPivot) {
      //   console.warn('Supported Display Types: Rows exceeded 1000, only allowing regular table display type')
      // }

      return supportedDisplayTypes
    } else if (supports2DCharts(visibleColumns, numRows)) {
      // If there is at least one string column and one number
      // column, we should be able to chart anything
      const supportedDisplayTypes = ['table', 'column', 'bar']

      if (hasDateColumn(visibleColumns)) {
        supportedDisplayTypes.push('line')
      }

      if (numRows > 1 && numRows <= maxRowsForPieChart) {
        supportedDisplayTypes.push('pie')
      }

      const { amountOfNumberColumns } = getColumnTypeAmounts(visibleColumns)
      if (amountOfNumberColumns > 1) {
        supportedDisplayTypes.push('column_line')
      }

      // Check if date pivot should be supported
      if (!isDataLimited && supportsDatePivotTable(visibleColumns, numRows)) {
        // create pivot based on month and year
        const dateColumnIndex = visibleColumns.findIndex((col) => col.type === 'DATE' || col.type === 'DATE_STRING')
        const dateColumn = visibleColumns[dateColumnIndex]
        const data = _get(response, 'data.data.rows')
        const uniqueYears = []
        data.forEach((row) => {
          const year = formatElement({
            element: row[dateColumnIndex],
            column: dateColumn,
            config: { monthYearFormat: 'YYYY', dayMonthYearFormat: 'YYYY' },
          })

          if (!uniqueYears.includes(year)) {
            uniqueYears.push(year)
          }
        })

        if (uniqueYears.length > 1) {
          supportedDisplayTypes.push('pivot_table')
        }
      }

      return supportedDisplayTypes
    }

    // We should always be able to display the table type by default
    return ['table']
  } catch (error) {
    console.error(error)
    return ['table']
  }
}

export const isDisplayTypeValid = (response, displayType, dataLength, pivotDataLength, columns, isDataLimited) => {
  const supportedDisplayTypes = getSupportedDisplayTypes({
    response,
    columns,
    dataLength,
    pivotDataLength,
    isDataLimited,
  })
  const isValid = displayType && supportedDisplayTypes.includes(displayType)

  return isValid
}

export const getFirstChartDisplayType = (supportedDisplayTypes, fallback) => {
  const chartType = supportedDisplayTypes.find((displayType) => isChartType(displayType))
  if (chartType) {
    return chartType
  }

  return fallback
}

export const hasData = (response) => {
  if (!response) {
    return false
  }

  return _get(response, 'data.data.rows.length') && _get(response, 'data.data.rows.length')
}

export const getDefaultDisplayType = (
  response,
  defaultToChart,
  columns,
  dataLength,
  pivotDataLength,
  preferredDisplayType,
  isDataLimited,
) => {
  const supportedDisplayTypes = getSupportedDisplayTypes({
    response,
    columns,
    dataLength,
    pivotDataLength,
    isDataLimited,
  })

  if (preferredDisplayType && supportedDisplayTypes.includes(preferredDisplayType)) {
    return preferredDisplayType
  }

  const responseDisplayType = _get(response, 'data.data.display_type')

  if (supportedDisplayTypes.includes(preferredDisplayType)) {
    return preferredDisplayType
  }

  // If the display type is a recognized non-chart or non-table type
  if (responseDisplayType === 'suggestion' || responseDisplayType === 'help' || responseDisplayType === 'html') {
    return responseDisplayType
  }

  if (supportedDisplayTypes.length === 1) {
    return supportedDisplayTypes[0]
  }

  // We want to default on pivot table if it is one of the supported types
  if (supportedDisplayTypes.includes('pivot_table')) {
    let displayType = 'pivot_table'

    if (defaultToChart) {
      displayType = isAggregation(_get(response, 'data.data.columns'))
        ? getFirstChartDisplayType(supportedDisplayTypes, 'pivot_table')
        : 'pivot_table'
    }

    return displayType
  }

  // If there is no display type in the response, but there is tabular data, default to regular table
  if ((!responseDisplayType && hasData(response)) || responseDisplayType === 'data') {
    let displayType = 'table'

    if (defaultToChart) {
      displayType = isAggregation(_get(response, 'data.data.columns'))
        ? getFirstChartDisplayType(supportedDisplayTypes, 'table')
        : 'table'
    }

    return displayType
  }

  // Default to plain text
  return 'text'
}

export const getGroupBysFromPivotTable = (cell) => {
  try {
    const groupBys = []

    const pivotColumn = cell?.getColumn()?.getDefinition()
    const pivotCategory = cell.getData()[0]

    const pivotCategoryName = pivotColumn.origValues?.[pivotCategory].name
    const pivotCategoryValue = pivotColumn.origValues?.[pivotCategory].value
    groupBys.push({
      name: pivotCategoryName,
      value: `${pivotCategoryValue}`,
    })

    if (pivotColumn?.origPivotColumn) {
      // Not a date pivot
      const pivotColumnName = pivotColumn.name
      const origColumnName = pivotColumn.origPivotColumn?.name
      groupBys.push({
        name: origColumnName,
        value: `${pivotColumnName}`,
      })
    }

    return groupBys
  } catch (error) {
    console.error(error)
    return undefined
  }
}

export const nameValueObject = (name, value) => {
  return {
    name,
    value,
  }
}

export const getGroupBys = (row, columns) => {
  if (!columns?.length) {
    return undefined
  }

  const groupableColumns = getGroupableColumns(columns)
  const numGroupables = groupableColumns.length
  if (!numGroupables) {
    return { groupBys: undefined, supportedByAPI: false }
  }

  const groupBys = []
  groupableColumns.forEach((colIndex) => {
    const groupByName = columns[colIndex].name
    const groupByValue = `${row[colIndex]}`
    groupBys.push(nameValueObject(groupByName, groupByValue))
  })

  return { groupBys, supportedByAPI: true }
}

export const getGroupBysFromTable = (cell, tableColumns) => {
  if (!cell || !tableColumns) {
    return undefined
  }

  const groupableColumns = getGroupableColumns(tableColumns)
  const numGroupables = groupableColumns.length
  if (!numGroupables) {
    return undefined
  }

  const rowData = cell.getData()

  const groupByArray = []
  groupableColumns.forEach((colIndex) => {
    const groupByName = tableColumns[colIndex].name
    const groupByValue = rowData[colIndex] === null ? '' : `${rowData[colIndex]}`

    groupByArray.push(nameValueObject(groupByName, groupByValue))
  })

  return groupByArray
}

export const getChartLabelTextWidthInPx = (text) => {
  try {
    const tempDiv = document.createElement('DIV')
    tempDiv.innerHTML = text
    tempDiv.style.display = 'inline-block'
    tempDiv.style.position = 'absolute'
    tempDiv.style.visibility = 'hidden'
    tempDiv.style.fontSize = '11px'
    document.body.appendChild(tempDiv)
    const textWidth = tempDiv.clientWidth
    document.body.removeChild(tempDiv)

    return textWidth
  } catch (error) {
    console.error(error)
    return 0
  }
}

export const getQueryParams = (url) => {
  try {
    const queryParams = {}
    // create an anchor tag to use the property called search
    const anchor = document.createElement('a')
    // assigning url to href of anchor tag
    anchor.href = url
    // search property returns the query string of url
    const queryStrings = anchor.search.substring(1)
    const params = queryStrings.split('&')

    for (var i = 0; i < params.length; i++) {
      var pair = params[i].split('=')
      queryParams[pair[0]] = decodeURIComponent(pair[1])
    }
    return queryParams
  } catch (error) {
    return undefined
  }
}

export const getPadding = (element) => {
  const padding = { left: 0, right: 0, top: 0, bottom: 0 }
  try {
    const left = parseInt(window.getComputedStyle(element)['padding-left'], 10)
    const right = parseInt(window.getComputedStyle(element)['padding-right'], 10)
    const top = parseInt(window.getComputedStyle(element)['padding-top'], 10)
    const bottom = parseInt(window.getComputedStyle(element)['padding-bottom'], 10)

    padding.left = left
    padding.right = right
    padding.top = top
    padding.bottom = bottom
  } catch (error) {
    return padding
  }

  return padding
}

export const capitalizeFirstChar = (string) => {
  let capitalized = string
  try {
    capitalized = string.charAt(0).toUpperCase() + string.slice(1)
  } catch (error) {
    console.error(error)
  }

  return capitalized
}

export const setCaretPosition = (elem, caretPos) => {
  if (elem !== null) {
    if (elem.createTextRange) {
      const range = elem.createTextRange()
      range.move('character', caretPos)
      range.select()
    } else {
      if (elem.selectionStart) {
        elem.focus()
        elem.setSelectionRange(caretPos, caretPos)
      } else {
        elem.focus()
      }
    }
  }
}

export const removeFromDOM = (elem) => {
  if (!elem) {
    return
  }

  try {
    if (typeof elem.forEach === 'function' && _get(elem, 'length')) {
      elem.forEach((el) => {
        if (el && typeof el.remove === 'function') {
          el.remove()
        }
      })
    } else if (typeof elem.remove === 'function') {
      elem.remove()
    }
  } catch (error) {
    console.error(error)
  }
}

export const dateSortFn = (a, b, isChart) => {
  try {
    if (!a && !b) {
      return 0
    } else if (!a && b) {
      return 1
    } else if (a && !b) {
      return -1
    }

    // First try to convert to number. It will sort properly if its a plain year or a unix timestamp
    let aDate = Number(a)
    let bDate = Number(b)

    // If one is not a number, use dayjs to format
    if (isNaN(aDate) || isNaN(bDate)) {
      aDate = dayjs(a).unix()
      bDate = dayjs(b).unix()
    }

    // Finally if all else fails, just compare the 2 values directly
    if (!aDate || !bDate) {
      // If one is a YYYY-WW
      if (a.includes('-W')) {
        const aDateYear = a.substring(0, 4)
        const bDateYear = b.substring(0, 4)
        if (aDateYear !== bDateYear) {
          return bDateYear - aDateYear
        } else {
          const aDateWeek = a.substring(6, 8)
          const bDateWeek = b.substring(6, 8)
          return bDateWeek - aDateWeek
        }
      }
      // If one is a weekday name
      else if (WEEKDAY_NAMES.includes(a.trim())) {
        const multiplier = isChart ? -1 : 1

        const aDayIndex = WEEKDAY_NAMES.findIndex((d) => d === a.trim())
        const bDayIndex = WEEKDAY_NAMES.findIndex((d) => d === b.trim())

        let sortValue = a - b
        if (aDayIndex >= 0 && bDayIndex >= 0) {
          sortValue = aDayIndex - bDayIndex
        }

        return sortValue * multiplier
      }
      // If one is a month name
      else if (MONTH_NAMES.includes(a.trim())) {
        const aMonthIndex = MONTH_NAMES.findIndex((m) => m === a.trim())
        const bMonthIndex = MONTH_NAMES.findIndex((m) => m === b.trim())
        if (aMonthIndex >= 0 && bMonthIndex >= 0) {
          return bMonthIndex - aMonthIndex
        }
        return b - a
      } else if (SEASON_NAMES.includes(a.substr(0, 2))) {
        const aSeasonIndex = SEASON_NAMES.findIndex((s) => s === a.substr(0, 2))
        const bSeasonIndex = SEASON_NAMES.findIndex((s) => s === b.substr(0, 2))
        const aYear = Number(a.substr(2))
        const bYear = Number(b.substr(2))

        if (aYear === bYear) {
          return bSeasonIndex - aSeasonIndex
        }

        return bYear - aYear
      }
    }
    return bDate - aDate
  } catch (error) {
    console.error(error)
    return -1
  }
}

export const sortDataByDate = (data, tableColumns, isChart) => {
  try {
    if (!data || typeof data !== 'object') {
      return data
    }
    const dateColumnIndex = getDateColumnIndex(tableColumns)
    if (dateColumnIndex >= 0) {
      let sortedData
      if (!isChart) {
        sortedData = [...data].sort((a, b) => dateSortFn(a[dateColumnIndex], b[dateColumnIndex]))
      } else {
        sortedData = [...data].sort((a, b) => -1 * dateSortFn(a[dateColumnIndex], b[dateColumnIndex], isChart))
      }
      return sortedData
    }
    return data
  } catch (error) {
    console.error(error)
    return data
  }
}

export const handleTooltipBoundaryCollision = (e, self) => {
  const { tooltipRef } = self.reactTooltipRef

  if (!tooltipRef) {
    return
  }

  const rect = tooltipRef.getBoundingClientRect()

  const overflownLeft = rect.left < 0
  const overflownRight = rect.right > window.innerWidth

  if (overflownLeft) {
    tooltipRef.style.setProperty('left', '10px')
    tooltipRef.style.setProperty('right', 'auto')
  } else if (overflownRight) {
    tooltipRef.style.setProperty('left', 'auto')
    tooltipRef.style.setProperty('right', '10px')
  }
}

export const animateInputText = ({ text = '', inputRef, callback = () => {}, totalAnimationTime = 1000 }) => {
  if (!text.length || !inputRef || typeof text !== 'string') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timePerChar = Math.round(totalAnimationTime / text.length)
    for (let i = 1; i <= text.length; i++) {
      setTimeout(() => {
        inputRef.value = text.slice(0, i)
        if (i === text.length) {
          setTimeout(() => {
            callback()
            resolve()
          }, 300)
        }
      }, i * timePerChar)
    }
  })
}

export const currentEventLoopEnd = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export const difference = (objA, objB) => {
  const diff = []
  Object.keys(Object.assign({}, objA, objB)).forEach((key) => {
    if (typeof objA[key] === 'function' && typeof objB[key] === 'function') {
      if (!functionsEqual(objA[key], objB[key])) {
        diff.push({
          key,
          objA: objA[key],
          objB: objB[key],
        })
      }
    } else if (!Object.is(objA[key], objB[key])) {
      diff.push({
        key,
        objA: objA[key],
        objB: objB[key],
      })
    }
  })
  return diff
}

const functionsEqual = (a, b) => {
  return a?.toString() == b?.toString()
}

const isObject = (obj) => {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null && obj !== undefined
}

export const deepEqual = (objA, objB) => {
  const lodashIsEqual = _isEqual(objA, objB)
  if (lodashIsEqual) {
    return true
  }

  const objAIsObject = isObject(objA)
  const objBIsObject = isObject(objB)

  if (!objAIsObject || !objBIsObject) {
    return lodashIsEqual
  }

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    // Dont deep compare functions
    if (typeof objA[keysA[i]] === 'function' && typeof objB[keysA[i]] === 'function') {
      if (!functionsEqual(objA[keysA[i]], objB[keysA[i]])) {
        return false
      }
    } else if (!hasOwnProperty.call(objB, keysA[i]) || !_isEqual(objA[keysA[i]], objB[keysA[i]])) {
      return false
    }
  }

  return true
}
