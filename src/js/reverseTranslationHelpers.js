import dayjs from './dayjsWithPlugins'
import _get from 'lodash.get'

export const constructRTArray = (response) => {
  try {
    const interpretation = _get(response, 'data.data.parsed_interpretation')
    if (!interpretation) {
      return undefined
    }

    const reverseTranslationArray = []

    if (_get(interpretation, 'length')) {
      interpretation.forEach((chunk) => {
        if (chunk.c_type === 'FILTER') {
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

const splitStrByReplacements = (str, replacements, type) => {
  let prevIndex = 0
  const chunkedFilter = []

  replacements.forEach((replacement, i) => {
    // Text before value label
    if (replacement.index > prevIndex) {
      const textBefore = str.substring(prevIndex, replacement.index)
      chunkedFilter.push({
        c_type: 'TEXT',
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
        c_type: 'TEXT',
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
    let replacements = []
    while ((match = reg.exec(input)) != null) {
      replacements.push(match)
    }

    // If there are no replacements, it is probably a date filter
    if (!replacements.length) {
      const formattedChunk = formatChunkWithDates(chunk)
      return [formattedChunk]
    }

    const splitFilterArray = splitStrByReplacements(
      input,
      replacements,
      'VALUE_LABEL'
    )

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

const formatChunkWithDates = (chunk) => {
  try {
    const textArray = chunk.eng.split(' ')
    const textWithDatesArray = textArray.map((text) => {
      const formattedDate = dayjs(text)
        .utc()
        .format('ll')
      if (formattedDate !== 'Invalid Date') {
        return formattedDate
      }
      return text
    })

    const textWithDates = textWithDatesArray.join(' ')
    return {
      c_type: 'DATE',
      eng: textWithDates,
    }
  } catch (error) {
    return {
      c_type: 'TEXT',
      eng: chunk.eng,
    }
  }
}

const removeEscape = (input) => {
  return input.substring(1, input.length - 1).replace("''", "'")
}
