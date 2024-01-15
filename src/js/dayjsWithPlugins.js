import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isBetween from 'dayjs/plugin/isBetween'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isToday from 'dayjs/plugin/isToday'
import minMax from 'dayjs/plugin/minMax'

dayjs.extend(utc)
dayjs.extend(minMax)
dayjs.extend(isToday)
dayjs.extend(timezone)
dayjs.extend(isBetween)
dayjs.extend(weekOfYear)
dayjs.extend(quarterOfYear)
dayjs.extend(advancedFormat)
dayjs.extend(isSameOrBefore)
dayjs.extend(localizedFormat)
dayjs.extend(customParseFormat)
;(function applyLocale() {
  const specificLanguageCode = window.navigator.language || 'en'
  const genericLanguageCode = specificLanguageCode.split('-')[0]

  try {
    // Check if file exists, then use it
    require(`dayjs/locale/${specificLanguageCode}.js`)
    dayjs.locale(specificLanguageCode)
  } catch (error) {
    try {
      require(`dayjs/locale/${genericLanguageCode}.js`)
      dayjs.locale(genericLanguageCode)
    } catch (error2) {
      // do nothing
    }
  }
})()

export default dayjs
