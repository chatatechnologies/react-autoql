import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(advancedFormat)
dayjs.extend(LocalizedFormat)
;(function applyLocale() {
  const specificLanguageCode = window.navigator.language || 'en'
  const genericLanguageCode = specificLanguageCode.split('-')[0]

  try {
    // Check if file exists, then use it
    require(`dayjs/locale/${specificLanguageCode}`)
    dayjs.locale(specificLanguageCode)
  } catch (error) {
    try {
      require(`dayjs/locale/${genericLanguageCode}`)
      dayjs.locale(genericLanguageCode)
    } catch (error) {}
  }
})()

export default dayjs
