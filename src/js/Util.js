import Numbro from 'numbro'
import dayjs from 'dayjs'

var href

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

      const width = svgElement.getBBox().width * 2
      const height = svgElement.getBBox().height * 2

      // create a canvas element to pass through
      var canvas = document.createElement('canvas')
      canvas.width = height + margin
      canvas.height = width + margin
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

// Lodash get function and dependencies
// function get(object, path, defaultValue) {
//   var result = object == null ? undefined : baseGet(object, path);
//   return result === undefined ? defaultValue : result;
// }

// function baseGet(object, path) {
//   path = castPath(path, object);

//   var index = 0,
//       length = path.length;

//   while (object != null && index < length) {
//     object = object[toKey(path[index++])];
//   }
//   return (index && index == length) ? object : undefined;
// }

// function castPath(value, object) {
//   if (isArray(value)) {
//     return value;
//   }
//   return isKey(value, object) ? [value] : stringToPath(toString(value));
// }

// function toKey(value) {
//   if (typeof value == 'string' || isSymbol(value)) {
//     return value;
//   }
//   var result = (value + '');
//   return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
// }
