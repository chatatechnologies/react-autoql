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
// once; how many are made and filled in at a time; and how many of one's questions are asked at a time when this page
// fills it in. Few: AutoQL's host takes six requests at a time from a browser, and fills a few reports at a time.
export const BATCH_MAX = 50
export const BATCH_AT_ONCE = 3
export const BATCH_QUESTIONS_AT_ONCE = 1

// Where the open tabs and their widths are remembered in the browser, after the host's prefix, and the filter locks
// reports are still to get.
export const DEFAULT_STORAGE_PREFIX = 'react-autoql.'
export const TABS_STORAGE_KEY = 'reportTabs'
export const TAB_WIDTHS_STORAGE_KEY = 'reportTabWidths'
export const PENDING_LOCKS_STORAGE_KEY = 'reportPendingLocks'
