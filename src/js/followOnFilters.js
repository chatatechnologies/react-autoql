// How long a client-side table filter has to stay unchanged before it is recorded on
// the query. Each recorded change costs the backend a post-processor round trip.
export const FOLLOW_ON_FILTERS_DEBOUNCE_MS = 1000

// Table filters as the API takes them: BETWEEN values stripped of stray brackets, and
// the column's type added so the backend can read the value.
export const enrichTableFilters = (filters = [], columns = []) =>
  filters.map((filter) => {
    const column = columns?.find((col) => col.name === filter.name)
    return {
      ...filter,
      ...(filter?.operator === 'between' && typeof filter?.value === 'string'
        ? { value: filter.value.replace(/^(?:\(+|\)+)$/g, '') }
        : {}),
      ...(column?.type ? { column_type: column.type } : {}),
    }
  })

// The filters the follow-on query needs to know about, without the FE-only fields
// (display name, Tabulator id) that ride along on table filters.
export const formatFiltersForFollowOn = (filters = [], columns = []) =>
  enrichTableFilters(filters, columns).map(({ name, operator, value, column_type }) => ({
    name,
    operator,
    value,
    ...(column_type ? { column_type } : {}),
  }))

// Identifies a filter state, so a sort - or the same filters set again - is not mistaken
// for a change.
export const getFollowOnFilterKey = (filters = []) =>
  JSON.stringify(
    (filters ?? [])
      .map(({ name, operator, value }) => [name, operator, `${value}`])
      .sort((a, b) => a.join().localeCompare(b.join())),
  )
