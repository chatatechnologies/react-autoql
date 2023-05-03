import dayjs from '../../js/dayjsWithPlugins'
import { WEEKDAY_NAMES_SUN } from '../../js/Constants'
import { CONTINUOUS_TYPE, PERIODIC_TYPE, EXISTS_TYPE, COMPARE_TYPE } from './DataAlertConstants'
import { isSingleValueResponse } from '../../js/Util'

export const getSupportedConditionTypes = (expression, queryResponse) => {
  try {
    // 1. EXISTS - When new data is detected for the query
    // 2. COMPARE - When a certain condition is met

    if (expression?.[0]) {
      const firstCondition = expression?.[0]?.condition
      if (firstCondition && firstCondition === EXISTS_TYPE) {
        return [EXISTS_TYPE]
      }

      return [COMPARE_TYPE]
    }

    // Currently single value response queries are the only
    // queries that support custom conditions
    if (isSingleValueResponse(queryResponse)) {
      return [COMPARE_TYPE]
    }

    return [EXISTS_TYPE]
  } catch (error) {
    console.error(error)
    return []
  }
}

export const showEvaluationFrequencySetting = (notificationType) => {
  return notificationType === CONTINUOUS_TYPE || notificationType === PERIODIC_TYPE
}

export const resetDateIsFuture = (dataAlert) => {
  if (!dataAlert.reset_date) {
    return false
  }

  return dayjs(dataAlert.reset_date).valueOf() > dayjs().valueOf()
}

export const formatResetDate = (dataAlert, short) => {
  if (!dataAlert.reset_date) {
    return ''
  }

  const dateDayJS = dayjs(dataAlert.reset_date).tz(dataAlert.time_zone)

  if (short) {
    return `${dateDayJS.format('MMM DD, YYYY h:mma')}`
  }

  return `${dateDayJS.format('MMMM DD, YYYY [at] h:mma')} (${dataAlert.time_zone})`
}

export const formatNextScheduleDate = (schedules, short) => {
  if (!schedules?.length) {
    return ''
  }

  const date = schedules[0]?.next_evaluation
  const timezone = schedules[0]?.time_zone
  const dateDayJS = dayjs(date).tz(timezone)

  if (short) {
    return `${dateDayJS.format('MMM DD, YYYY h:mma')}`
  }

  return `${dateDayJS.format('MMM DD, YYYY [at] h:mma')} (${timezone})`
}

export const getTimeObjFromTimeStamp = (timestamp, timezone) => {
  if (!timestamp || !timezone) {
    return
  }

  const dateDayJS = dayjs(timestamp).tz(timezone)

  const hour24 = dateDayJS.hour()
  let hour = hour24 % 12
  if (hour === 0) {
    hour = 12
  }

  const timeObj = {
    ampm: dateDayJS.format('a'),
    value: dateDayJS.format('h:mma'),
    value24hr: dateDayJS.format('H:mm'),
    minute: dateDayJS.minute(),
    hour24,
    hour,
  }

  return timeObj
}

export const getWeekdayFromTimeStamp = (timestamp, timezone) => {
  const dateDayJS = dayjs(timestamp).tz(timezone)
  const dayNumber = dateDayJS.day()
  return WEEKDAY_NAMES_SUN[dayNumber]
}

export const getDayLocalStartDate = ({ timeObj, timezone, daysToAdd = 0 }) => {
  try {
    const now = dayjs().tz(timezone)
    let nextCycle = now.startOf('minute').set('hour', timeObj.hour24).set('minute', timeObj.minute)
    if (nextCycle.valueOf() < now.valueOf()) {
      nextCycle = now.add(1, 'day').startOf('minute')
    }

    // const tomorrow = today.add(1 + daysToAdd, 'day').startOf('minute')
    // const tomorrowWithTime = nextCycle.set('hour', timeObj.hour24).set('minute', timeObj.minute)
    const nextCycleISO = nextCycle.add(daysToAdd, 'days').format('YYYY-MM-DD[T]HH:mm:00')
    return nextCycleISO
  } catch (error) {
    console.error(error)
    return
  }
}

export const getWeekLocalStartDate = ({ weekDay, timeObj, timezone }) => {
  try {
    const now = dayjs().tz(timezone)
    const weekdayNumber = WEEKDAY_NAMES_SUN.findIndex((day) => weekDay.toLowerCase() === day.toLowerCase()) // dayjs uses Sunday as day 0
    const nextWeekday = now.day(weekdayNumber).startOf('minute')
    const nextWeekdayWithTime = nextWeekday.hour(timeObj.hour24).minute(timeObj.minute)

    if (nextWeekdayWithTime.valueOf() < now.valueOf()) {
      return nextWeekdayWithTime.add(1, 'week').format('YYYY-MM-DD[T]HH:mm:00')
    }

    return nextWeekdayWithTime.format('YYYY-MM-DD[T]HH:mm:00')
  } catch (error) {
    console.error(error)
    return
  }
}

export const getMonthLocalStartDate = ({ monthDay, timeObj, timezone }) => {
  try {
    const now = dayjs().tz(timezone)

    let nextMonthStr
    if (monthDay === 'LAST') {
      nextMonthStr = now.endOf('month').startOf('day').format('ll HH:mm')
    } else if (monthDay === 'FIRST') {
      nextMonthStr = now.add(1, 'month').startOf('month').format('ll HH:mm')
    }

    const nextMonth = dayjs.tz(nextMonthStr, timezone)
    const nextMonthWithTime = nextMonth.hour(timeObj.hour24).minute(timeObj.minute)

    return nextMonthWithTime.format('YYYY-MM-DD[T]HH:mm:00')
  } catch (error) {
    console.error(error)
    return
  }
}
