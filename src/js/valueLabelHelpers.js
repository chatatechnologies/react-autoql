import { ColumnTypes, fetchVLAutocomplete, getAuthentication } from 'autoql-fe-utils'

// TEMPORARY: the query response doesn't say which columns hold value labels yet, so every
// string column is treated as one. Values that aren't value labels fail to resolve and the
// popover says so. Replace this once the column metadata carries it.
export const isValueLabelColumn = (column) => column?.type === ColumnTypes.STRING

const normalize = (text) => `${text ?? ''}`.trim().toLowerCase()

const rejectWith = (code, message) => {
  const error = new Error(message)
  error.code = code
  return error
}

// Picks the value label a table cell's value stands for, out of the autocomplete's matches.
// The autocomplete is a ranked search, not a lookup, so only an exact match on the stored
// keyword or its display text counts. A match from the cell's own column wins over the same
// text under another column. If what's left would still build different locks, it's
// ambiguous - locking a filter the user didn't mean is worse than not locking one.
export const pickValueLabelMatch = (matches, value, column) => {
  const target = normalize(value)
  const exact = (matches ?? []).filter((m) => normalize(m?.keyword) === target || normalize(m?.format_txt) === target)

  if (!exact.length) {
    throw rejectWith('NOT_FOUND', `No value label found for "${value}"`)
  }

  const sameColumn = column?.name ? exact.filter((m) => m?.column_name === column.name) : []
  const candidates = sameColumn.length ? sameColumn : exact

  const distinct = new Set(
    candidates.map((m) => `${m?.keyword ?? ''}|${m?.canonical ?? ''}|${m?.column_name ?? ''}|${m?.show_message ?? ''}`),
  )
  if (distinct.size > 1) {
    const categories = [...new Set(candidates.map((m) => m?.show_message).filter(Boolean))]
    throw rejectWith(
      'AMBIGUOUS',
      `"${value}" matches more than one value label${categories.length > 1 ? ` (${categories.join(', ')})` : ''}`,
    )
  }

  return candidates[0]
}

// The same shape FilterLockPopover builds for a session lock, so it reads the same wherever
// locks are shown.
export const buildValueLabelLock = (match) => ({
  value: match.keyword,
  format_txt: match.format_txt,
  show_message: match.show_message,
  key: match.canonical,
  filter_type: 'include',
  canonical_key: match.column_name,
  isSession: true,
})

export const resolveValueLabelLock = ({ authentication, value, column, cancelToken }) =>
  fetchVLAutocomplete({
    ...getAuthentication(authentication),
    suggestion: `${value}`,
    cancelToken,
  }).then((response) => buildValueLabelLock(pickValueLabelMatch(response?.data?.data?.matches, value, column)))
