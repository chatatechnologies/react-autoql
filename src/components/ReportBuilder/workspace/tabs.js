import { TAB_WIDTHS_STORAGE_KEY, TABS_STORAGE_KEY } from './constants'

// The reports open as tabs in the workspace: which ones, in order, per data source, kept in this browser so
// they're there next time, and the widths their edges were dragged to. Both are kept under the host's storage
// prefix, so a host that clears its own keys on sign-out forgets them too (the prefix 'chata.' gives the wealth
// app's chata.reportTabs and chata.reportTabWidths, in the same format). With no prefix nothing is remembered.
// What's stored is read defensively: it may be old or hand-edited. Ids no longer in the list are the
// workspace's to drop once the list is in.

// More than anyone keeps open: a bound on what's kept.
const MAX_TABS = 30

// No tab is narrower (ReportTabs); a stored width outside these is ignored.
export const MIN_TAB_WIDTH = 96
const MAX_STORED_TAB_WIDTH = 4000

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// Where a prefix keeps a value; null without a prefix, when there's nowhere to keep it.
const keyFor = (prefix, name) => (typeof prefix === 'string' ? `${prefix}${name}` : null)

// A data source's entry in what's stored. A host with no data source keeps its tabs under ''.
const entryOf = (sourceId) => (sourceId === undefined || sourceId === null ? '' : String(sourceId))

// Everything kept under a key, by data source: {} when there's nothing there that can be used.
const readAll = (key) => {
  if (!key) {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return isObject(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

// Writes back what's kept under a key, or removes the key once no data source has anything there. Called
// inside the saves' own try, which takes what storage throws.
const writeAll = (key, all) => {
  if (Object.keys(all).length > 0) {
    window.localStorage.setItem(key, JSON.stringify(all))
  } else {
    window.localStorage.removeItem(key)
  }
}

// ---------------------------------------------------------------- open tabs

// The tabs left open on this data source, oldest first.
export const loadOpenTabs = (prefix, sourceId) => {
  const ids = readAll(keyFor(prefix, TABS_STORAGE_KEY))[entryOf(sourceId)]
  if (!Array.isArray(ids)) {
    return []
  }
  const valid = ids.filter((id) => typeof id === 'string' && id.length > 0)
  return Array.from(new Set(valid)).slice(-MAX_TABS)
}

export const saveOpenTabs = (prefix, sourceId, ids) => {
  const key = keyFor(prefix, TABS_STORAGE_KEY)
  if (!key) {
    return
  }
  try {
    const all = readAll(key)
    if (ids.length > 0) {
      all[entryOf(sourceId)] = ids.slice(-MAX_TABS)
    } else {
      delete all[entryOf(sourceId)]
    }
    writeAll(key, all)
  } catch (error) {
    // Storage full or blocked: the tabs just aren't remembered.
  }
}

// ---------------------------------------------------------------- tab widths

// The widths (px) tabs' edges were dragged to on this data source, for the tabs open there; a tab without one
// fits its title. A width is forgotten with its tab.
export const loadTabWidths = (prefix, sourceId) => {
  const stored = readAll(keyFor(prefix, TAB_WIDTHS_STORAGE_KEY))[entryOf(sourceId)]
  if (!isObject(stored)) {
    return {}
  }
  const widths = {}
  Object.entries(stored).forEach(([id, width]) => {
    if (typeof width === 'number' && width >= MIN_TAB_WIDTH && width <= MAX_STORED_TAB_WIDTH) {
      widths[id] = Math.round(width)
    }
  })
  return widths
}

export const saveTabWidths = (prefix, sourceId, widths) => {
  const key = keyFor(prefix, TAB_WIDTHS_STORAGE_KEY)
  if (!key) {
    return
  }
  try {
    const all = readAll(key)
    if (Object.keys(widths).length > 0) {
      all[entryOf(sourceId)] = widths
    } else {
      delete all[entryOf(sourceId)]
    }
    writeAll(key, all)
  } catch (error) {
    // Storage full or blocked: the widths just aren't remembered.
  }
}

// The widths for these tabs only (a closed or deleted report's is dropped); the same object when none is.
export const widthsFor = (widths, tabs) => {
  const kept = {}
  tabs.forEach((id) => {
    if (widths[id] !== undefined) {
      kept[id] = widths[id]
    }
  })
  return Object.keys(kept).length === Object.keys(widths).length ? widths : kept
}

// ---------------------------------------------------------------- opening and closing

// `id` open as a tab: where it already is, or at the end.
export const withTabOpen = (tabs, id) => (tabs.includes(id) ? tabs : [...tabs, id])

// `id`'s tab closed. When it was the one shown, the tab to its right shows next (the one to its left for the
// last tab), or the home page (null) when no tab is left.
export const withTabClosed = (tabs, id, shown) => {
  const index = tabs.indexOf(id)
  if (index === -1) {
    return { tabs, shown }
  }
  const rest = tabs.filter((tab) => tab !== id)
  if (shown !== id) {
    return { tabs: rest, shown }
  }
  return { tabs: rest, shown: rest[index] ?? rest[index - 1] ?? null }
}
