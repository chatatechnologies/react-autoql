// What a lock shows as: its display text when it has one, otherwise the stored value
export const getFilterLockLabel = (filter) => `${filter?.format_txt ?? filter?.value ?? ''}`

const MAX_VALUES_PER_GROUP = 4

// A plain-text summary of a set of filter locks, grouped by the category each value came from
// and split by include/exclude. Text rather than HTML so a filter value - which is user data -
// can never inject markup; the newlines render because the tooltip class sets white-space: pre-line.
export const getFilterLockSummary = (filters, title) => {
  if (!filters?.length) {
    return undefined
  }

  const groups = []
  filters.forEach((filter) => {
    const category = filter.show_message || 'Filter'
    const isExcluded = filter.filter_type === 'exclude'
    let group = groups.find((g) => g.category === category && g.isExcluded === isExcluded)

    if (!group) {
      group = { category, isExcluded, values: [] }
      groups.push(group)
    }

    group.values.push(getFilterLockLabel(filter))
  })

  const lines = groups.map(({ category, isExcluded, values }) => {
    const shown = values.slice(0, MAX_VALUES_PER_GROUP)
    const remaining = values.length - shown.length
    const suffix = remaining > 0 ? `, +${remaining} more` : ''
    return `${category}${isExcluded ? ' (excluded)' : ''}: ${shown.join(', ')}${suffix}`
  })

  return [title, ...lines].filter(Boolean).join('\n')
}
