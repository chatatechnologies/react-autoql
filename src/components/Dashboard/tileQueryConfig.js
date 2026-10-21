import { getAutoQLConfig, isChartType } from 'autoql-fe-utils'

// How a dashboard tile's saved config becomes a query request and QueryOutput props. Shared by
// DashboardTile and ReportBuilder so a report renders a tile exactly as its dashboard does.

// autoQLConfig scoped to the tile's own project, if it has one (multi-project dashboards)
export const getTileScopedAutoQLConfig = (autoQLConfig, tile) => {
  const config = getAutoQLConfig(autoQLConfig)
  if (tile?.projectId == null) {
    return config
  }
  return { ...config, projectId: tile.projectId }
}

// authentication scoped to the tile's own project, if it has one and a token is cached for it (multi-project dashboards)
export const getTileScopedAuthentication = ({ authentication, tile, getAuthenticationForProject } = {}) => {
  const projectId = tile?.projectId
  if (projectId != null && getAuthenticationForProject) {
    const tileAuthentication = getAuthenticationForProject(projectId)
    if (tileAuthentication) {
      return tileAuthentication
    }
  }
  return authentication
}

export const normalizeTileAxisSorts = (v) => {
  if (!v) return {}
  if (!Array.isArray(v)) return v
  const obj = {}
  v.forEach((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.assign(obj, item)
    }
  })
  return obj
}

// The part of a tile's query request that comes from the tile itself. A reset drops the tile's own
// tweaks; dashboard slicers still apply.
export const getTileRequestParams = ({ tile, isReset = false, dashboardSlicers, dataPageSize } = {}) => {
  const pageSize = isChartType(tile.displayType) ? tile.pageSize ?? dataPageSize : undefined

  let filters = isReset ? [] : tile.filters || []
  if (dashboardSlicers && dashboardSlicers.length > 0) {
    filters = [...filters, ...dashboardSlicers]
  }

  return {
    newColumns: isReset ? [] : tile.columnSelects,
    displayOverrides: isReset ? [] : tile?.displayOverrides,
    filters,
    orders: isReset ? [] : tile.orders,
    tableFilters: isReset ? [] : tile.tableFilters,
    pageSize,
    sourceQuery: tile.queryId,
  }
}

export const getTileInitialTableConfigs = (tile, queryResponse = tile?.queryResponse) => {
  const dataConfig = tile?.dataConfig || {}
  // Extract columnOverrides from tile.columns if it exists (for date precision persistence)
  // Compare tile.columns with queryResponse columns to find overrides
  // Use columnOverrides from dataConfig if it exists (preferred method)
  let columnOverrides = dataConfig?.columnOverrides || {}

  // Fallback: Extract columnOverrides from tile.columns if dataConfig doesn't have it
  // This handles backwards compatibility with dashboards saved before columnOverrides was added
  if (!dataConfig?.columnOverrides && tile?.columns && queryResponse?.data?.data?.columns) {
    const savedColumns = tile.columns
    const originalColumns = queryResponse.data.data.columns
    savedColumns.forEach((savedCol) => {
      if (savedCol?.index !== undefined) {
        const originalCol = originalColumns.find(
          (oc) =>
            oc.index === savedCol.index ||
            oc.name === savedCol.name ||
            oc.id === savedCol.id ||
            oc.display_name === savedCol.display_name,
        )
        if (
          originalCol &&
          originalCol.index !== undefined &&
          (savedCol.type !== originalCol.type || savedCol.precision !== originalCol.precision)
        ) {
          columnOverrides[originalCol.index] = {
            type: savedCol.type,
            precision: savedCol.precision,
          }
        }
      }
    })
  }
  // If pivotTableConfig has all empty index arrays it was saved before the data was
  // properly initialized (e.g. readonly tile whose config was never generated).
  // Strip both pivotTableConfig and tableConfig so QueryOutput regenerates them fresh
  // from the actual response columns — an empty config causes pivotTableData = [] and
  // a completely blank tile.
  const ptc = dataConfig?.pivotTableConfig
  const pivotConfigIsEmpty = ptc && !ptc.numberColumnIndices?.length && !ptc.stringColumnIndices?.length

  const { pivotTableConfig, tableConfig, ...restDataConfig } = dataConfig

  return {
    ...restDataConfig,
    columnOverrides,
    columnVisibility: tile?.columnVisibility,
    ...(!pivotConfigIsEmpty && pivotTableConfig !== undefined ? { pivotTableConfig } : {}),
    ...(!pivotConfigIsEmpty && tableConfig !== undefined ? { tableConfig } : {}),
  }
}

// The QueryOutput props that come from the tile's saved config (not from the tile component's own
// callbacks or state). Pass the response when it isn't stored on the tile.
export const getTileQueryOutputProps = (tile, { queryResponse = tile?.queryResponse } = {}) => ({
  initialDisplayType: tile?.displayType,
  queryResponse,
  // Pin drilldowns to the tile's already-cached query id — a cached-refresh response can carry
  // a different (fresh) query_id for what is logically the same cached query, and the backend
  // 500s if that fresh id is used for drilldown.
  queryId: tile?.queryId,
  initialTableConfigs: getTileInitialTableConfigs(tile, queryResponse),
  initialAggConfig: tile.aggConfig,
  queryValidationSelections: tile.queryValidationSelections,
  defaultSelectedSuggestion: tile?.defaultSelectedSuggestion,
  dataPageSize: tile.pageSize,
  bucketSize: tile.bucketSize,
  initialNetworkColumnConfig: tile.networkColumnConfig,
  legendFilterConfig: tile.legendFilterConfig,
  initialAxisSorts: normalizeTileAxisSorts(tile?.axisSorts),
  initialColumnOrder: tile?.columnOrder,
  initialFrozenColumns: tile?.frozenColumns,
  initialFormattedTableParams: {
    filters: tile?.tableFilters,
    sorters: tile?.orders,
    sessionFilters: tile?.filters || [],
  },
  lockedFilters: tile?.tableFilters ?? [],
  initialChartControls: tile?.chartControls || {
    showAverageLine: false,
    showRegressionLine: false,
  },
})

// The query text a tile runs: a chosen suggestion wins over the saved query.
export const getTileQueryText = (tile) => tile?.defaultSelectedSuggestion || tile?.query

export const getTileLabel = (tile) => tile?.title || tile?.query || 'Untitled'
