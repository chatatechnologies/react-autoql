import { isChartType } from 'autoql-fe-utils'
import { DEFAULT_TABLE_ROWS, MAX_TABLE_ROWS, TABLE_ROW_OPTIONS } from '../constants'
import { classifyResponse } from '../run/reportRun'
import { getEffectiveDisplay } from './dataBlock'

// An answer kept as a Data block's capture — the shape QueryOutput.captureForReport makes — for a question
// asked from a report rather than one on screen. Nothing on screen shaped it, so it shows the way AutoQL
// would show it by default.

// A chart draws every row it keeps, so it keeps at most this many (the limit "Add to Report…" applies).
export const MAX_CHART_ROWS = 2000

// Shown as a table on paper instead: the builder can't print these yet.
const UNPRINTABLE_TYPES = ['pivot_table', 'network_graph', 'sankey']

// How many rows a new block's table prints: all of it when one of the row options holds it, else the default.
export const rowsForCapture = (capture) => {
  if (capture?.displayType !== 'table') {
    return DEFAULT_TABLE_ROWS
  }
  const total = capture.data?.count_rows
  return TABLE_ROW_OPTIONS.find((n) => n >= total) ?? DEFAULT_TABLE_ROWS
}

// { ok: true, capture, rows } — rows being what the block's table should print — or { ok: false, reason }:
// 'error' (with the server's message) when the question didn't answer with data, 'no-data' without columns.
export const captureFromResponse = (response, { capturedAt = new Date().toISOString() } = {}) => {
  const outcome = classifyResponse(response)
  if (outcome.status !== 'success') {
    return { ok: false, reason: 'error', error: outcome.error }
  }
  const data = response.data.data
  const rows = Array.isArray(data.rows) ? data.rows : []
  const columns = Array.isArray(data.columns) ? data.columns : []
  if (!columns.length) {
    return { ok: false, reason: 'no-data' }
  }
  const countRows = typeof data.count_rows === 'number' ? data.count_rows : rows.length

  // A chart of a result bigger than it can keep would draw part of it as if it were all of it.
  let { displayType } = getEffectiveDisplay(response)
  if (
    UNPRINTABLE_TYPES.includes(displayType) ||
    (isChartType(displayType) && Math.max(countRows, rows.length) > MAX_CHART_ROWS)
  ) {
    displayType = 'table'
  }

  const orders = Array.isArray(data.fe_req?.orders) ? data.fe_req.orders : []
  const columnVisibility = {}
  columns.forEach((col) => {
    if (col?.name) columnVisibility[col.name] = col.is_visible !== false
  })

  const capture = {
    version: 1,
    capturedAt,
    displayType,
    data: {
      columns,
      rows: displayType === 'table' ? rows.slice(0, MAX_TABLE_ROWS) : rows,
      count_rows: countRows,
      text: data.text,
      query_id: data.query_id,
      interpretation: data.interpretation,
      parsed_interpretation: data.parsed_interpretation,
    },
    ...(displayType === 'table' ? { table: { sort: orders, filtered: false } } : {}),
    config: { displayType, columnVisibility, orders },
  }

  // Plain JSON: an answer's columns can be class instances with functions on them.
  try {
    const plain = JSON.parse(JSON.stringify(capture))
    return { ok: true, capture: plain, rows: rowsForCapture(plain) }
  } catch (error) {
    return { ok: false, reason: 'unsupported' }
  }
}
