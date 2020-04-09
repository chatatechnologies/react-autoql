import dayjs from '../../js/dayjsWithPlugins'
import { WEEKDAY_NAMES, MONTH_NAMES } from '../../js/Constants'

const getEnglishList = (strings, inclusive) => {
  const connector = inclusive ? 'and' : 'or'
  let englishList = ''
  strings.forEach((word, i) => {
    if (!strings.length) {
      return ''
    } else if (strings.length === 1) {
      englishList = strings[0]
    } else if (strings.length === 2 && i === strings.length - 1) {
      // Last item of only 2 items, no oxford comma required
      englishList = englishList.concat(` ${connector} ${word}`)
    } else if (strings.length > 2 && i === strings.length - 1) {
      // Oxford comma if last item of more than 2 items
      englishList = englishList.concat(`, ${connector} ${word}`)
    } else if (i !== 0) {
      // Middle of the list
      englishList = englishList.concat(`, ${word}`)
    } else if (i === 0) {
      // First item, no comma
      englishList = englishList.concat(word)
    }
  })

  return englishList
}

const getSingleEventWeekDescription = dayNumbers => {
  const dayNames = dayNumbers.map(day => {
    return WEEKDAY_NAMES[day]
  })

  let dayString = ''
  if (dayNumbers.length === 7) {
    // All days are selected - same as "daily"
    dayString = 'day'
  } else if (
    [2, 3, 4, 5, 6].every(weekday => dayNumbers.includes(weekday)) &&
    [1, 7].every(weekday => !dayNumbers.includes(weekday))
  ) {
    // Weekdays only
    dayString = 'work week'
  } else if (
    [1, 7].every(weekday => dayNumbers.includes(weekday)) &&
    [2, 3, 4, 5, 6].every(weekday => !dayNumbers.includes(weekday))
  ) {
    // Weekends only
    dayString = 'weekend'
  } else {
    dayString = getEnglishList(dayNames)
  }

  return `, but don't notify me again until the next ${dayString}.`
}

const getRepeatEventWeekDescription = dayNumbers => {
  const dayNames = dayNumbers.map(day => {
    // Make this plural for the inclusive case
    return `${WEEKDAY_NAMES[day]}s`
  })

  let dayString = ''
  if (dayNumbers.length === 7) {
    // All days are selected - same as not having the checkbox checked at all
    return '.'
  } else if (
    [2, 3, 4, 5, 6].every(weekday => dayNumbers.includes(weekday)) &&
    [1, 7].every(weekday => !dayNumbers.includes(weekday))
  ) {
    dayString = 'weekdays'
  } else if (
    [1, 7].every(weekday => dayNumbers.includes(weekday)) &&
    [2, 3, 4, 5, 6].every(weekday => !dayNumbers.includes(weekday))
  ) {
    dayString = 'weekends'
  } else {
    dayString = getEnglishList(dayNames, true)
  }

  return `, but only notify me on ${dayString}.`
}

const getMonthDay = dayNumber => {
  const dayName =
    dayNumber === -1 ? 'last' : dayjs(`January ${dayNumber}`).format('Do')
  return dayName
}

const getSingleEventMonthDescription = selection => {
  const dayString = getEnglishList(selection.map(d => getMonthDay(d)))
  return `, but don't notify me again until the ${dayString} day of the month.`
}

const getRepeatEventMonthDescription = selection => {
  const dayString = getEnglishList(selection.map(d => getMonthDay(d)), true)
  return `, but only notify me on the ${dayString} day of the month.`
}

const getSingleEventYearDescription = selection => {
  const monthNames = selection.map(month => {
    return MONTH_NAMES[month]
  })
  const monthString = getEnglishList(monthNames)
  return `, but don't notify me again until the next ${monthString}.`
}

const getRepeatEventYearDescription = selection => {
  const monthNames = selection.map(month => {
    return MONTH_NAMES[month]
  })
  const monthString = getEnglishList(monthNames, true)
  return `, but only notify me in ${monthString}.`
}

export const getScheduleDescription = (
  category,
  frequency,
  repeat,
  selection
) => {
  let categoryDescription = null
  let frequencyDescription = null
  if (category === 'SINGLE_EVENT') {
    categoryDescription = 'Notify me as soon as this happens'
    if (repeat) {
      if (frequency === 'DAY') {
        frequencyDescription = ", but don't notify me again until the next day."
      } else if (frequency === 'WEEK') {
        // frequencyDescription = getSingleEventWeekDescription(selection)
        frequencyDescription =
          ", but don't notify me again until the next Monday."
      } else if (frequency === 'MONTH') {
        // frequencyDescription = getSingleEventMonthDescription(selection)
        frequencyDescription =
          ", but don't notify me again until the first of the next month."
      } else if (frequency === 'YEAR') {
        frequencyDescription = getSingleEventYearDescription(selection)
      }
    } else {
      frequencyDescription = ", then don't notify me again."
    }
  } else if (category === 'REPEAT_EVENT') {
    categoryDescription = 'Notify me every time this happens'

    if (repeat) {
      if (frequency === 'WEEK') {
        frequencyDescription = getRepeatEventWeekDescription(selection)
      } else if (frequency === 'MONTH') {
        frequencyDescription = getRepeatEventMonthDescription(selection)
      } else if (frequency === 'YEAR') {
        frequencyDescription = getRepeatEventYearDescription(selection)
      }
    } else {
      frequencyDescription = '.'
    }
  } else if (category === 'SCHEDULE') {
    categoryDescription = 'Notify me every (description of schedule)'
  }
  return `${categoryDescription}${frequencyDescription}`
}
