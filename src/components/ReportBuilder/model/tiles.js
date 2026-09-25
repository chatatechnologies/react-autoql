import { UNSUPPORTED_DISPLAY_TYPES } from '../constants'
import { getTileLabel, getTileQueryText } from '../../Dashboard/tileQueryConfig'

// Looks up the dashboard tiles a report's data blocks point at. Dashboards come from the host;
// a block stores only the dashboard id and tile key, so a tile edited on its dashboard shows up here.

export const getTileKey = (tile) => {
  if (tile?.key != null) return String(tile.key)
  if (tile?.i != null) return String(tile.i)
  return null
}

const indexKey = (dashboardId, tileKey) => `${dashboardId}\u0000${tileKey}`

export const buildTileIndex = (dashboards) => {
  const index = {}
  ;(Array.isArray(dashboards) ? dashboards : []).forEach((dashboard) => {
    if (dashboard?.id == null) return
    ;(Array.isArray(dashboard.tiles) ? dashboard.tiles : []).forEach((tile) => {
      const key = getTileKey(tile)
      if (key != null) {
        index[indexKey(String(dashboard.id), key)] = { dashboard, tile }
      }
    })
  })
  return index
}

export const resolveTile = (index, source) =>
  source?.type === 'tile' ? index[indexKey(source.dashboardId, source.tileKey)] || null : null

export const getTileSupport = (tile) => {
  if (!getTileQueryText(tile)) return { supported: false, reason: 'no-query' }
  if (UNSUPPORTED_DISPLAY_TYPES.includes(tile?.displayType)) return { supported: false, reason: 'unsupported' }
  return { supported: true }
}

const DISPLAY_TYPE_LABELS = {
  table: 'Table',
  pivot_table: 'Pivot table',
  column: 'Column chart',
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  stacked_column: 'Stacked column chart',
  stacked_bar: 'Stacked bar chart',
  stacked_line: 'Area chart',
  column_line: 'Column & line chart',
  scatterplot: 'Scatterplot',
  bubble: 'Bubble chart',
  heatmap: 'Heatmap',
  histogram: 'Histogram',
  'single-value': 'Single value',
  network_graph: 'Network graph',
  sankey: 'Sankey chart',
}

export const getDisplayTypeLabel = (displayType) => DISPLAY_TYPE_LABELS[displayType] || 'Chart'

// Labels kept on the block so it can still say what it was if the tile disappears.
export const tileSnapshot = ({ dashboard, tile }) => ({
  dashboardName: dashboard?.name,
  tileTitle: getTileLabel(tile),
  query: getTileQueryText(tile),
  displayType: tile?.displayType,
})

export const tileSource = ({ dashboard, tile }) => ({
  type: 'tile',
  dashboardId: String(dashboard.id),
  tileKey: getTileKey(tile),
  snapshot: tileSnapshot({ dashboard, tile }),
})
