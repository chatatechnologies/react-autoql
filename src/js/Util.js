import Numbro from 'numbro'
import dayjs from 'dayjs'

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

// export const isNumber = value => {
//   if (
//     !_.isNil(value) &&
//     !_.isNaN(_.toNumber(value)) &&
//     value !== 'inf' &&
//     value !== '-inf' &&
//     value !== '' &&
//     !_.isFinite(_.toNumber(value))
//   ) {
//     return true
//   }
//   return false
// }

export const formatChartLabel = (d, col) => {
  if (!col || !col.type) {
    return d
  }

  let formattedLabel = d
  switch (col.type) {
    case 'STRING': {
      break
    }
    case 'DOLLAR_AMT': {
      // We will need to grab the actual currency symbol here. Will that be returned in the query response?
      formattedLabel = Numbro(d).formatCurrency({
        thousandSeparated: true,
        mantissa: 0
      })
      break
    }
    case 'QUANTITY': {
      break
    }
    case 'DATE': {
      const title = col.title
      if (title && title.includes('Year')) {
        formattedLabel = dayjs.unix(d).format('YYYY')
      } else if (title && title.includes('Month')) {
        formattedLabel = dayjs.unix(d).format('MMMM YYYY')
      } else {
        formattedLabel = dayjs.unix(d).format('MMMM D, YYYY')
      }
      break
    }
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

  if (typeof formattedLabel === 'string' && formattedLabel.length > 25) {
    return `${formattedLabel.substring(0, 18)}...`
  }
  return formattedLabel
}

export const formatElement = (element, column) => {
  let formattedElement = element
  if (column) {
    switch (column.type) {
      case 'STRING': {
        // do nothing
        break
      }
      case 'DOLLAR_AMT': {
        // We will need to grab the actual currency symbol here. Will that be returned in the query response?
        if (Number(element)) {
          formattedElement = Numbro(element).formatCurrency({
            thousandSeparated: true,
            mantissa: 2
          })
        }
        break
      }
      case 'QUANTITY': {
        if (Number(element) && Number(element) % 1 !== 0) {
          formattedElement = Numbro(element).format('0,0.0')
        }
        break
      }
      case 'DATE': {
        // This will change when the query response is refactored
        const title = column.title
        if (title && title.includes('Year')) {
          formattedElement = dayjs.unix(element).format('YYYY')
        } else if (title && title.includes('Month')) {
          formattedElement = dayjs.unix(element).format('MMMM YYYY')
        } else {
          formattedElement = dayjs.unix(element).format('MMMM D, YYYY')
        }
        break
      }
      case 'PERCENT': {
        if (Number(element)) {
          formattedElement = Numbro(element).format('0.00%')
        }
        break
      }
      default: {
        break
      }
    }
  }
  return formattedElement
}
