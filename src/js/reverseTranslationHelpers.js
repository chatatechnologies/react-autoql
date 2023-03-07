import dayjs from './dayjsWithPlugins'

const isIsoDate = (str) => {
  if (!str) {
    return false
  }

  try {
    if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) {
      return false
    }
    var d = new Date(str)
    return d.toISOString() === str
  } catch (error) {
    return false
  }
}

const formatChunkWithDates = (chunk) => {
  let isDate = false
  let text = chunk.eng
  let dateArray = []

  try {
    const textArray = chunk.eng.split(' ')
    const textWithDatesArray = textArray.map((str) => {
      if (isIsoDate(str)) {
        const dateDayJS = dayjs(str).utc()
        const formattedDate = dateDayJS.format('ll')
        if (formattedDate !== 'Invalid Date') {
          isDate = true
          dateArray.push(dateDayJS)
          return formattedDate
        }
      }
      return str
    })

    text = textWithDatesArray.join(' ')
  } catch (error) {
    isDate = false
  }

  if (isDate) {
    return {
      c_type: 'DATE',
      eng: text,
      dateArray,
    }
  }

  return {
    c_type: 'TEXT',
    eng: text,
  }
}

const removeEscape = (input) => {
  return input.substring(1, input.length - 1).replace("''", "'")
}

const splitStrByReplacements = (str, replacements, type) => {
  let prevIndex = 0
  const chunkedFilter = []

  replacements.forEach((replacement, i) => {
    // Text before value label
    if (replacement.index > prevIndex) {
      const textBefore = str.substring(prevIndex, replacement.index)
      chunkedFilter.push({
        c_type: 'VL_PREFIX',
        eng: textBefore,
      })
    }

    // Value label
    const endIndex = replacement[0].length + replacement.index
    const valueLabelText = str.substring(replacement.index, endIndex)
    const nonEscapedText = removeEscape(valueLabelText)
    prevIndex = endIndex
    chunkedFilter.push({
      c_type: type,
      eng: nonEscapedText,
    })

    // Text after last value label
    if (i === replacements.length - 1 && endIndex < str.length) {
      const textAfter = str.substring(endIndex, str.length)
      chunkedFilter.push({
        c_type: 'VL_SUFFIX',
        eng: textAfter,
      })
    }
  })

  return chunkedFilter
}

const parseFilterChunk = (chunk) => {
  try {
    // regex to select all text inside single quotes ignoring escaped apostrophes
    const reg = /'(''|[^'])*'/g
    const input = chunk.eng

    let match
    const replacements = []
    while ((match = reg.exec(input)) !== null) {
      replacements.push(match)
    }

    // If there are no replacements, it is probably a date filter
    if (!replacements.length) {
      const formattedChunk = formatChunkWithDates(chunk)
      return [formattedChunk]
    }

    const splitFilterArray = splitStrByReplacements(input, replacements, 'VALUE_LABEL')

    return splitFilterArray
  } catch (error) {
    // If error, just render as plain text
    return [
      {
        c_type: 'TEXT',
        eng: chunk.eng,
      },
    ]
  }
}

export const constructRTArray = (interpretation) => {
  try {
    if (!interpretation) {
      return undefined
    }

    const reverseTranslationArray = []

    if (interpretation?.length) {
      interpretation.forEach((chunk) => {
        if (chunk.c_type === 'FILTER' || chunk.c_type === 'SEED') {
          const chunkedFilterArray = parseFilterChunk(chunk)
          chunkedFilterArray.forEach((filterChunk) => {
            reverseTranslationArray.push(filterChunk)
          })
        } else {
          reverseTranslationArray.push(chunk)
        }
      })
    }

    return reverseTranslationArray
  } catch (error) {
    console.error(error)
    return undefined
  }
}
