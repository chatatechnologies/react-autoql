import { fetchVLAutocomplete, getAuthentication } from 'autoql-fe-utils'

// A value to lock on (a household's name, say), looked up as a report's filter lock (model/filterLocks.js), the way
// FilterLockPopover looks up a value picked from its list: AutoQL's value-label autocomplete, matched exactly on its
// keyword or its text, whatever the case or padding. It's what lets a report for each household (RW-371) start at
// once, with every household of the host's list picked, and each looked up only as its report is made.
//
// Resolves with the lock, to include the value. Rejects with code NOT_FOUND where nothing matches, or AMBIGUOUS where
// matches would make different locks (two entities with the same name); matches that would make the same one are
// one.
export const lookUpFilterLock = async ({ authentication, value }) => {
  const response = await fetchVLAutocomplete({ ...getAuthentication(authentication), suggestion: value })
  const matches = response?.data?.data?.matches ?? []
  const target = `${value}`.trim().toLowerCase()
  const exact = matches.filter(
    (m) =>
      `${m?.keyword ?? ''}`.trim().toLowerCase() === target || `${m?.format_txt ?? ''}`.trim().toLowerCase() === target,
  )
  if (!exact.length) {
    const error = new Error(`No filterable value found for "${value}"`)
    error.code = 'NOT_FOUND'
    throw error
  }
  const distinct = new Set(
    exact.map((m) => `${m?.keyword ?? ''}|${m?.canonical ?? ''}|${m?.column_name ?? ''}|${m?.show_message ?? ''}`),
  )
  if (distinct.size > 1) {
    const error = new Error(`"${value}" matches more than one filter`)
    error.code = 'AMBIGUOUS'
    throw error
  }
  const [match] = exact
  return {
    key: match.canonical,
    value: match.keyword,
    filter_type: 'include',
    ...(match.column_name ? { canonical_key: match.column_name } : {}),
    ...(match.format_txt ? { format_txt: match.format_txt } : {}),
    ...(match.show_message ? { show_message: match.show_message } : {}),
  }
}
