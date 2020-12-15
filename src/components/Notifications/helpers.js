import dayjs from '../../js/dayjsWithPlugins'

export const formateResetDate = (dataAlert) => {
  const date = dayjs.unix(dataAlert.reset_date).tz(dataAlert.time_zone)
  return `${date.format('MMMM DD, YYYY')} at ${date.format('hh:mma')}`
}
