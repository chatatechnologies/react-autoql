// The reports workspace (<Reports>): a host's reports, each open in a tab with its own ReportBuilder, saved to
// AutoQL's report service as it's edited. Its class names, apart from the builder's.

export const RS = 'react-autoql-reports'

// Waits for a pause in editing before saving; each save sends the whole report.
export const SAVE_DELAY_MS = 2000

// The most a list asks the service for at once (its own limit).
export const REPORTS_PAGE_SIZE = 200

// Where the open tabs and their widths are remembered in the browser, after the host's prefix.
export const DEFAULT_STORAGE_PREFIX = 'react-autoql.'
export const TABS_STORAGE_KEY = 'reportTabs'
export const TAB_WIDTHS_STORAGE_KEY = 'reportTabWidths'
