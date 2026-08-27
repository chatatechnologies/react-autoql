/**
 * Subsequence fuzzy matcher for the filter-lock popover's injected
 * `suggestionList`.
 *
 * Hand-written rather than a new dependency: the injected list is a few hundred
 * values at most, and the ranking below is the ranking this picker needs.
 *
 * Entries are either a bare string or `{ value, show_message }`. The category
 * is carried through untouched so a pick can be disambiguated later — it plays
 * no part in matching or ranking.
 *
 * Ranking, highest first:
 *   1. exact match (case-insensitive)
 *   2. prefix match on the whole string
 *   3. contiguous run, boosted when it starts on a word boundary
 *      ("ch" -> "Anderson **Ch**arities")
 *   4. plain subsequence, scored on contiguity and how early it starts
 * Ties break alphabetically so the order is stable between renders.
 */

const EXACT = 1000000
const PREFIX = 100000
const WORD_BOUNDARY = 10000

const isBoundary = (name, i) => i === 0 || /[\s\-_/&,.]/.test(name[i - 1])

/** Collapse sorted indices into contiguous [start, end) ranges. */
const toRanges = (indices) => {
  const ranges = []
  indices.forEach((i) => {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === i) {
      last[1] = i + 1
    } else {
      ranges.push([i, i + 1])
    }
  })
  return ranges
}

/**
 * `string | { value, show_message }` -> `{ value, show_message }`, or null for
 * anything unusable. Exported so the popover normalises entries the same way.
 */
export const normalizeSuggestionEntry = (entry) => {
  if (typeof entry === 'string') {
    const value = entry.trim()
    return value ? { value, show_message: undefined } : null
  }

  if (entry && typeof entry === 'object' && typeof entry.value === 'string') {
    const value = entry.value.trim()
    return value ? { value, show_message: entry.show_message } : null
  }

  return null
}

/**
 * Score one value against a query. Returns null when the query is not a
 * subsequence of the value.
 *
 * Greedy left-to-right: each query character takes the earliest remaining
 * match. Word-boundary hits are rewarded in the score rather than preferred
 * during the walk, which keeps the walk linear and predictable.
 *
 * `ranges` are [start, end) index pairs into `name`, for highlighting.
 */
export const fuzzyScore = (name, query) => {
  const q = `${query ?? ''}`.trim().toLowerCase()
  if (!q) {
    return { name, score: 0, ranges: [] }
  }

  const lower = name.toLowerCase()
  if (lower === q) {
    return { name, score: EXACT, ranges: [[0, q.length]] }
  }
  if (lower.startsWith(q)) {
    return { name, score: PREFIX - name.length, ranges: [[0, q.length]] }
  }

  const at = lower.indexOf(q)
  if (at !== -1) {
    const base = isBoundary(name, at) ? WORD_BOUNDARY : WORD_BOUNDARY / 2
    return { name, score: base - at - name.length / 100, ranges: [[at, at + q.length]] }
  }

  const indices = []
  let cursor = 0
  for (const ch of q) {
    const found = lower.indexOf(ch, cursor)
    if (found === -1) {
      return null
    }
    indices.push(found)
    cursor = found + 1
  }

  const ranges = toRanges(indices)
  // Fewer ranges = more contiguous = better; earlier start is better; shorter
  // names win ties so "Chen" outranks "Chen Family Foundation" for "chn".
  const contiguity = (q.length - (ranges.length - 1)) * 100
  const boundaries = indices.filter((i) => isBoundary(name, i)).length * 50
  return { name, score: contiguity + boundaries - indices[0] - name.length / 100, ranges }
}

/**
 * Rank `entries` against `query`. Unusable entries are dropped. An empty query
 * returns EVERY entry sorted alphabetically — that is what makes the popover
 * show the full injected list before the user types anything.
 *
 * Results are `{ name, show_message, score, ranges }`. The caller is expected
 * to cap what it renders; this returns the whole ranked set.
 */
export const fuzzyMatch = (entries, query) => {
  const list = (Array.isArray(entries) ? entries : []).map(normalizeSuggestionEntry).filter(Boolean)
  const q = `${query ?? ''}`.trim()

  if (!q) {
    return [...list]
      .sort((a, b) => a.value.localeCompare(b.value))
      .map((entry) => ({ name: entry.value, show_message: entry.show_message, score: 0, ranges: [] }))
  }

  return list
    .map((entry) => {
      const result = fuzzyScore(entry.value, q)
      return result && { ...result, show_message: entry.show_message }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
