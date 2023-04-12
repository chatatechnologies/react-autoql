import dayjs from '../../js/dayjsWithPlugins'
import { WEEKDAY_NAMES_SUN } from '../../js/Constants'

export const resetDateIsFuture = (dataAlert) => {
  if (!dataAlert.reset_date) {
    return false
  }

  return dayjs(dataAlert.reset_date).valueOf() > dayjs().valueOf()
}

export const formatResetDate = (dataAlert) => {
  if (!dataAlert.reset_date) {
    return ''
  }

  const date = dayjs(dataAlert.reset_date).tz(dataAlert.time_zone)
  return `${date.format('MMMM DD, YYYY')} at ${date.format('h:mma')} (${dataAlert.time_zone})`
}

export const formatResetDateShort = (dataAlert) => {
  if (!dataAlert.reset_date) {
    return ''
  }

  const date = dayjs(dataAlert.reset_date).tz(dataAlert.time_zone)
  return `${date.format('MMM DD, YYYY h:mma')} (${dataAlert.time_zone})`
}

export const getDayLocalStartDate = ({ timeObj, timezone }) => {
  try {
    const today = dayjs().tz(timezone)
    const tomorrow = today.add(1, 'day').startOf('minute')
    const tomorrowWithTime = tomorrow.set('hour', timeObj.hour).set('minute', timeObj.minute)
    const tomorrowWithTimeISO = tomorrowWithTime.format('YYYY-MM-DD[T]hh:mm:00Z')
    return tomorrowWithTimeISO
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
    const nextWeekdayWithTime = nextWeekday.hour(timeObj.hour).minute(timeObj.minute)

    if (nextWeekdayWithTime.valueOf() < now.valueOf()) {
      return nextWeekdayWithTime.add(1, 'week').format('YYYY-MM-DD[T]hh:mm:00Z')
    }

    return nextWeekdayWithTime.format('YYYY-MM-DD[T]hh:mm:00Z')
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
    const nextMonthWithTime = nextMonth.hour(timeObj.hour).minute(timeObj.minute)

    return nextMonthWithTime.format('YYYY-MM-DD[T]hh:mm:00Z')
  } catch (error) {
    console.error(error)
    return
  }
}
