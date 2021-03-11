import dayjs from '../../js/dayjsWithPlugins'

export const formatResetDate = (dataAlert) => {
  const date = dayjs(dataAlert.reset_date)
  return `${date.format('MMMM DD, YYYY')} at ${date.format('hh:mma')}`
}
