import { DEFAULT_DATA_PAGE_SIZE } from 'autoql-fe-utils'
import { CHART_HEIGHT_PX } from '../constants'
import { getTileInitialTableConfigs, getTileLabel } from '../../Dashboard/tileQueryConfig'
import { getTileSupport, resolveTile } from './tiles'
import {
  computeTotalRow,
  getDisplayOptions,
  getEffectiveDisplay,
  getFilterLabel,
  getInterpretationText,
  getOrderLabel,
  getPrintableColumns,
  getSliceCaption,
  isResultComplete,
} from './dataBlock'

// What a data block shows right now: the latest run, or else what was captured when the block was added
// (block.capture — QueryOutput.captureForReport). The editor, the measurer and the printed pages all render
// from this, so they can't disagree.
//
// state: empty | missing | unsupported | not-run | loading | stale | error | ready

// The tile's saved date precision and type overrides, applied the way QueryOutput applies them.
const withOverrides = (columns, overrides) =>
  columns.map((col) => {
    const override = overrides?.[col.index]
    if (!override) return col
    return {
      ...col,
      ...(override.type ? { type: override.type } : {}),
      ...(override.precision ? { precision: override.precision } : {}),
    }
  })

const describeSource = (block, found) => {
  const { source } = block
  if (!source) {
    const text = block.capture?.data?.text
    return { title: text || 'Untitled', dashboardName: null, tileTitle: null, query: text }
  }
  if (source.type === 'query') {
    return { title: source.query, dashboardName: null, tileTitle: null, query: source.query }
  }
  const tile = found?.tile
  return {
    title: tile ? getTileLabel(tile) : source.snapshot?.tileTitle || source.snapshot?.query || 'Untitled',
    dashboardName: found?.dashboard?.name ?? source.snapshot?.dashboardName ?? null,
    tileTitle: tile ? getTileLabel(tile) : source.snapshot?.tileTitle ?? null,
    query: tile ? tile.query : source.snapshot?.query,
  }
}

const readyView = ({ block, tile, result, base }) => {
  const { response } = result
  const data = response?.data?.data || {}
  const fetchedRows = Array.isArray(data.rows) ? data.rows : []
  const fetched = fetchedRows.length
  const { countRows } = result
  const pageSize = result.pageSize ?? DEFAULT_DATA_PAGE_SIZE
  const overrides = tile ? getTileInitialTableConfigs(tile, response).columnOverrides : undefined
  const allColumns = withOverrides(Array.isArray(data.columns) ? data.columns : [], overrides)
  // A question has no tile, so nothing orders it: its rows read as "First N".
  const orders = tile?.orders
  const interpretation = getInterpretationText(response)
  // Shown as the block says when its data allows it, else as the tile (or capture) has it.
  const chosen = block.displayType ? getEffectiveDisplay(response, block.displayType) : null
  const display =
    chosen && chosen.displayType === block.displayType ? chosen : getEffectiveDisplay(response, tile?.displayType)
  const displayOptions = display.kind === 'single-value' ? [] : getDisplayOptions(response)

  if (display.kind === 'table') {
    const columns = getPrintableColumns(allColumns, tile)
    const included = Math.min(block.rows, fetched)
    const rows = fetchedRows.slice(0, included)
    const complete = isResultComplete({ included, fetched, countRows, pageSize })
    return {
      ...base,
      state: 'ready',
      kind: 'table',
      displayType: 'table',
      displayOptions,
      interpretation,
      columns,
      rows,
      countRows,
      complete,
      // "AUM, lowest first": named from the response's display names, so only known after a run.
      orderLabel: getOrderLabel(orders, allColumns),
      caption: getSliceCaption({ shown: included, total: countRows, complete, orders, columns: allColumns }),
      total: computeTotalRow({ rows, columns, aggConfig: tile?.aggConfig, complete }),
      // Only a full-width table may flow across pages; anything beside it has to stay whole.
      split: block.width === 'full',
    }
  }

  if (display.kind === 'single-value') {
    const [column = allColumns[0]] = getPrintableColumns(allColumns, tile)
    return {
      ...base,
      state: 'ready',
      kind: 'single-value',
      interpretation,
      column,
      value: fetchedRows[0]?.[column?.index ?? 0],
    }
  }

  const complete = isResultComplete({ included: fetched, fetched, countRows, pageSize })
  return {
    ...base,
    // Drawn with the settings it came with: the live tile's, or those captured with the answer.
    tile,
    state: 'ready',
    kind: 'chart',
    displayType: display.displayType,
    displayOptions,
    interpretation,
    response,
    height: block.width === 'half' ? CHART_HEIGHT_PX.half : CHART_HEIGHT_PX.full,
    rowCount: fetched,
    countRows,
    complete,
    caption: getSliceCaption({ shown: fetched, total: countRows, complete, orders, columns: allColumns }),
  }
}

