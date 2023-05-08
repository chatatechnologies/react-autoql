import dayjs from './dayjsWithPlugins'
import { formatElement } from './Util'

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
    c_type: chunk.type === 'FILTER' ? 'FILTER' : 'TEXT',
    eng: text,
  }
}

const removeSingleQuotes = (str) => {
  let text = str.trim()
  if (text.slice(-1) === "'" && Array.from(text)[0] === "'") {
    text = text.substring(1, text.length - 1)
  }

  return text
}

const parseFilterChunk = (chunk) => {
  try {
    // This regex is to select all text inside single quotes ignoring escaped apostrophes
    // Keep in case we need for the future
    // const reg = /'(''|[^'])*'/g

    // Regex to select text in brackets (including the brackets)
    const reg = /\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g
    const input = chunk.eng

    const textOutsideBrackets = input.split(reg)

    let match
    const bracketTextMatches = []
    while ((match = reg.exec(input)) !== null) {
      bracketTextMatches.push(match)
    }

    // Check if filter is a date
    if (!bracketTextMatches.length || bracketTextMatches[0]?.[0] === '(Date)') {
      const formattedChunk = formatChunkWithDates(chunk)
      return [formattedChunk]
    }

    const mergedArray = new Array()
    textOutsideBrackets.forEach((str, i) => {
      const type = !!bracketTextMatches[i] ? 'VALUE_LABEL' : 'TEXT'
      if (textOutsideBrackets[i]) {
        const text = removeSingleQuotes(str)
        mergedArray.push({
          c_type: type,
          eng: text,
        })
      }

      if (bracketTextMatches[i]) {
        mergedArray.push({
          c_type: 'VL_SUFFIX',
          eng: bracketTextMatches[i][0]?.trim(),
        })
      }
    })

    return mergedArray
  } catch (error) {
    console.error(error)
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
