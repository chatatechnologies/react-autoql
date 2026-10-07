import {
  constructRTArray,
  getDefaultDisplayType,
  getSupportedDisplayTypes,
  isChartType,
  isColumnSummable,
  isDataLimited,
  isDisplayTypeValid,
} from 'autoql-fe-utils'
import { MAX_TABLE_ROWS, TABLE_ROW_OPTIONS } from '../constants'

// The rules that make a data block honest on paper: what a slice of rows is called, when a total
// is allowed, which columns print, and how the answer was read.

const count = (n) => Number(n).toLocaleString()

const findColumn = (columns, order) =>
  (columns || []).find((col) => col?.name === order?.name) ||
  (order?.id != null ? (columns || []).find((col) => col?.id === order.id) : undefined)

const columnLabel = (col, fallback) => col?.display_name || col?.name || fallback

// "Amount", "Amount, lowest first", "Amount, then Region". null when nothing orders the rows.
export const getOrderLabel = (orders, columns) => {
  const valid = (Array.isArray(orders) ? orders : []).filter((order) => order?.name)
  if (!valid.length) {
    return null
  }
  const [first, ...rest] = valid
  let label = columnLabel(findColumn(columns, first), first.name)
  if (String(first.sort).toUpperCase() === 'ASC') {
    label += ', lowest first'
  }
  rest.forEach((order) => {
    label += `, then ${columnLabel(findColumn(columns, order), order.name)}`
  })
  return label
}

// "Advisor “Okafor”, AUM “>5000000”": a captured table's header filters, as typed. null when unfiltered.
export const getFilterLabel = (filters, columns) => {
  const valid = (Array.isArray(filters) ? filters : []).filter((filter) => filter?.name && filter.value !== '')
  if (!valid.length) {
    return null
  }
  return valid.map((filter) => `${columnLabel(findColumn(columns, filter), filter.name)} “${filter.value}”`).join(', ')
}

// Whether the rows shown are the whole result. count_rows is the server's count of the full result;
// without it, a page that came back short is known to be everything.
export const isResultComplete = ({ included, fetched, countRows, pageSize }) => {
  if (countRows != null) {
    return included >= countRows
  }
  return included >= fetched && (pageSize == null || fetched < pageSize)
}

// What a cut-off table says about its rows. It never says "Top" unless an ordering was applied —
// a slice of rows as returned is not a ranking.
export const getSliceCaption = ({ shown, total, complete, orders, columns }) => {
  if (complete) {
    return null
  }
  const by = getOrderLabel(orders, columns)
  if (by) {
    return total != null ? `Top ${count(shown)} of ${count(total)} by ${by}` : `Top ${count(shown)} by ${by}`
  }
  return total != null
    ? `First ${count(shown)} of ${count(total)} rows as returned`
    : `First ${count(shown)} rows as returned`
}

// 10 / 25 / 50 / 100, stopping at the first option that holds the whole result ("All N rows").
export const getRowOptions = (total) => {
  const options = []
  for (let i = 0; i < TABLE_ROW_OPTIONS.length; i++) {
    const n = TABLE_ROW_OPTIONS[i]
    if (total != null && n >= total) {
      options.push([n, `All ${count(total)} rows`])
      break
    }
    options.push([n, `${n} rows`])
  }
  return options
}

export { MAX_TABLE_ROWS }

// Visibility, order and frozen columns as the tile has them (QueryOutput reads visibility the same
// way: the tile's map wins, and a column with no entry is visible).
export const getPrintableColumns = (columns, tile) => {
  const visibility = tile?.columnVisibility || {}
  const visible = (Array.isArray(columns) ? columns : []).filter((col) => col && visibility[col.name] !== false)

  const order = Array.isArray(tile?.columnOrder) ? tile.columnOrder : []
  const position = (col) => {
    const i = order.indexOf(col.name)
    return i === -1 ? order.length + (col.index ?? 0) : i
  }
  const ordered = visible.slice().sort((a, b) => position(a) - position(b))

  const frozen = Array.isArray(tile?.frozenColumns) ? tile.frozenColumns : []
  return [...ordered.filter((col) => frozen.includes(col.name)), ...ordered.filter((col) => !frozen.includes(col.name))]
}

