export const formatSortersForAPI = (params, tableRef) => {
  let sorters = []
  if (params.sorters && params.sorters.length > 0) {
    sorters = params.sorters.map((sorter) => {
      const column = tableRef.table.getColumn(sorter.field).getDefinition()

      return {
        name: column.name,
        sort: sorter.dir.toUpperCase(),
      }
    })
  }

  return sorters
}

export const formatFiltersForAPI = (params, tableRef) => {
  let filters = []

  if (params.filters && params.filters.length > 0) {
    filters = params.filters.map((filter) => {
      const column = tableRef.table.getColumn(filter.field).getDefinition()

      return {
        name: column.name,
        operator: 'like', // todo: change this based on column type and filter text
        value: filter.value,
      }
    })
  }
  return filters
}
