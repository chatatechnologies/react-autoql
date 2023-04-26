import { isColumnNumberType } from '../QueryOutput/columnHelpers'
import { getPrecisionForDayJS } from '../../js/dateUtils'
import dayjs from '../../js/dayjsWithPlugins'

export const formatTableParams = (params, table, columns) => {
  const formattedSorters = formatSortersForAPI(params, table, columns)
  const formattedFilters = formatFiltersForAPI(params, table, columns)

  const configState = {
    sorters: formattedSorters,
    filters: formattedFilters,
    page: params?.page,
  }

  return configState
}

export const formatSortersForAPI = (params, table, columns) => {
  const sorters = []
  if (params?.sort?.length > 0 && table) {
    params.sort.forEach((sorter) => {
      try {
        const column = columns?.[Number(sorter.field)]
        if (column) {
          const name = column.name
          const sort = sorter.dir.toUpperCase()

          if (name && sort) {
            sorters.push({ name, sort })
          }
        }
      } catch (error) {
        console.error(error)
      }
    })
  }

  return sorters
}

export const formatNumberFilterValue = (headerValue = '') => {
  const strNumber = headerValue.trim().replace(/[^0-9.]/g, '')
  const value = Number(strNumber)
  if (!strNumber || isNaN(value)) {
    throw new Error('Unable to convert string to number')
  }

  let operator = '='

  const trimmedStringValue = headerValue.trim()
  if (trimmedStringValue.length >= 2) {
    if (['<=', '>=', '!='].includes(trimmedStringValue.substring(0, 2))) {
      operator = trimmedStringValue.substring(0, 2)
    } else if (['=', '<', '>'].includes(trimmedStringValue.substring(0, 1))) {
      operator = trimmedStringValue.substring(0, 1)
    }
  }

  return { value: strNumber, operator }
}

export const formatFiltersForAPI = (params, table, columns) => {
  // for Number type column =,<,>,<=  >=
  // for String the operator is = or like
  const filters = []

  // test to see if there is an error, if it continues for loop
  if (params?.filter?.length > 0 && table) {
    params.filter.forEach((filter) => {
      try {
        const column = columns?.[Number(filter.field)]
        if (column) {
          const filterObj = {
            name: column.name,
            displayName: column.title,
            value: filter.value,
            operator: 'like',
          }

          if (isColumnNumberType(column)) {
            const formatted = formatNumberFilterValue(filter.value)
            filterObj.operator = formatted.operator
            filterObj.value = formatted.value
          } else if (column.type === 'DATE') {
            const dates = filter.value.split(' to ')
            const precision = getPrecisionForDayJS(column.precision)
            const startDate = dayjs.utc(dates[0]).startOf(precision).toISOString()
            const endDate = dayjs
              .utc(dates[1] ?? dates[0])
              .endOf(precision)
              .toISOString()
            filterObj.value = `${startDate},${endDate}`
            filterObj.operator = 'between'
          }

          filters.push(filterObj)
        }
      } catch (error) {
        console.warn(error)
      }
    })
  }
  return filters
}
