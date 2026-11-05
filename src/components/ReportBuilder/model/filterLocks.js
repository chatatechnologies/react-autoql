// A report's filter lock: the AutoQL session filter locks every question in it is asked with, so one report can be
// made again for another household (or whatever the host's data locks on). It's kept at the report's root as
// `sessionFilterLocks`, each lock as the query API takes it in `session_filter_locks`, and FilterLockPopover makes it:
// { key, value, filter_type, … }. A report without one is asked for everything, as before.

// What a report keeps of a lock: what the query API reads and what's shown of it. `isSession` (whether the picker
// would also save it as the user's own lock) means nothing on a report.
const LOCK_FIELDS = ['key', 'value', 'filter_type', 'canonical_key', 'format_txt', 'show_message']

const isLock = (lock) =>
  !!lock &&
  typeof lock === 'object' &&
  typeof lock.key === 'string' &&
  !!lock.key &&
  (typeof lock.value === 'string' || typeof lock.value === 'number') &&
  lock.value !== ''

// The locks as a report keeps them; anything that isn't one is dropped.
export const normalizeFilterLocks = (locks) =>
  (Array.isArray(locks) ? locks : [])
    .filter(isLock)
    .map((lock) =>
      LOCK_FIELDS.reduce((kept, field) => (lock[field] === undefined ? kept : { ...kept, [field]: lock[field] }), {}),
    )

// How a lock reads: its first value and how many more, as "Brown Family" or "Brown Family +2"; '' with none.
export const summarizeFilterLocks = (locks) => {
  const names = normalizeFilterLocks(locks).map((lock) => String(lock.format_txt || lock.value))
  if (!names.length) {
    return ''
  }
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

// The same for any two locks that lock the same values, whatever their order.
export const filterLocksKey = (locks) =>
  normalizeFilterLocks(locks)
    .map((lock) => JSON.stringify([lock.key, String(lock.value), lock.filter_type || '']))
    .sort()
    .join('|')