const NON_ADDITIVE = ['AVG', 'AVERAGE', 'MEAN', 'MIN', 'MAX', 'MEDIAN', 'STD_DEV', 'STDDEV', 'VARIANCE']

const isAdditive = (col, aggConfig) => {
  if (!isColumnSummable(col) || col?.custom || col?.mutator) {
    return false
  }
  const agg = String(aggConfig?.[col?.name] ?? col?.aggType ?? '').toUpperCase()
  if (NON_ADDITIVE.includes(agg)) {
    return false
  }
  return !/___(avg|min|max)$/i.test(col?.name || '')
}

// A total over every included row — only offered when those rows are the whole result, because a
// sum of a slice gets read as the total however it's labelled. Only amounts and quantities are
// summed; averages and custom columns never are.
export const computeTotalRow = ({ rows, columns, aggConfig, complete }) => {
  if (!complete || !Array.isArray(rows) || rows.length < 2) {
    return null
  }
  const additive = (columns || []).filter((col) => isAdditive(col, aggConfig))
  const labelColumn = (columns || []).find((col) => !additive.includes(col))
  if (!additive.length || !labelColumn) {
    return null
  }
  const sums = {}
  additive.forEach((col) => {
    sums[col.index] = rows.reduce((total, row) => total + (Number(row?.[col.index]) || 0), 0)
  })
  return { labelIndex: labelColumn.index, sums }
}

const stripBrackets = (text) => String(text ?? '').replace(/\[[^\]]*\]|\{[^}]*\}|\([^)]*\)/g, '')

// "Interpreted as" text, read the way ReverseTranslation reads it, falling back to plain text.
export const getInterpretationText = (response) => {
  const data = response?.data?.data
  let chunks
  try {
    chunks = constructRTArray(data?.parsed_interpretation)
  } catch (error) {
    chunks = undefined
  }
  if (Array.isArray(chunks) && chunks.length) {
    const text = chunks
      .map((chunk) => stripBrackets(chunk?.eng))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) {
      return text
    }
  }
  return typeof data?.interpretation === 'string' ? data.interpretation.trim() : ''
}

// How a result prints: its tile's display type when that's valid for the data, otherwise a table.
// A question has no tile, so it takes AutoQL's default, as QueryOutput would.
export const getEffectiveDisplay = (response, savedDisplayType) => {
  const data = response?.data?.data
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const columns = Array.isArray(data?.columns) ? data.columns : []
  const limited = isDataLimited(response)

  let displayType = savedDisplayType
  if (!displayType) {
    try {
      displayType = getDefaultDisplayType(response, true, columns, rows.length, undefined, undefined, limited, false)
    } catch (error) {
      displayType = 'table'
    }
  }

  if (displayType === 'single-value' && rows.length === 1) {
    return { kind: 'single-value', displayType }
  }
  if (isChartType(displayType)) {
    let valid = false
    try {
      valid = isDisplayTypeValid(response, displayType, rows.length, undefined, columns, limited)
    } catch (error) {
      valid = false
    }
    if (valid) {
      return { kind: 'chart', displayType }
    }
  }
  return { kind: 'table', displayType: 'table' }
}

// What a block can be shown as on paper, in the order the answer's chart toolbar lists them. Pivot tables,
// network graphs and Sankey charts can't be printed yet.
export const PRINTABLE_DISPLAY_TYPES = [
  'table',
  'column',
  'bar',
  'line',
  'pie',
  'heatmap',
  'bubble',
  'stacked_bar',
  'stacked_column',
  'stacked_line',
  'column_line',
  'histogram',
  'scatterplot',
]

// The display types this data supports (as QueryOutput works them out) that a report can print and that
// getEffectiveDisplay would honour. Charts are redrawn from the rows the block has, so a chart of a cut-off
// table draws those rows only — and its caption says so.
export const getDisplayOptions = (response) => {
  const data = response?.data?.data
  const rows = Array.isArray(data?.rows) ? data.rows : []
  let supported
  try {
    supported = getSupportedDisplayTypes({
      response,
      columns: data?.columns,
      dataLength: rows.length,
      isDataLimited: isDataLimited(response),
    })
  } catch (error) {
    supported = []
  }
  return PRINTABLE_DISPLAY_TYPES.filter(
    (type) => supported.includes(type) && getEffectiveDisplay(response, type).displayType === type,
  )
}
