import dayjs from './dayjsWithPlugins'

const isISODate = (str) => {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false
  const d = new Date(str)
  return d instanceof Date && !isNaN(d) && d.toISOString() === str
}

const getDateRangeIntersection = (aRange, bRange) => {
  try {
    const aStart = aRange.startDate
    const aEnd = aRange.endDate
    const bStart = bRange.startDate
    const bEnd = bRange.endDate

    const latestStart = dayjs(aStart).isAfter(dayjs(bStart)) ? aStart : bStart
    const earliestEnd = dayjs(aEnd).isBefore(dayjs(bEnd)) ? aEnd : bEnd

    if (dayjs(latestStart).isAfter(dayjs(earliestEnd))) {
      return null
    }

    return {
      startDate: latestStart,
      endDate: earliestEnd,
    }
  } catch (error) {
    console.error(error)
    return null
  }
}

const getColumnNameForDateRange = (chunkEng) => {
  // Select all parentheses groups
  const bracketRegex = /\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g

  // Take the one on the very end of the string
  const columnNameBrackets = chunkEng.match(bracketRegex).slice(-1).pop()

  // Remove the outer brackets from it
  const columnNameWithoutBrackets = columnNameBrackets.slice(1, -1)
  return columnNameWithoutBrackets
}

const getStartAndEndDateFromDateStrs = (dateRangeStrs) => {
  let startDateDayjs = dayjs(dateRangeStrs[0])
  let endDateDayjs = dateRangeStrs[1] ? dayjs(dateRangeStrs[1]) : startDateDayjs // If there is only 1 date, use it for both start and end

  // Switch dates if end date is before start date
  if (endDateDayjs.isBefore(startDateDayjs)) {
    let temp = startDateDayjs
    startDateDayjs = endDateDayjs
    endDateDayjs = temp
  }

  // We must force the time zone to local for the
  // calendar picker to show the UTC dates properly
  const startDateStr = startDateDayjs.utc().format('ll')
  const endDateStr = endDateDayjs.utc().format('ll')

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  endDate.setHours(23, 59, 59, 999) // end of day

  return { startDate, endDate }
}

const getDateRangesFromInterpretation = (parsedInterpretation) => {
  const parsedInterpretationFilters = parsedInterpretation.filter((chunk) => chunk.c_type === 'FILTER')
  if (!parsedInterpretationFilters.length) {
    return []
  }

  const dateRanges = []
  parsedInterpretationFilters.forEach((chunk) => {
    const splitEng = chunk.eng.split(' ')
    const dateStrs = splitEng.filter((word) => isISODate(word))
    if (dateStrs.length) {
      const columnName = getColumnNameForDateRange(chunk.eng)
      const { startDate, endDate } = getStartAndEndDateFromDateStrs(dateStrs)

      let columnDateRange = { columnName, startDate, endDate }

      // If the column has more than 1 date range in the RT, pick the smallest one
      const existingColumnDateRangeIndex = dateRanges.findIndex((filter) => filter.columnName === columnName)
      if (existingColumnDateRangeIndex >= 0) {
        const existingColumnDateRange = dateRanges[existingColumnDateRangeIndex]
        dateRanges[existingColumnDateRangeIndex] = {
          ...dateRanges[existingColumnDateRangeIndex],
          ...getDateRangeIntersection(columnDateRange, existingColumnDateRange),
        }
      } else {
        dateRanges.push(columnDateRange)
      }
    }
  })

  if (dateRanges?.length) {
    return dateRanges
  }

  return []
}

const getColumnDateRanges = (response) => {
  const parsedInterpretation = response?.data?.data?.parsed_interpretation
  if (!parsedInterpretation) {
    return []
  }

  const dateRanges = getDateRangesFromInterpretation(parsedInterpretation)
  if (dateRanges?.length) {
    return dateRanges
  }

  return []
}

export { getColumnDateRanges }
