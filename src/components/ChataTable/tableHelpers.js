import { isColumnNumberType } from '../QueryOutput/columnHelpers'

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
  let sorters = []
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
  let value = Number(strNumber)
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

export const formatFiltersForAPI = (params, tableRef) => {
  // for Number type column =,<,>,<=  >=
  // for String the operator is = or like
  let filters = []

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
        }

        filters.push(filterObj)
      } catch (error) {
        console.warn(error)
      }
    })
  }
  return filters
}