export const isCapture = (capture) =>
  !!capture && typeof capture === 'object' && Array.isArray(capture.data?.rows) && Array.isArray(capture.data?.columns)

// A capture's settings as a tile: the view config QueryOutput had, plus the table's captured column order,
// visibility and sort, which already put frozen columns first.
const captureTile = (capture) => {
  const config = capture.config || {}
  const columns = capture.data.columns
  const indices = capture.table?.columnIndices
  let { columnVisibility } = config
  let columnOrder
  if (Array.isArray(indices) && indices.length) {
    const shown = new Set(indices)
    columnVisibility = {}
    columns.forEach((col, i) => {
      if (col?.name) columnVisibility[col.name] = shown.has(i)
    })
    columnOrder = indices.map((i) => columns[i]?.name).filter(Boolean)
  }
  return {
    ...config,
    displayType: capture.displayType,
    columnVisibility,
    columnOrder,
    frozenColumns: undefined,
    orders: capture.table ? capture.table.sort : config.orders,
  }
}

// One result object per capture, so what a chart is drawn from keeps its identity across edits elsewhere.
const captureResults = new WeakMap()
const captureResult = (capture) => {
  if (!captureResults.has(capture)) {
    captureResults.set(capture, {
      status: 'success',
      response: { data: { reference_id: '1.1.200', data: { display_type: 'data', ...capture.data } } },
      countRows: typeof capture.data.count_rows === 'number' ? capture.data.count_rows : null,
      tile: captureTile(capture),
    })
  }
  return captureResults.get(capture)
}

// `requestKey` is what the block would fetch now; `running` says a run in flight is fetching exactly that.
export const getDataBlockView = ({ block, tileIndex, result, requestKey, running = false }) => {
  const { source } = block || {}
  const capture = isCapture(block?.capture) ? block.capture : null
  if (!source && !capture) {
    return { state: 'empty' }
  }

  const found = source?.type === 'tile' ? resolveTile(tileIndex || {}, source) : null
  const tile = found?.tile
  const base = { ...describeSource(block, found), sourceType: source?.type, tile, dashboard: found?.dashboard }

  // What was captured stands on its own — even if its tile has since been removed — until a run replaces it.
  const ran = !!result && result.requestKey === requestKey && result.status === 'success'
  if (capture && !ran && !running) {
    const captured = captureResult(capture)
    // Its settings are the captured ones, not the live tile's, for everything that reads the view.
    return readyView({
      block,
      tile: captured.tile,
      result: captured,
      base: {
        ...base,
        tile: captured.tile,
        capturedAt: capture.capturedAt,
        filterLabel: getFilterLabel(capture.table?.filters, capture.data.columns),
      },
    })
  }

  if (source?.type === 'tile') {
    if (!found) {
      return { ...base, state: 'missing' }
    }
    const support = getTileSupport(tile)
    if (!support.supported) {
      return { ...base, state: 'unsupported', reason: support.reason, displayType: tile.displayType }
    }
  }

  if (!result) {
    return { ...base, state: running ? 'loading' : 'not-run' }
  }
  if (result.requestKey !== requestKey) {
    // Changed since it ran: the old data isn't what the block now asks for.
    return { ...base, state: running ? 'loading' : 'stale' }
  }
  if (result.status === 'cancelled') {
    return { ...base, state: 'not-run' }
  }
  if (result.status === 'error') {
    return { ...base, state: 'error', error: result.error }
  }
  return readyView({ block, tile, result, base })
}
