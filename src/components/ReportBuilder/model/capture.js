import { isChartType } from 'autoql-fe-utils'
import { DEFAULT_TABLE_ROWS, MAX_TABLE_ROWS, TABLE_ROW_OPTIONS } from '../constants'
import { classifyResponse } from '../run/reportRun'
import { getEffectiveDisplay } from './dataBlock'

// An answer kept as a Data block's capture — the shape QueryOutput.captureForReport makes — for a question
// asked from a report rather than one on screen. Nothing on screen shaped it, so it shows the way AutoQL
// would show it by default; asked again, it keeps the settings the block already had (recaptureFromResponse).

// A chart draws every row it keeps, so it keeps at most this many (the limit "Add to Report…" applies).
export const MAX_CHART_ROWS = 2000

// Shown as a table on paper instead: the builder can't print these yet.
const UNPRINTABLE_TYPES = ['pivot_table', 'network_graph', 'sankey', 'treemap']

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// How an answer of `rowCount` rows is kept when it would be shown as `displayType`: as a table when the builder
// can't print that type, or when it's a chart of more rows than a chart keeps (it would draw part of the result as
// if it were all of it).
const printableDisplayType = (displayType, rowCount) =>
  UNPRINTABLE_TYPES.includes(displayType) || (isChartType(displayType) && rowCount > MAX_CHART_ROWS)
    ? 'table'
    : displayType

// An answer's data and rows, or why it has none to keep: { ok: false, reason } as captureFromResponse says it.
const answerOf = (response) => {
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
  return { ok: true, data, rows, columns, countRows }
}

// Which columns an answer shows, by name.
const visibilityOf = (columns) => {
  const columnVisibility = {}
  columns.forEach((col) => {
    if (col?.name) {
      columnVisibility[col.name] = col.is_visible !== false
    }
  })
  return columnVisibility
}

// What a capture keeps of the answer itself. A table keeps its first rows only; a chart, every row it draws.
const dataOf = ({ data, rows, columns, countRows }, displayType) => ({
  columns,
  rows: displayType === 'table' ? rows.slice(0, MAX_TABLE_ROWS) : rows,
  count_rows: countRows,
  text: data.text,
  query_id: data.query_id,
  interpretation: data.interpretation,
  parsed_interpretation: data.parsed_interpretation,
})

// How many rows a new block's table prints: all of it when one of the row options holds it, else the default.
export const rowsForCapture = (capture) => {
  if (capture?.displayType !== 'table') {
    return DEFAULT_TABLE_ROWS
  }
  const total = capture.data?.count_rows
  return TABLE_ROW_OPTIONS.find((n) => n >= total) ?? DEFAULT_TABLE_ROWS
}

// The capture made plain JSON: an answer's columns can be class instances with functions on them.
const keep = (capture) => {
  try {
    const plain = JSON.parse(JSON.stringify(capture))
    return { ok: true, capture: plain, rows: rowsForCapture(plain) }
  } catch (error) {
    return { ok: false, reason: 'unsupported' }
  }
}

// { ok: true, capture, rows } — rows being what the block's table should print — or { ok: false, reason }:
// 'error' (with the server's message) when the question didn't answer with data, 'no-data' without columns.
export const captureFromResponse = (response, { capturedAt = new Date().toISOString() } = {}) => {
  const answer = answerOf(response)
  if (!answer.ok) {
    return answer
  }
  const { data, rows, columns, countRows } = answer
  const displayType = printableDisplayType(getEffectiveDisplay(response).displayType, Math.max(countRows, rows.length))
  const orders = Array.isArray(data.fe_req?.orders) ? data.fe_req.orders : []

  return keep({
    version: 1,
    capturedAt,
    displayType,
    data: dataOf(answer, displayType),
    ...(displayType === 'table' ? { table: { sort: orders, filtered: false } } : {}),
    config: { displayType, columnVisibility: visibilityOf(columns), orders },
  })
}

// A question asked again (Rerun) where a block already has its settings: the new answer, in the settings it kept.
// `kept` is the block's capture, which in a report made from a template holds only those settings, with no answer.
// It keeps its table and chart settings (`table`, `config`) and takes the answer's data and when it came.
//
// - It's shown as the block shows it (`displayType`, its own choice), else as it was kept, else as AutoQL shows it
//   by default, while the new answer can be shown that way, and with captureFromResponse's rules for what can't
//   be printed.
// - The rows are in the order the question was asked for (`fe_req.orders`, else `orders`, the order it was asked
//   with), which is what the table and its caption say they're sorted by.
// - The table's columns go by position (`table.columnIndices`) only while each one is a column of the new answer;
//   otherwise they're left to `config.columnVisibility`, which goes by name. Its filters, typed against the rows
//   kept before, are dropped: the new rows aren't filtered.
export const recaptureFromResponse = (
  response,
  { kept, displayType: shownAs, orders: askedWith, capturedAt = new Date().toISOString() } = {},
) => {
  const answer = answerOf(response)
  if (!answer.ok) {
    return answer
  }
  const { data, rows, columns, countRows } = answer
  const before = isObject(kept) ? kept : {}
  const preferred = [shownAs, before.displayType].find((type) => typeof type === 'string' && type) || undefined
  const displayType = printableDisplayType(
    getEffectiveDisplay(response, preferred).displayType,
    Math.max(countRows, rows.length),
  )
  const orders = Array.isArray(data.fe_req?.orders) ? data.fe_req.orders : Array.isArray(askedWith) ? askedWith : []

  let table
  if (isObject(before.table) || displayType === 'table') {
    table = { ...before.table, sort: orders, filtered: false }
    delete table.filters
    const { columnIndices } = table
    const indicesFit =
      Array.isArray(columnIndices) &&
      columnIndices.every((index) => Number.isInteger(index) && index >= 0 && index < columns.length)
    if (!indicesFit) {
      delete table.columnIndices
    }
  }

  const config = isObject(before.config) ? before.config : {}
  const keptVisibility = isObject(config.columnVisibility) ? config.columnVisibility : {}
  const columnVisibility = visibilityOf(columns)
  Object.keys(columnVisibility).forEach((name) => {
    if (typeof keptVisibility[name] === 'boolean') {
      columnVisibility[name] = keptVisibility[name]
    }
  })

  return keep({
    ...before,
    version: 1,
    capturedAt,
    displayType,
    data: dataOf(answer, displayType),
    ...(table ? { table } : {}),
    config: { ...config, displayType, columnVisibility, orders },
  })
}
