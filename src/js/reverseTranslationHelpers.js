import dayjs from './dayjsWithPlugins'
import { formatElement } from './Util'
import { isISODate } from 'autoql-fe-utils'
const getRegexMatchArray = (str, reg) => {
  if (!str) {
    return []
  }

  let match
  const matches = []
  while ((match = reg.exec(str)) !== null) {
    if (!!match) {
      matches.push(match)
    }
  }

  return matches
}

const removeSingleQuoteEscape = (input) => {
  return input.substring(1, input.length - 1).replace("''", "'")
}

const formatChunkWithDates = (chunk) => {
  let isDate = false
  let text = chunk.eng
  let dateArray = []

  try {
    const textArray = chunk.eng.split(' ')
    const textWithDatesArray = textArray.map((str) => {
      if (isISODate(str)) {
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
    c_type: chunk.type === 'FILTER' ? 'FILTER' : 'TEXT',
    eng: text,
  }
}

const chunkStrByMatches = (str, matches) => {
  if (!str) {
    return []
  }

  if (!matches?.length) {
    return [{ type: 'TEXT', eng: str }]
  }

  let prevIndex = 0
  let chunkedFilter = []

  matches.forEach((match, i) => {
    const endIndex = match[0].length + match.index
    const valueLabelText = str.substring(match.index, endIndex)
    const nonEscapedText = removeSingleQuoteEscape(valueLabelText)

    // Text before value label
    if (match.index > prevIndex) {
      const textBefore = str.substring(prevIndex, match.index)
      if (textBefore) {
        chunkedFilter.push({ c_type: 'VL_PREFIX', eng: textBefore, for: nonEscapedText })
      }
    }

    // Value label
    chunkedFilter.push({ c_type: 'VALUE_LABEL', eng: nonEscapedText, for: nonEscapedText })

    // Text after last value label
    if (i === matches.length - 1 && endIndex < str.length) {
      const textAfter = str.substring(endIndex, str.length)
      if (textAfter) {
        chunkedFilter.push({ c_type: 'VL_PREFIX', eng: textAfter, for: nonEscapedText })
      }
    }

    prevIndex = endIndex
  })

  return chunkedFilter
}

const chunkNullVLString = (str) => {
  let strArray = []
  const splitStr = str.split('null')

  if (splitStr[0]) {
    strArray.push({
      c_type: 'VL_PREFIX',
      eng: splitStr[0],
      for: 'null',
    })
  }

  strArray.push({
    c_type: 'VALUE_LABEL',
    eng: 'null',
    for: 'null',
    operator: splitStr[0].trim() ?? undefined,
  })

  if (splitStr[1]) {
    strArray.push({
      c_type: 'VL_PREFIX',
      eng: splitStr[1],
      for: 'null',
    })
  }

  return strArray
}

const parseFilterChunk = (chunk) => {
  try {
    // Regex to select text in brackets (including the brackets)
    const bracketsRegex = /\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g
    const singleQuoteRegex = /'(''|[^'])*'/g
    const input = chunk.eng

    const textOutsideBrackets = input.split(bracketsRegex)

    let match
    const bracketTextMatches = []
    while ((match = bracketsRegex.exec(input)) !== null) {
      bracketTextMatches.push(match)
    }

    // Check if filter is a date
    if (
      !bracketTextMatches.length ||
      !textOutsideBrackets.length ||
      bracketTextMatches[0]?.[0] === '(Date)' ||
      textOutsideBrackets[0]?.split(' ')?.find((word) => isISODate(word))
    ) {
      const formattedChunk = formatChunkWithDates(chunk)
      return [formattedChunk]
    }

    let mergedArray = []
    textOutsideBrackets.forEach((str, i) => {
      let strChunked = []

      const isNullVL = str.trim() === 'null' || str.includes(' null ')

      if (isNullVL) {
        strChunked = chunkNullVLString(str)
      } else {
        // Isolate text in single quotes (the value labels)
        const textInQuotesMatches = getRegexMatchArray(str, singleQuoteRegex)
        strChunked = chunkStrByMatches(str, textInQuotesMatches) ?? []
      }

      mergedArray = [...mergedArray, ...strChunked]

      const vlSuffixMatch = bracketTextMatches[i]
      if (vlSuffixMatch) {
        mergedArray.push({
          c_type: 'VL_SUFFIX',
          eng: vlSuffixMatch[0]?.trim(),
          for: strChunked.find((ch) => ch.c_type === 'VALUE_LABEL')?.for,
        })
      }
    })

    return mergedArray
  } catch (error) {
    console.error(error)

    // If error, just render as plain text
    return [{ c_type: 'TEXT', eng: chunk.eng }]
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

export const getDatesFromRT = (queryResponse) => {
  try {
    const parsedRT = queryResponse?.data?.data?.parsed_interpretation
    if (!parsedRT) {
      return
    }

    const rtArray = constructRTArray(parsedRT)
    const timeFrameChunk = rtArray.findLast((chunk) => chunk.c_type === 'DATE')
    return timeFrameChunk?.dateArray
  } catch (error) {
    console.error(error)
    return
  }
}

export const getTimeRangeFromDateArray = (dates) => {
  if (!dates?.length) {
    return
  }

  if (dates.length === 1) {
    return 'DAY'
  } else if (dates.length === 2) {
    // Range of dates. Determine what the interval is
    const range = dayjs(dates[1]).diff(dayjs(dates[0]), 'day')
    if (range <= 1) {
      return 'DAY'
    } else if (range <= 7) {
      return 'WEEK'
    } else if (range <= 31) {
      return 'MONTH'
    }
    // Not supporting for now
    // else if (range <= 366) {
    //   return 'YEAR'
    // }
  }

  // Default frequency
  return 'MONTH'
}

export const getTimeRangeFromRT = (queryResponse) => {
  const dates = getDatesFromRT(queryResponse)
  const timeRange = getTimeRangeFromDateArray(dates)
  return timeRange
}

export const getTimeFrameTextFromChunk = (chunk) => {
  const dates = chunk?.dateArray
  const timeRange = getTimeRangeFromDateArray(dates)

  if (!timeRange) {
    return
  }

  if (!dates || !dates.length) {
    return
  }

  const dayjsPrecision = timeRange.toLowerCase()
  const startDate = dayjs.utc(dates[0]).utc().startOf(dayjsPrecision)
  const endDate = dayjs.utc(dates[1]).utc().endOf(dayjsPrecision)
  const nextStartDate = dayjs.utc(dates[0]).utc().add(1, dayjsPrecision)
  const nextEndDate = dayjs.utc(dates[1]).utc().add(1, dayjsPrecision)
  const today = dayjs().utc()

  const isCurrentTimeFrame = today.isBetween(startDate, endDate)
  const isPreviousTimeFrame = today.isBetween(nextStartDate, nextEndDate)

  const defaultTimeFrame = `between ${startDate.format('ll')} and ${endDate.format('ll')}`
  if (isCurrentTimeFrame) {
    switch (timeRange) {
      case 'DAY':
        return 'today'
      case 'MONTH':
        return 'this month'
      case 'WEEK':
        return 'this week'
      case 'YEAR':
        return 'this year'
      default:
        return defaultTimeFrame
    }
  } else if (isPreviousTimeFrame) {
    switch (timeRange) {
      case 'DAY':
        return 'yesterday'
      case 'MONTH':
        return 'last month'
      case 'WEEK':
        return 'last week'
      case 'YEAR':
        return 'last year'
      default:
        return defaultTimeFrame
    }
  }

  const isoDate = startDate.toISOString()
  const formattedDate = formatElement({ element: isoDate, column: { type: 'DATE', precision: timeRange } })

  switch (timeRange) {
    case 'DAY':
      return `on ${formattedDate}`
    case 'MONTH':
      return `in ${formattedDate}`
    case 'WEEK':
      return `on week ${formattedDate}`
    case 'YEAR':
      return `in ${formattedDate}`
    default:
      return defaultTimeFrame
  }
}
