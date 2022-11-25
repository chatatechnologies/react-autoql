import { isColumnNumberType } from '../QueryOutput/columnHelpers'
import dayjs from '../../js/dayjsWithPlugins'

export const formatTableParams = (params, tableRef) => {
  const formattedSorters = formatSortersForAPI(params, tableRef)
  const formattedFilters = formatFiltersForAPI(params, tableRef)

  const configState = {
    sorters: formattedSorters,
    filters: formattedFilters,
    page: params?.page,
  }

  return configState
}

export const formatSortersForAPI = (params, tableRef) => {
  const sorters = []
  if (params?.sorters?.length > 0 && tableRef) {
    params.sorters.forEach((sorter) => {
      try {
        const column = tableRef.table.getColumn(sorter.field).getDefinition()
        const name = column.name
        const sort = sorter.dir.toUpperCase()
        if (name && sort) {
          sorters.push({ name, sort })
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

const getPrecisionForDayJS = (colPrecision) => {
  switch (colPrecision) {
    case 'DAY': {
      return 'day'
    }
    case 'MONTH': {
      return 'month'
    }
    case 'YEAR': {
      return 'year'
    }
    case 'WEEK': {
      return 'week'
    }
    case 'QUARTER': {
      return 'quarter'
    }
    case 'HOUR' || 'DATE_HOUR': {
      return 'hour'
    }
    case 'MINUTE' || 'DATE_MINUTE': {
      return 'minute'
    }
    default: {
      return 'day'
    }
  }
}

export const formatFiltersForAPI = (params, tableRef) => {
  // for Number type column =,<,>,<=  >=
  // for String the operator is = or like
  const filters = []

  // test to see if there is an error, if it continues for loop
  if (params?.filters?.length > 0 && tableRef) {
    params.filters.forEach((filter) => {
      try {
        const column = tableRef.table.getColumn(filter.field).getDefinition()
        const filterObj = {
          name: column.name,
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
      } catch (error) {
        console.warn(error)
      }
    })
  }
  return filters
}
