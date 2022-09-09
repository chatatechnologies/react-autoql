import _get from 'lodash.get'
import _filter from 'lodash.filter'
import dayjs from './dayjsWithPlugins'

import {
  CHART_TYPES,
  TABLE_TYPES,
  WEEKDAY_NAMES,
  MONTH_NAMES,
} from './Constants'
import { LIGHT_THEME, DARK_THEME } from './Themes'

import { getThemeConfig } from '../props/defaults'

import {
  getColumnTypeAmounts,
  shouldPlotMultiSeries,
  isAggregation,
  getDateColumnIndex,
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

export const isDayJSDateValid = (date) => {
  return date !== 'Invalid Date'
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
    const monthYear = monthYearFormat || 'MMM YYYY'
    const dayMonthYear = dayMonthYearFormat || 'll'

    // Use title to determine significant digits of date format
    const title = col.title
    let date = dayjs.unix(value).utc().format(dayMonthYear)

    if (Number.isNaN(Number(value))) {
      // Not an epoch time. Try converting using dayjs
      if (title && title.toLowerCase().includes('year')) {
        date = dayjs(value).format(year)
      } else if (title && title.toLowerCase().includes('month')) {
        date = dayjs(value).format(monthYear)
      }
      date = dayjs(value).format(dayMonthYear)
    } else if (title && title.toLowerCase().includes('year')) {
      date = dayjs.unix(value).utc().format(year)
    } else if (title && title.toLowerCase().includes('month')) {
      date = dayjs.unix(value).utc().format(monthYear)
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
    const monthYear = monthYearFormat || 'MMM YYYY'
    const dayMonthYear = dayMonthYearFormat || 'll'

    if (day) {
      const date = dayjs(value).format(dayMonthYear)
      if (isDayJSDateValid(date)) {
        return date
      }
    } else if (month) {
      const date = dayjs(value).format(monthYear)
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
  if (d == null) {
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

  let formattedLabel = d
  switch (col.type) {
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
      if (Number(d)) {
        formattedLabel = new Intl.NumberFormat(languageCode).format(d)
      }
      break
    }
    case 'DATE': {
      formattedLabel = formatEpochDate(d, col, config)
      break
    }
    case 'DATE_STRING': {
      formattedLabel = formatStringDate(d, config)
      break
    }
    case 'PERCENT': {
      if (Number(d)) {
        let p = Number(d) / 100
        formattedLabel = new Intl.NumberFormat(languageCode, {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
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

export const formatElement = ({
  element,
  column,
  config = {},
  htmlElement,
}) => {
  try {
    let formattedElement = element
    const { currencyCode, languageCode, currencyDecimals, quantityDecimals } =
      config

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
          const validatedQuantityDecimals =
            quantityDecimals || quantityDecimals === 0 ? quantityDecimals : 1

          if (Number(element)) {
            const numDecimals =
              Number(element) % 1 !== 0 ? validatedQuantityDecimals : 0

            formattedElement = new Intl.NumberFormat(languageCode, {
              minimumFractionDigits: numDecimals,
              maximumFractionDigits: numDecimals,
            }).format(element)
          }

          break
        }
        case 'DATE': {
          formattedElement = formatEpochDate(element, column, config)
          break
        }
        case 'DATE_STRING': {
          formattedElement = formatStringDate(element, config)
          break
        }
        case 'RATIO': {
          if (Number(element)) {
            formattedElement = new Intl.NumberFormat(languageCode, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            }).format(element)
          }
          break
        }
        case 'PERCENT': {
          if (Number(element)) {
            let p = Number(element) / 100

            formattedElement = new Intl.NumberFormat(languageCode, {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(p)

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
  let bbox
  try {
    if (ref) {
      bbox = ref.getBBox()
    }
  } catch (error) {
    console.error(error)
  }

  return bbox
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
      img.onerror = function (error) {
        reject('failed to load image with that url' + url)
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

export const supportsRegularPivotTable = (columns) => {
  const hasTwoGroupables = getNumberOfGroupables(columns) === 2
  return hasTwoGroupables && columns.length === 3
}

export const supports2DCharts = (columns) => {
  const { amountOfNumberColumns, amountOfStringColumns } =
    getColumnTypeAmounts(columns)

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

export const getHiddenColumns = (response) => {
  return _filter(_get(response, 'data.data.columns'), (col) => !col.is_visible)
}

export const getVisibleColumns = (response) => {
  return _filter(_get(response, 'data.data.columns'), (col) => col.is_visible)
}

export const areSomeColumnsHidden = (response) => {
  const hasColumns = _get(response, 'data.data.columns.length')
  const hiddenColumns = getHiddenColumns(response)
  return hasColumns && !!hiddenColumns.length
}

export const areAllColumnsHidden = (response) => {
  const hasColumns = _get(response, 'data.data.columns.length')
  const visibleColumns = getVisibleColumns(response)
  return hasColumns && !visibleColumns.length
}

export const getSupportedDisplayTypes = ({
  response,
  dataLength,
  pivotDataLength,
} = {}) => {
  try {
    if (!_get(response, 'data.data.display_type')) {
      return []
    }
    // There should be 3 types: data, suggestion, help
    const displayType = response.data.data.display_type

    if (
      displayType === 'suggestion' ||
      displayType === 'help' ||
      displayType === 'html'
    ) {
      return [displayType]
    }

    const rows = _get(response, 'data.data.rows', [])
    const columns = getVisibleColumns(response)

    if (!_get(columns, 'length') || !_get(rows, 'length')) {
      return ['text']
    }

    if (isSingleValueResponse(response)) {
      return ['single-value']
    }

    const maxRowsForPivot = 1000
    const maxRowsForPieChart = 10
    const numRows = dataLength || rows.length
    const isTableEmpty = dataLength === 0
    const isPivotTableEmpty = pivotDataLength === 0
    if (supportsRegularPivotTable(columns) && !isTableEmpty) {
      // The only case where 3D charts are supported (ie. heatmap, bubble, etc.)
      let supportedDisplayTypes = ['table']

      if (numRows <= maxRowsForPivot) {
        supportedDisplayTypes.push('pivot_table')
      }

      if (numRows <= maxRowsForPivot && !isPivotTableEmpty) {
        supportedDisplayTypes.push(
          'stacked_column',
          'stacked_bar',
          'stacked_line',
          'column',
          'bar',
          'line',
          'bubble',
          'heatmap'
        )
      } else if (numRows > maxRowsForPivot) {
        console.warn(
          'Supported Display Types: Rows exceeded 1000, only allowing regular table display type'
        )
      }

      return supportedDisplayTypes
    } else if (supports2DCharts(columns) && !isTableEmpty) {
      // If there is at least one string column and one number
      // column, we should be able to chart anything
      const supportedDisplayTypes = ['table', 'column', 'bar', 'line']

      if (numRows > 1 && numRows <= maxRowsForPieChart) {
        supportedDisplayTypes.push('pie')
      }

      // create pivot based on month and year
      const dateColumnIndex = columns.findIndex(
        (col) => col.type === 'DATE' || col.type === 'DATE_STRING'
      )
      const dateColumn = columns[dateColumnIndex]

      // Check if date pivot should be supported
      if (
        dateColumn &&
        dateColumn?.display_name?.toLowerCase().includes('month') &&
        columns?.length === 2
      ) {
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

export const isDisplayTypeValid = (
  response,
  displayType,
  dataLength,
  pivotDataLength
) => {
  const supportedDisplayTypes = getSupportedDisplayTypes({
    response,
    dataLength,
    pivotDataLength,
  })
  const isValid = displayType && supportedDisplayTypes.includes(displayType)

  return isValid
}

export const getFirstChartDisplayType = (supportedDisplayTypes, fallback) => {
  const chartType = supportedDisplayTypes.find((displayType) =>
    isChartType(displayType)
  )
  if (chartType) {
    return chartType
  }

  return fallback
}

export const getDefaultDisplayType = (
  response,
  defaultToChart,
  preferredDisplayType
) => {
  const supportedDisplayTypes = getSupportedDisplayTypes({ response })
  const responseDisplayType = _get(response, 'data.data.display_type')

  if (supportedDisplayTypes.includes(preferredDisplayType)) {
    return preferredDisplayType
  }

  // If the display type is a recognized non-chart or non-table type
  if (
    responseDisplayType === 'suggestion' ||
    responseDisplayType === 'help' ||
    responseDisplayType === 'html'
  ) {
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
  if (
    (!responseDisplayType && hasData(response)) ||
    responseDisplayType === 'data'
  ) {
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
    const groupByValue =
      rowData[colIndex] === null ? '' : `${rowData[colIndex]}`

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

export const getLongestLabelInPx = (labels, col, config) => {
  if (!labels?.length || !col) {
    return 0
  }

  let max = getChartLabelTextWidthInPx(
    formatChartLabel({ d: labels[0], col, config })
  )

  labels.forEach((label) => {
    const formattedLabel = formatChartLabel({
      d: label,
      col,
      config,
    }).formattedLabel
    const newLabelWidth = getChartLabelTextWidthInPx(formattedLabel)

    if (newLabelWidth > max) {
      max = newLabelWidth
    }
  })

  return max
}

export const shouldLabelsRotate = (tickWidth, longestLabelWidth) => {
  if (isNaN(tickWidth) || isNaN(longestLabelWidth)) {
    return undefined
  }

  // If it is close, default to rotating them.
  const widthDifference = tickWidth - longestLabelWidth
  if (Math.abs(widthDifference) < 5) {
    return true
  }

  return tickWidth < longestLabelWidth
}

export const getTickWidth = (scale, innerPadding) => {
  try {
    const width = scale.bandwidth() + innerPadding * scale.bandwidth() * 2
    return width
  } catch (error) {
    console.error(error)
    return 0
  }
}

export const setCSSVars = (customThemeConfig) => {
  const themeConfig = getThemeConfig(customThemeConfig)

  const { theme, accentColor, fontFamily, accentTextColor } = themeConfig
  const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
  if (accentColor) {
    themeStyles['accent-color'] = accentColor
  }
  if (fontFamily) {
    themeStyles['font-family'] = fontFamily
  }
  if (accentTextColor) {
    themeStyles['accent-text-color'] = accentTextColor
  } else {
    let accentTextColor = accentColor
    //Learnt below from https://gomakethings.com/dynamically-changing-the-text-color-based-on-background-color-contrast-with-vanilla-js/

    if (accentTextColor.slice(0, 1) === '#') {
      accentTextColor = accentTextColor.slice(1)
    }

    // If a three-character hexcode, make six-character
    if (accentTextColor.length === 3) {
      accentTextColor = accentTextColor
        .split('')
        .map(function (accentTextColor) {
          return accentTextColor + accentTextColor
        })
        .join('')
    }
    // Convert to RGB value
    let r = parseInt(accentTextColor.substr(0, 2), 16)
    let g = parseInt(accentTextColor.substr(2, 2), 16)
    let b = parseInt(accentTextColor.substr(4, 2), 16)
    // Get YIQ ratio
    let yiq = (r * 299 + g * 587 + b * 114) / 1000
    // Check contrast

    //Learnt above from https://gomakethings.com/dynamically-changing-the-text-color-based-on-background-color-contrast-with-vanilla-js/
    themeStyles['accent-text-color'] = yiq >= 140 ? 'black' : 'white'
  }

  for (let property in themeStyles) {
    document.documentElement.style.setProperty(
      `--react-autoql-${property}`,
      themeStyles[property]
    )
  }
}

export const setStyleVars = ({ themeStyles, prefix }) => {
  for (let property in themeStyles) {
    document.documentElement.style.setProperty(
      `${prefix}${property}`,
      themeStyles[property]
    )
  }
}

export const getQueryParams = (url) => {
  try {
    let queryParams = {}
    // create an anchor tag to use the property called search
    let anchor = document.createElement('a')
    // assigning url to href of anchor tag
    anchor.href = url
    // search property returns the query string of url
    let queryStrings = anchor.search.substring(1)
    let params = queryStrings.split('&')

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
    let left = parseInt(window.getComputedStyle(element)['padding-left'], 10)
    let right = parseInt(window.getComputedStyle(element)['padding-right'], 10)
    let top = parseInt(window.getComputedStyle(element)['padding-top'], 10)
    let bottom = parseInt(
      window.getComputedStyle(element)['padding-bottom'],
      10
    )

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

export const isSingleValueResponse = (response) => {
  if (!response) {
    return false
  }

  return (
    _get(response, 'data.data.rows.length') === 1 &&
    _get(response, 'data.data.rows[0].length') === 1
  )
}

export const hasData = (response) => {
  if (!response) {
    return false
  }

  const hasData =
    _get(response, 'data.data.rows.length') &&
    _get(response, 'data.data.rows.length')
  return hasData
}

export const setCaretPosition = (elem, caretPos) => {
  if (elem != null) {
    if (elem.createTextRange) {
      const range = elem.createTextRange()
      range.move('character', caretPos)
      range.select()
    } else {
      if (elem.selectionStart) {
        elem.focus()
        elem.setSelectionRange(caretPos, caretPos)
      } else elem.focus()
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

export const dateSortFn = (a, b, displayType) => {
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
    if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
      aDate = dayjs(a).unix()
      bDate = dayjs(b).unix()
    }

    // Finally if all else fails, just compare the 2 values directly
    if (!aDate || !bDate) {
      // If one is a YYYY-WW
      if (a.includes('-W')) {
        let aDateYear = a.substring(0, 4)
        let bDateYear = b.substring(0, 4)
        if (aDateYear !== bDateYear) {
          if (displayType === 'chart') {
            return aDateYear - bDateYear
          }
          return bDateYear - aDateYear
        } else {
          let aDateWeek = a.substring(6, 8)
          let bDateWeek = b.substring(6, 8)
          if (isChart) {
            return aDateWeek - bDateWeek
          }
          return bDateWeek - aDateWeek
        }
      }
      // If one is a weekday name
      else if (WEEKDAY_NAMES.includes(a.trim())) {
        const aDayIndex = WEEKDAY_NAMES.findIndex((d) => d === a.trim())
        const bDayIndex = WEEKDAY_NAMES.findIndex((d) => d === b.trim())

        if (aDayIndex >= 0 && bDayIndex >= 0) {
          return bDayIndex - aDayIndex
        }
        return b - a
      }
      // If one is a month name
      else if (MONTH_NAMES.includes(a.trim())) {
        const aMonthIndex = MONTH_NAMES.findIndex((m) => m === a.trim())
        const bMonthIndex = MONTH_NAMES.findIndex((m) => m === b.trim())
        if (aMonthIndex >= 0 && bMonthIndex >= 0) {
          return bMonthIndex - aMonthIndex
        }
        return b - a
      }
    }
    if (displayType === 'chart') {
      return aDate - bDate
    }
    return bDate - aDate
  } catch (error) {
    console.error(error)
    return -1
  }
}

export const sortDataByDate = (data, tableColumns, displayType) => {
  try {
    if (!data || typeof data !== 'object') {
      return data
    }
    const dateColumnIndex = getDateColumnIndex(tableColumns)
    if (dateColumnIndex >= 0) {
      let sortedData = [...data].sort((a, b) =>
        dateSortFn(a[dateColumnIndex], b[dateColumnIndex], displayType)
      )
      return sortedData
    }
    return data
  } catch (error) {
    console.error(error)
    return data
  }
}

export const handleTooltipBoundaryCollision = (e, self) => {
  const { target } = e
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
