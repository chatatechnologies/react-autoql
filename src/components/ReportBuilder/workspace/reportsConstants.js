// The reports workspace (<Reports>): a host's reports, each open in a tab with its own ReportBuilder, saved to
// AutoQL's report service as it's edited. Its class names, apart from the builder's.

export const RS = 'react-autoql-reports'

// Waits for a pause in editing before saving; each save sends the whole report.
export const SAVE_DELAY_MS = 2000

// The most a list asks the service for at once (its own limit).
export const REPORTS_PAGE_SIZE = 200

// While AutoQL fills in a report's data, how often it's asked how that's going, and the longest it waits between
// asks once they fail. With no news for this long, the fill is taken to have stopped (the service gives up on one
// after 10 minutes without word of it), and the report can be edited again.
export const FILL_POLL_MS = 2000
export const FILL_POLL_MAX_MS = 15000
export const FILL_STALL_MS = 10 * 60 * 1000

// New report › Start from a template, a report for each value picked for the filter lock (RW-353): at most this many at
// once unless the host says otherwise (batchLimit, RW-371); how many are made and filled in at a time; and how many of
// one's questions are asked at a time when this page fills it in. Few: AutoQL's host takes six requests at a time from
// a browser, and fills a few reports at a time.
export const DEFAULT_BATCH_LIMIT = 50
export const BATCH_AT_ONCE = 3
export const BATCH_QUESTIONS_AT_ONCE = 1

// About how long one report of a batch takes to be made, filled in and named, one at a time (s): what "It takes about
// …" says before a batch starts, with BATCH_AT_ONCE made at a time.
export const BATCH_SECONDS_PER_REPORT = 15

// One batch at a time in this browser, whichever tab it's in (RW-371): the tab making one holds a lease, kept under the
// host's storage prefix and renewed this often while it runs, and as each of its reports is done. One not renewed for
// this long was left by a tab that's gone, and another can start: long enough for a browser that slows the timers of a
// tab out of sight.
export const BATCH_HEARTBEAT_MS = 15000
export const BATCH_LEASE_MS = 2 * 60 * 1000

// Where the open tabs and their widths are remembered in the browser, after the host's prefix, and the filter locks
// reports are still to get.
export const DEFAULT_STORAGE_PREFIX = 'react-autoql.'
export const TABS_STORAGE_KEY = 'reportTabs'
export const TAB_WIDTHS_STORAGE_KEY = 'reportTabWidths'
export const PENDING_LOCKS_STORAGE_KEY = 'reportPendingLocks'
export const PENDING_TITLES_STORAGE_KEY = 'reportPendingTitles'
export const BATCH_LEASE_STORAGE_KEY = 'reportBatch'
