import { MAX_TABLE_ROWS } from '../constants'
import { MAX_CHART_ROWS, rowsForCapture } from '../model/capture'
import { newReportId } from './documents'
import { REPORTS_STRINGS } from './reportsStrings'

// Report blocks made by "Add to Report…", and by the tiles ticked in DashboardTilesDialog.
//
// OptionsToolbar hands a custom option's callback the answer's payload (query text, response, orders…) and, as a
// second argument, a `captureForReport()` that captures the answer as it's shown right now: its data (a table's rows
// in their current sort and filter order, up to 100; a chart's rows) and the settings that shape it. A dashboard
// tile's toolbar also says which tile it is (`dashboardId`, `tileKey`).
//
// The block keeps that capture, and shows exactly what the user saw until the report reruns it. It also keeps where
// it came from — the tile, or the question — which is what a rerun uses. Its JSON is the builder's Data block, which
// normalizes it on load: { id, type: 'data', width, rows, source, capture }.

const C = REPORTS_STRINGS.capture

// What a report keeps of an answer: a printed page can't scroll, and a chart draws from every row it has.
const LIMITS = { maxTableRows: MAX_TABLE_ROWS, maxChartRows: MAX_CHART_ROWS }

// Why an answer can't be kept, by the capture's reason. 'loading' and 'not-found' only come from a dashboard's
// captureTilesForReport.
const CAPTURE_ERRORS = {
  'too-large': (rowCount) =>
    C.tooLarge(rowCount != null ? rowCount.toLocaleString() : C.tooManyRows, MAX_CHART_ROWS.toLocaleString()),
  unsupported: () => C.unsupported,
  'no-data': () => C.noData,
  loading: () => C.loading,
  'not-found': () => C.notFound,
}

// The block for what was chosen: the answer as it's shown now, and where it came from — the dashboard tile when there
// is one, else the question. `data` is the toolbar's payload, `extra` its second argument (older versions of
// react-autoql pass none), and `dashboard` ({ id, name, tiles }) the one the tile is on, for the labels the block
// keeps. { ok: true, block }, or { ok: false, message } saying why it can't be added.
export const captureReportBlock = ({ data, extra, dashboard } = {}) => {
  const result = extra?.captureForReport?.(LIMITS)
  if (!result) {
    return { ok: false, message: CAPTURE_ERRORS.unsupported() }
  }
  if (!result.ok) {
    const why = CAPTURE_ERRORS[result.reason] || CAPTURE_ERRORS.unsupported
    return { ok: false, message: why(result.rowCount) }
  }
  const { capture } = result

  const query = (typeof data?.query === 'string' && data.query.trim()) || capture?.data?.text || ''
  const tileKey = data?.tileKey != null ? String(data.tileKey) : null
  const dashboardId =
    data?.dashboardId != null ? String(data.dashboardId) : dashboard?.id != null ? String(dashboard.id) : null

  let source = query ? { type: 'query', query } : null
  if (tileKey && dashboardId) {
    const tiles = Array.isArray(dashboard?.tiles) ? dashboard.tiles : []
    const tile = tiles.find((t) => String(t?.key ?? t?.i) === tileKey || String(t?.i) === tileKey)
    source = {
      type: 'tile',
      dashboardId,
      tileKey,
      // Labels for the block's title and source card; never executed.
      snapshot: {
        dashboardName: dashboard?.name,
        tileTitle: tile?.title || tile?.query || query,
        query: tile?.query ?? query,
        displayType: tile?.displayType,
      },
    }
  }

  return {
    ok: true,
    block: { id: newReportId(), type: 'data', width: 'full', rows: rowsForCapture(capture), source, capture },
  }
}

// Blocks for the tiles ticked in the dashboard-tiles dialog, one per key, in that order: each tile as it's shown
// there (the mounted Dashboard's captureTilesForReport — the capture the tile's own "Add to Report…" makes), with the
// tile as its source, exactly as captureReportBlock builds it. Each is { tileKey, title, result }, `result` being
// captureReportBlock's.
export const tileBlocks = (dashboardRef, tileKeys, dashboard) => {
  const entries = dashboardRef.captureTilesForReport({ tileKeys, ...LIMITS })
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    tileKey: String(entry.tileKey),
    title: entry.title,
    result: captureReportBlock({
      data: { query: entry.query, tileKey: entry.tileKey, dashboardId: entry.dashboardId ?? dashboard?.id },
      extra: { captureForReport: () => entry.result },
      dashboard,
    }),
  }))
}
