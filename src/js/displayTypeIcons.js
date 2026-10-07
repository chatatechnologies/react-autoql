import { DisplayTypes } from 'autoql-fe-utils'

/**
 * Display type names are not icon names.
 *
 * The display type is `column`, `stacked_bar`, `pivot_table`; Icon's vocabulary is
 * `column-chart`, `stacked-bar-chart`, `pivot-table`. They look close enough that
 * passing one where the other belongs renders nothing at all, silently - which is
 * exactly what happened before this map was shared rather than kept private to
 * VizToolbar.
 */
const DISPLAY_TYPE_ICONS = {
  [DisplayTypes.TABLE]: 'table',
  [DisplayTypes.PIVOT_TABLE]: 'pivot-table',
  [DisplayTypes.COLUMN]: 'column-chart',
  [DisplayTypes.BAR]: 'bar-chart',
  [DisplayTypes.LINE]: 'line-chart',
  [DisplayTypes.PIE]: 'pie-chart',
  [DisplayTypes.HEATMAP]: 'heatmap',
  [DisplayTypes.BUBBLE]: 'bubble-chart',
  [DisplayTypes.STACKED_BAR]: 'stacked-bar-chart',
  [DisplayTypes.STACKED_COLUMN]: 'stacked-column-chart',
  [DisplayTypes.STACKED_LINE]: 'stacked-line-chart',
  [DisplayTypes.COLUMN_LINE]: 'column-line-chart',
  [DisplayTypes.HISTOGRAM]: 'histogram-chart',
  [DisplayTypes.SCATTERPLOT]: 'scatterplot',
  [DisplayTypes.NETWORK_GRAPH]: 'network',
  [DisplayTypes.SANKEY]: 'sankey',
}

export const getIconForDisplayType = (displayType) => DISPLAY_TYPE_ICONS[displayType] ?? 'column-chart'
