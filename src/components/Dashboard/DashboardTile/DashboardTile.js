import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import Autosuggest from 'react-autosuggest'
import {
  runQuery,
  fetchAutocomplete,
  deepEqual,
  isChartType,
  findNetworkColumns,
  REQUEST_CANCELLED_ERROR,
  UNAUTHENTICATED_ERROR,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getAutoQLConfig,
  CustomColumnTypes,
  runCachedDashboardQueryPost,
  constructRTArray,
  titlelizeString,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Modal } from '../../Modal'
import { Select } from '../../Select'
import { VizToolbar } from '../../VizToolbar'
import { QueryOutput } from '../../QueryOutput'
import { OptionsToolbar } from '../../OptionsToolbar'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { ReverseTranslation } from '../../ReverseTranslation'
import { Popover } from '../../Popover'
import FollowOnModal from '../../FollowOnModal/FollowOnModal'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './DashboardTile.scss'

let autoCompleteArray = []

export class DashboardTile extends React.Component {
  constructor(props) {
    super(props)
    this._isMounted = false
    this.dashboardTileTitleRef = undefined
    this.optionsToolbarRef = undefined
    this.COMPONENT_KEY = uuid()
    this.FIRST_QUERY_RESPONSE_KEY = uuid()
    this.DEFAULT_AJAX_PAGE_SIZE = 50
    this.autoCompleteTimer = undefined
    this.debounceTime = 50
    this.paramsToSet = {}
    this.callbackArray = []
    this.wasFilteringBeforeRemount = false
    this.wasBottomFilteringBeforeRemount = false

    // Store original saved tile config from DB to restore after errors
    this.savedTileConfig = {}
    this.configKeys = [
      'displayType',
      'dataConfig',
      'aggConfig',
      'columns',
      'tableFilters',
      'axisSorts',
      'networkColumnConfig',
      'columnOrder',
      'frozenColumns',
    ]

    const tile = props.tile

    // ----- Required for backwards compatibility after changing the agg types to enums ----
    const newAggConfig = {}
    tile?.aggConfig &&
      Object.keys(tile.aggConfig)?.forEach((column) => {
        if (tile.aggConfig?.[column]) {
          newAggConfig[column] = tile.aggConfig[column].toUpperCase()
        }
      })

    props.setParamsForTile(
      {
        aggConfig: newAggConfig,
      },
      tile.i,
    )
    // -------------------------------------------------------------------------------------

    this.state = {
      tileIdx: tile.i,
      query: tile.query,
      title: tile.title,
      isTopExecuting: false,
      suggestions: [],
      isTopExecuted: !!tile.queryResponse,
      localRTFilterResponse: null,
      isRTHovered: false,
      isFollowOnModalOpen: false,
      followOnResults: [],
      queryResponseVersion: 0,
      isProjectModalOpen: false,
      pendingProjectId: undefined,
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    tile: PropTypes.shape({
      // common tile fields used throughout the component
      i: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      h: PropTypes.number,
      query: PropTypes.string,
      title: PropTypes.string,
      displayType: PropTypes.string,
      pageSize: PropTypes.number,
      bucketSize: PropTypes.number,
      columns: PropTypes.array,
      columnSelects: PropTypes.array,
      dataConfig: PropTypes.object,
      aggConfig: PropTypes.object,
      tableFilters: PropTypes.array,
      filters: PropTypes.array,
      orders: PropTypes.array,
      axisSorts: PropTypes.array,
      networkColumnConfig: PropTypes.any,
      columnOrder: PropTypes.arrayOf(PropTypes.string),
      frozenColumns: PropTypes.arrayOf(PropTypes.string),
      chartControls: PropTypes.object,
      legendFilterConfig: PropTypes.any,
      queryResponse: PropTypes.shape({}),
      defaultSelectedSuggestion: PropTypes.string,
      queryValidationSelections: PropTypes.any,
      // Project this tile's query should run against (multi-project dashboards)
      projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    isEditing: PropTypes.bool,
    isDirty: PropTypes.bool,
    isFailed: PropTypes.bool,
    deleteTile: PropTypes.func,
    resetTile: PropTypes.func,
    executeSingleTile: PropTypes.func,
    onSaveCallback: PropTypes.func,
    dataPageSize: PropTypes.number,
    queryResponse: PropTypes.shape({}),
    disableAggregationMenu: PropTypes.bool,
    allowCustomColumnsOnDrilldown: PropTypes.bool,
    notExecutedText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    onErrorCallback: PropTypes.func,
    onRetry: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onCSVDownloadStart: PropTypes.func,
    onCSVDownloadProgress: PropTypes.func,
    onCSVDownloadFinish: PropTypes.func,
    onPNGDownloadFinish: PropTypes.func,
    cancelQueriesOnUnmount: PropTypes.bool,
    setParamsForTile: PropTypes.func,
    dashboardId: PropTypes.string,
    tileKey: PropTypes.string,
    isCachedRefresh: PropTypes.bool,
    dashboardSlicers: PropTypes.arrayOf(PropTypes.shape({})),
    enableCyclicalDates: PropTypes.bool,
    enableMagicWand: PropTypes.bool,
    showMagicWandQuoteButton: PropTypes.bool,
    enableFollowOnQuery: PropTypes.bool,
    showResetQueryOption: PropTypes.bool,
    // List of projects the tile can be assigned to (multi-project dashboards). When omitted or empty, no picker is shown.
    projectSelectList: PropTypes.arrayOf(
      PropTypes.shape({
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        displayName: PropTypes.string.isRequired,
      }),
    ),
    // Resolves an authentication object scoped to a given projectId (multi-project dashboards)
    getAuthenticationForProject: PropTypes.func,
    // Whether to surface the project picker (edit-mode button + modal) for multi-project dashboards
    showProjectIndicator: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    query: '',
    title: '',
    isEditing: false,
    isDirty: false,
    isFailed: false,
    dataPageSize: undefined,
    queryValidationSelections: undefined,
    defaultSelectedSuggestion: undefined,
    notExecutedText: 'Hit "Execute" to run this dashboard',
    autoChartAggregations: true,
    cancelQueriesOnUnmount: true,
    deleteTile: () => {},
    resetTile: () => {},
    executeSingleTile: () => {},
    onSaveCallback: () => {},
    onErrorCallback: () => {},
    onRetry: () => {},
    onSuccessCallback: () => {},
    onCSVDownloadStart: () => {},
    onCSVDownloadProgress: () => {},
    onCSVDownloadFinish: () => {},
    onPNGDownloadFinish: () => {},
    onTouchStart: () => {},
    onTouchEnd: () => {},
    setParamsForTile: () => {},
    dashboardId: undefined,
    tileKey: undefined,
    isCachedRefresh: false,
    dashboardSlicers: [],
    enableMagicWand: false,
    showMagicWandQuoteButton: false,
    enableFollowOnQuery: false,
    projectSelectList: undefined,
    getAuthenticationForProject: undefined,
    showProjectIndicator: true,
  }

  componentDidMount = () => {
    this._isMounted = true
    // Save original tile config from DB when component mounts
    this.saveOriginalTileConfig(this.props.tile)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const thisPropsFiltered = this.getFilteredProps(this.props)
    const nextPropsFiltered = this.getFilteredProps(nextProps)

    return !deepEqual(thisPropsFiltered, nextPropsFiltered) || !deepEqual(this.state, nextState)
  }

  onUpdateFilterResponse = (localRTFilterResponse) => {
    if (this._isMounted) {
      const filters = localRTFilterResponse?.data?.data?.fe_req?.filters

      // Update both state and formatted params
      this.setState({
        localRTFilterResponse,
        tableFilters: filters,
        initialFormattedTableParams: {
          ...this.state.initialFormattedTableParams,
          filters,
        },
      })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    // OptionsToolbar remounts on every view<->edit toggle and reads this at construction time, so keep it live.
    if (this.state.responseRef?._isMounted) {
      this.wasFilteringBeforeRemount = !!this.state.responseRef.isFilteringTable()
    }
    if (this.state.secondResponseRef?._isMounted) {
      this.wasBottomFilteringBeforeRemount = !!this.state.secondResponseRef.isFilteringTable()
    }

    // If query or title change from props (due to undo for example), update state
    if (this.props.tile?.title !== prevProps.tile?.title) {
      this.setState({ title: this.props.tile?.title })
    }
    if (this.props.tile?.query !== prevProps.tile?.query) {
      this.setState({ query: this.props.tile?.query })
    }
    if (
      this.responseRef?._isMounted &&
      this.props.tile?.displayType &&
      this.props.tile.displayType !== prevProps.tile?.displayType &&
      this.props.tile.displayType !== this.responseRef.state.displayType
    ) {
      this.responseRef.changeDisplayType(this.props.tile.displayType)
    }
    // Re-run the query if the tile's project changed (e.g. reassigned to a different project)
    if (this.props.tile?.projectId !== prevProps.tile?.projectId && this.isQueryValid(this.props.tile?.query)) {
      this.processTile({ query: this.props.tile.query })
    }
    if (prevProps.isEditing && !this.props.isEditing && this.state.localRTFilterResponse) {
      this.setState({ localRTFilterResponse: null })
    }
    if (
      !prevProps.isEditing &&
      this.props.isEditing &&
      (this.state.localRTFilterResponse || this.state.viewModeFiltersDiffer)
    ) {
      // View-mode RT edits or header filters changed the displayed data — refetch base data for edit mode
      if (this.state.viewModeFiltersDiffer) this._forceRemountOnNextResponse = true
      this.setState({ localRTFilterResponse: null, viewModeFiltersDiffer: false })
      this.processTile()?.catch?.(() => {}) // errors already surface via tile state; just avoid an unhandled rejection
    }

    const prevQR = prevProps.tile?.queryResponse
    const nextQR = this.props.tile?.queryResponse
    const prevQRId = prevQR?.data?.data?.query_id
    const nextQRId = nextQR?.data?.data?.query_id
    // Self-reported query_id changes (onColumnChange) must not remount, or in-memory column state (frozen/drag-order) is lost
    const isSelfColumnChange = !!nextQRId && nextQRId === this._columnChangeQueryId
    if (
      nextQR &&
      nextQR !== prevQR &&
      !this.state.isTopExecuting &&
      (prevQR === null || (prevQR && prevQRId !== nextQRId && !isSelfColumnChange))
    ) {
      this.setState({ queryResponseVersion: this.state.queryResponseVersion + 1 })
    }

    // If structural request params changed (filters/orders/pageSize) update saved requestData
    try {
      const prevTile = prevProps.tile || {}
      const nextTile = this.props.tile || {}

      const topChanged =
        !_isEqual(prevTile.tableFilters, nextTile.tableFilters) ||
        !_isEqual(prevTile.filters, nextTile.filters) ||
        !_isEqual(prevTile.orders, nextTile.orders) ||
        prevTile.pageSize !== nextTile.pageSize ||
        prevTile.query !== nextTile.query ||
        prevTile.projectId !== nextTile.projectId

      if (topChanged && this.topRequestData) {
        this.topRequestData = {
          ...this.topRequestData,
          tableFilters: nextTile.tableFilters || [],
          filters: nextTile.filters || [],
          orders: nextTile.orders || [],
          pageSize: nextTile.pageSize,
          query: nextTile.query || this.topRequestData.query,
          projectId: nextTile.projectId,
        }
      }
    } catch (e) {
      // non-fatal
    }
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false

      clearTimeout(this.autoCompleteTimer)
      clearTimeout(this.dragEndTimeout)
      clearTimeout(this.setParamsForTileTimeout)
      clearTimeout(this.queryInputTimer)
      clearTimeout(this.titleInputTimer)

      if (this.props.cancelQueriesOnUnmount) {
        this.cancelAllQueries()
      }
    } catch (error) {
      console.error(error)
    }
  }

  refreshLayout = () => {
    this.state.responseRef?.refreshLayout()
  }

  cancelAllQueries = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  debouncedSetParamsForTile = (params, callback) => {
    if (!this._isMounted) {
      clearTimeout(this.setParamsForTileTimeout)
      return
    }

    this.paramsToSet = {
      ...this.paramsToSet,
      ...params,
    }

    if (typeof callback === CustomColumnTypes.FUNCTION) {
      this.callbackArray = [...this.callbackArray, callback]
    }

    clearTimeout(this.setParamsForTileTimeout)
    const flush = () => {
      if (!this._isMounted) return
      this.props.setParamsForTile(this.paramsToSet, this.props.tile.i, _cloneDeep(this.callbackArray))
      this.paramsToSet = {}
      this.callbackArray = []
    }

    // queryId must reach the parent immediately so an in-flight dashboard save doesn't ship a stale value.
    if ('queryId' in params) {
      flush()
    } else {
      this.setParamsForTileTimeout = setTimeout(flush, this.debounceTime)
    }
  }

  getFilteredProps = (props) => {
    return {
      ...props,
      children: undefined,
      tileRef: undefined,
    }
  }

  // autoQLConfig scoped to this tile's own project, if it has one (multi-project dashboards)
  getTileAutoQLConfig = () => {
    const autoQLConfig = getAutoQLConfig(this.props.autoQLConfig)
    if (this.props.tile?.projectId == null) {
      return autoQLConfig
    }
    return { ...autoQLConfig, projectId: this.props.tile.projectId }
  }

  // authentication scoped to this tile's own project, if it has one and a token is cached for it (multi-project dashboards)
  getTileAuthentication = () => {
    const projectId = this.props.tile?.projectId
    if (projectId != null && this.props.getAuthenticationForProject) {
      const tileAuthentication = this.props.getAuthenticationForProject(projectId)
      if (tileAuthentication) {
        return tileAuthentication
      }
    }
    return this.props.authentication
  }

  // Resolves true once this tile's per-project auth token is available (or not needed), false if it never arrives within the wait window
  waitForTileAuthentication = () => {
    const projectId = this.props.tile?.projectId
    if (projectId == null || !this.props.getAuthenticationForProject) {
      return Promise.resolve(true)
    }
    if (this.props.getAuthenticationForProject(projectId)) {
      return Promise.resolve(true)
    }

    const POLL_INTERVAL_MS = 100
    const MAX_WAIT_MS = 15000
    return new Promise((resolve) => {
      const start = Date.now()
      const check = () => {
        if (!this._isMounted) {
          // Unmounted mid-wait — resolve ready so the promise doesn't dangle
          resolve(true)
          return
        }
        if (this.props.getAuthenticationForProject?.(projectId)) {
          resolve(true)
          return
        }
        if (Date.now() - start >= MAX_WAIT_MS) {
          resolve(false)
          return
        }
        setTimeout(check, POLL_INTERVAL_MS)
      }
      check()
    })
  }

  // Surface a clear auth error instead of firing a query that's guaranteed to 403
  handleUnavailableTileAuth = () => {
    const response = {
      data: {
        message: UNAUTHENTICATED_ERROR,
        reference_id: '1.1.401',
      },
    }
    return this.endTopQuery({ response })
  }

  isQueryValid = (query) => {
    return !!query && !!query.trim()
  }

  setTopExecuted = () => {
    if (this._isMounted) {
      // Applied here (once the refetch settles) since componentDidUpdate's isTopExecuting-gated branch never fires for it.
      const shouldForceRemount = this._forceRemountOnNextResponse
      this._forceRemountOnNextResponse = false
      this.setState((prevState) => ({
        isTopExecuting: false,
        isTopExecuted: true,
        queryResponseVersion: shouldForceRemount ? prevState.queryResponseVersion + 1 : prevState.queryResponseVersion,
      }))
    }
  }

  // Helper function to detect error responses (matches QueryOutput.hasError logic)
  hasError = (response) => {
    try {
      const referenceId = String(response?.data?.reference_id || '')
      const referenceIdNumber = Number(referenceId.split('.')[2])
      if (referenceIdNumber >= 200 && referenceIdNumber < 300) {
        return false
      }
    } catch (error) {
      console.error(error)
    }
    return true
  }

  shouldHideOptions = (response) => {
    if (response?.data?.data?.replacements) return true
    if (response?.data?.data?.items) return true
    if (!response?.data?.reference_id) return false
    return this.hasError(response)
  }

  shouldShowDirtyBadge = () => {
    if (!this.props.isEditing || this.props.isFailed) return false
    if (!this.props.isDirty) return false
    if (this.props.tile?.splitView) return false // split view uses per-pane banners
    const { tile } = this.props
    if (tile?.queryId) return true
    if (tile?.queryResponse?.data?.data?.replacements) return true
    if (tile?.queryResponse?.data?.data?.items) return true
    return false
  }

  // Returns 'dirty', 'failed', or null for a split-view pane (isTopHalf=true → top query).
  getPaneBannerType = (isTopHalf) => {
    if (!this.props.isEditing) return null
    const { tile } = this.props
    if (!tile?.splitView) return null

    const response = isTopHalf ? tile?.queryResponse : tile?.secondQueryResponse

    if (this.props.isFailed && this.hasError(response)) return 'failed'

    if (!this.props.isDirty) return null

    if (response?.data?.data?.replacements) return 'dirty'
    if (response?.data?.data?.items) return 'dirty'

    if (!isTopHalf && !!tile.secondQuery && !tile.secondQueryId) return 'dirty'

    // Top fallback: if isDirty has no attributable bottom reason, show on top
    if (isTopHalf) {
      const bottomHasOwnReason =
        !!tile?.secondQueryResponse?.data?.data?.replacements ||
        !!tile?.secondQueryResponse?.data?.data?.items ||
        (!!tile.secondQuery && !tile.secondQueryId)
      if (!bottomHasOwnReason) return 'dirty'
    }

    return null
  }

  // Return true only for query translation errors (29.9.502) that warrant a force-retry
  isServerError = (resp) => {
    try {
      const ref = String(resp?.data?.reference_id || resp?.data?.referenceId || resp?.reference_id || '')
      if (ref.endsWith('.502')) return true
    } catch (e) {
      // treat unknown shapes as non-retryable
    }
    return false
  }

  normalizeAxisSorts = (v) => {
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

  // Helper to check if dataConfig has valid values
  hasValidDataConfig = (dataConfig) => {
    return dataConfig && (dataConfig.tableConfig != null || dataConfig.pivotTableConfig != null)
  }

  // Helper to filter out null/undefined values from config object
  filterValidConfig = (config) => {
    const filtered = {}

    this.configKeys.forEach((key) => {
      const value = config[key]
      // For dataConfig, check if it has valid values
      if (key === 'dataConfig') {
        if (this.hasValidDataConfig(value)) {
          filtered[key] = value
        }
      }
      // For tableFilters, allow empty arrays but not null/undefined
      else if (key === 'tableFilters') {
        if (value != null) {
          filtered[key] = value
        }
      }
      // For other fields, only include if truthy
      else if (value) {
        filtered[key] = value
      }
    })

    return filtered
  }

  // Save original tile config from DB for restoration after errors
  saveOriginalTileConfig = (tile) => {
    if (!tile) return

    // Only save if we have valid saved data (not just error responses)
    const hasValidResponse = tile.queryResponse && !this.hasError(tile.queryResponse)
    const hasSavedConfig = tile.displayType || tile.dataConfig || tile.aggConfig

    if (hasValidResponse || hasSavedConfig) {
      this.savedTileConfig = {
        displayType: tile.displayType,
        dataConfig: tile.dataConfig,
        aggConfig: tile.aggConfig,
        columns: tile.columns,
        tableFilters: tile.tableFilters,
        axisSorts: tile.axisSorts,
        networkColumnConfig: tile.networkColumnConfig,
        columnOrder: tile.columnOrder,
        frozenColumns: tile.frozenColumns,
      }
    }
  }

  // Restore saved tile config after error
  restoreSavedTileConfig = () => {
    const configToRestore = this.filterValidConfig(this.savedTileConfig)
    if (Object.keys(configToRestore).length > 0) {
      this.debouncedSetParamsForTile(configToRestore)
    }
  }

  getNetworkColumnConfig = (response) => {
    try {
      let cols = response?.data?.data?.columns || []
      if (!cols.length && Array.isArray(response?.data?.data?.rows) && response.data.data.rows.length > 0) {
        const firstRow = response.data.data.rows[0]
        cols = Array.isArray(firstRow)
          ? firstRow.map((_, i) => ({ name: `col${i}` }))
          : Object.keys(firstRow || {}).map((k) => ({ name: k }))
      }
      const detected = typeof findNetworkColumns === 'function' ? findNetworkColumns(cols) : null
      if (detected && detected.sourceColumnIndex !== -1 && detected.targetColumnIndex !== -1) {
        return {
          sourceColumnIndex: detected.sourceColumnIndex,
          targetColumnIndex: detected.targetColumnIndex,
          weightColumnIndex: detected.weightColumnIndex,
        }
      }
      return null
    } catch (e) {
      return null
    }
  }

  endTopQuery = ({ response, isReset = false, queryChanged = true, isCachedRefresh = false }) => {
    if (response?.data?.message !== REQUEST_CANCELLED_ERROR) {
      const isError = this.hasError(response)

      // Build params to set - always include queryResponse
      const paramsToSet = {
        queryResponse: response,
        defaultSelectedSuggestion: undefined,
      }

      if (isError) {
        // If there's an error, restore the saved tile config
        // Merge restoration directly into the same debounced call to avoid timing issues
        Object.assign(paramsToSet, this.filterValidConfig(this.savedTileConfig))
      } else {
        if (queryChanged || !this.props.tile?.queryId || !isCachedRefresh) {
          const queryId = response?.data?.data?.query_id
          if (queryId) {
            paramsToSet.queryId = queryId
          }
        }
        // If successful, update saved config with current tile config (preserve user's saved settings)
        const currentTile = this.props.tile
        if (currentTile) {
          // Only update dataConfig if it has valid values (not just an object with undefined properties)
          const hasValidCurrentDataConfig = this.hasValidDataConfig(currentTile.dataConfig)

          if (isReset) {
            // props.tile is stale during reset — only update display-type fields; clear the rest to match the zeroed tile.
            this.savedTileConfig = {
              ...this.savedTileConfig,
              displayType: currentTile.displayType || this.savedTileConfig.displayType,
              columns: [],
              tableFilters: [],
              aggConfig: undefined,
              dataConfig: undefined,
              axisSorts: undefined,
              networkColumnConfig: undefined,
              columnOrder: undefined,
              frozenColumns: undefined,
            }
          } else {
            this.savedTileConfig = {
              ...this.savedTileConfig,
              displayType: currentTile.displayType || this.savedTileConfig.displayType,
              dataConfig: hasValidCurrentDataConfig ? currentTile.dataConfig : this.savedTileConfig.dataConfig,
              aggConfig: currentTile.aggConfig || this.savedTileConfig.aggConfig,
              columns: currentTile.columns || this.savedTileConfig.columns,
              tableFilters:
                currentTile.tableFilters != null ? currentTile.tableFilters : this.savedTileConfig.tableFilters,
              axisSorts: currentTile.axisSorts || this.savedTileConfig.axisSorts,
              networkColumnConfig: currentTile.networkColumnConfig || this.savedTileConfig.networkColumnConfig,
              columnOrder: currentTile.columnOrder || this.savedTileConfig.columnOrder,
              frozenColumns: currentTile.frozenColumns || this.savedTileConfig.frozenColumns,
            }
          }
        }
        paramsToSet.networkColumnConfig = this.getNetworkColumnConfig(response)
      }

      // Update component key after getting new response
      // so QueryOutput completely resets
      this.debouncedSetParamsForTile(paramsToSet, this.setTopExecuted)
      return response
    } else {
      return Promise.reject(REQUEST_CANCELLED_ERROR)
    }
  }

  processQuery = ({ query, userSelection, skipQueryValidation, source, isCachedRefresh, isReset = false }) => {
    if (this.isQueryValid(query)) {
      const pageSize = isChartType(this.props.tile.displayType)
        ? this.props.tile.pageSize ?? this.props.dataPageSize
        : undefined

      const additionalColumnSelects = isReset ? [] : this.props.tile.columnSelects
      const currentDisplayOverrides = isReset ? [] : this.props.tile?.displayOverrides
      let currentSessionFilters = isReset ? [] : this.props.tile.filters || []

      // Merge dashboard-level slicers (applied even during reset, not tile-specific).
      if (this.props.dashboardSlicers && this.props.dashboardSlicers.length > 0) {
        currentSessionFilters = [...currentSessionFilters, ...this.props.dashboardSlicers]
      }
      const currentOrders = isReset ? [] : this.props.tile.orders
      const currentFilter = isReset ? [] : this.props.tile.tableFilters

      const requestData = {
        ...getAuthentication(this.getTileAuthentication()),
        ...this.getTileAutoQLConfig(),
        enableQueryValidation: !this.props.isEditing
          ? false
          : getAutoQLConfig(this.props.autoQLConfig).enableQueryValidation,
        skipQueryValidation: skipQueryValidation,
        newColumns: additionalColumnSelects,
        displayOverrides: currentDisplayOverrides,
        filters: currentSessionFilters,
        orders: currentOrders,
        tableFilters: currentFilter,
        source: this.props.dashboardId ? `dashboards.${this.props.dashboardId}` : 'dashboards.user',
        scope: 'dashboards',
        userSelection,
        cancelToken: this.axiosSource?.token,
        pageSize,
        query,
        force: false,
      }

      // For Nikki: using GET (`runCachedDashboardQuery`) until backend supports POST. When ready, use `runCachedDashboardQueryPost` here instead.
      const queryFunction = isCachedRefresh ? runCachedDashboardQueryPost : runQuery

      if (isCachedRefresh) {
        requestData.dashboardId = this.props.dashboardId
        requestData.tileKey = this.props.tileKey
        requestData.queryIndex = 0
      }

      return this.executeQueryWithForceRetry(requestData, queryFunction)
        .then((response) => {
          this.topRequestData = requestData
          return Promise.resolve(response)
        })
        .catch((error) => Promise.reject(error))
    }
    return Promise.reject()
  }

  executeQueryWithForceRetry(requestData, queryFunction) {
    const tryRequest = (data) => queryFunction(data)

    return tryRequest(requestData).catch((err) => {
      const resp = err?.response || err

      try {
        if (this.isServerError(resp) && !requestData.force) {
          const retryData = { ...requestData, force: true }

          // Emit telemetry (prefer `onRetry`, fallback to `onErrorCallback`).
          try {
            const payload = { type: 'retry', retryData }
            if (typeof this.props?.onRetry === 'function') this.props.onRetry(payload)
            else if (typeof this.props?.onErrorCallback === 'function') this.props.onErrorCallback(payload)
          } catch (e) {
            // ignore
          }

          // Immediate retry using the original query function
          return tryRequest(retryData)
        }
      } catch (e) {
        // detection error - fall through to rethrow original
      }

      return Promise.reject(err)
    })
  }

  processTileTop = ({
    query,
    userSelection,
    skipQueryValidation,
    source,
    pageSize,
    isCachedRefresh,
    isReset = false,
  }) => {
    this.setState({ isTopExecuting: true, queryResponse: null })
    const queryChanged = this.props.tile.query !== query
    const skipValidation = skipQueryValidation || (this.props.tile.skipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : this.props.tile?.queryValidationSelections)

    // Use saved config as fallback if props haven't been updated yet (e.g., after error restoration)
    // Check if dataConfig actually has valid values (not just an object with undefined properties)
    const propsDataConfig = this.props.tile.dataConfig
    const hasValidPropsDataConfig =
      propsDataConfig && (propsDataConfig.tableConfig != null || propsDataConfig.pivotTableConfig != null)
    const dataConfig = queryChanged
      ? undefined
      : hasValidPropsDataConfig
      ? propsDataConfig
      : this.savedTileConfig.dataConfig

    // isReset: use empty arrays since props may carry stale values before parent re-renders.
    const columns = isReset ? [] : queryChanged ? undefined : this.props.tile.columns || this.savedTileConfig.columns
    const tableFilters = isReset
      ? []
      : queryChanged
      ? undefined
      : this.props.tile.tableFilters || this.savedTileConfig.tableFilters

    // New query is running, reset temporary state fields
    // Only include dataConfig if it has valid values
    const paramsToSet = {
      query,
      skipQueryValidation: skipValidation,
      columns,
      defaultSelectedSuggestion: undefined,
      queryValidationSelections,
    }

    if (this.hasValidDataConfig(dataConfig)) {
      paramsToSet.dataConfig = dataConfig
    }
    if (tableFilters != null) {
      paramsToSet.tableFilters = tableFilters
    }

    // Reset all tile configs when query changes
    if (queryChanged) {
      paramsToSet.columnSelects = undefined
      paramsToSet.filters = undefined
      paramsToSet.orders = undefined
      paramsToSet.displayOverrides = undefined
      paramsToSet.columnOrder = undefined
      paramsToSet.frozenColumns = undefined
    } else if (isReset) {
      // tableFilters already set to [] above; set the remaining reset fields here.
      paramsToSet.orders = []
      paramsToSet.columnSelects = []
      paramsToSet.displayOverrides = []
      paramsToSet.filters = []
      paramsToSet.dataConfig = undefined
      paramsToSet.columnOrder = []
      paramsToSet.frozenColumns = []
    }

    this.debouncedSetParamsForTile(paramsToSet)

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      isCachedRefresh,
      isReset,
    })
      .then((response) => {
        return this.endTopQuery({ response, isReset, queryChanged, isCachedRefresh })
      })
      .catch((response) => {
        if (response?.data?.message === REQUEST_CANCELLED_ERROR) {
          return undefined
        }

        return this.endTopQuery({ response, isReset, isCachedRefresh })
      })
  }

  clearTopQueryResponse = (newState = {}) => {
    this.setState({
      isTopExecuting: false,
      isTopExecuted: false,
      userSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      queryResponse: undefined,
    })
  }

  processTile = ({ query, skipQueryValidation, source, isCachedRefresh, isReset = false } = {}) => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
    this.axiosSource = axios.CancelToken?.source()

    const q1 = query || this.props.tile.defaultSelectedSuggestion || this.state.query

    // Show the loading state while we wait for this tile's per-project token (if any) to resolve
    if (this._isMounted) {
      this.setState({ isTopExecuting: true })
    }

    return this.waitForTileAuthentication()
      .then((authReady) => {
        if (authReady === false) {
          // Per-project token never arrived — don't fire a query that is guaranteed to 403.
          return this.handleUnavailableTileAuth()
        }
        return this.processTileTop({ query: q1, skipQueryValidation, source, isCachedRefresh, isReset })
      })
      .then((queryResponse) => {
        // Read queryId from the fresh response since this.props.tile.queryId is stale until the debounce lands.
        const freshQueryId = queryResponse?.data?.data?.query_id
        return {
          ...this.props.tile,
          ...(freshQueryId ? { queryId: freshQueryId } : {}),
          queryResponse,
          defaultSelectedSuggestion: undefined,
        }
      })
      .catch(() => {
        return Promise.reject()
      })
  }

  debounceQueryInputChange = (query) => {
    if (query === this.state.query) {
      return
    }

    this.setState({ query, queryValidationSelections: undefined })

    clearTimeout(this.queryInputTimer)
    this.queryInputTimer = setTimeout(() => {
      const params = {
        query,
        pageSize: undefined,
        aggConfig: undefined,
        dataConfig: undefined,
        queryValidationSelections: undefined,
      }
      if (!query) {
        params.queryResponse = null
        params.queryId = undefined
      }
      this.debouncedSetParamsForTile(params)
    }, 600)
  }

  debounceTitleInputChange = (title) => {
    this.setState({ title })

    clearTimeout(this.titleInputTimer)
    this.titleInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({ title })
    }, 600)
  }

  onQueryTextKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
      this.processTile({ query: e.target.value })
      e.target.blur()
    }
  }

  onSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
    this.setState({ query })

    if (isButtonClick) {
      this.processTileTop({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ defaultSelectedSuggestion: query })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...getAuthentication(this.getTileAuthentication()),
      })
        .then((response) => {
          if (this._isMounted) {
            const body = response?.data?.data

            const sortingArray = []
            let suggestionsMatchArray = []
            autoCompleteArray = []
            suggestionsMatchArray = body.matches

            for (let i = 0; i < suggestionsMatchArray.length; i++) {
              sortingArray.push(suggestionsMatchArray[i])

              if (i === 4) {
                break
              }
            }

            sortingArray.sort((a, b) => b.length - a.length)
            for (let idx = 0; idx < sortingArray.length; idx++) {
              const anObject = {
                name: sortingArray[idx],
              }
              autoCompleteArray.push(anObject)
            }

            this.setState({
              suggestions: autoCompleteArray,
            })
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (userSelectedValueFromSuggestionBox && userSelectedValueFromSuggestionBox.name && this._isMounted) {
      const newQuery = userSelectedValueFromSuggestionBox.name
      this.userSelectedValue = newQuery
      this.userSelectedSuggestion = true
      this.setState({ query: newQuery })
      this.debouncedSetParamsForTile({ query: newQuery })
    }
  }

  onQueryInputChange = (e) => {
    // If input change we want to start validating the new queries again
    if (this.props.tile.skipQueryValidation) {
      this.debouncedSetParamsForTile({ skipQueryValidation: false })
    }

    if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e?.target?.value || e?.target?.value === '') {
      this.debounceQueryInputChange(e.target.value)
    } else {
      // User clicked on autosuggest item
      this.processTile({ query: this.userSelectedValue })
    }
  }

  onQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ query: queryText })
    this.debouncedSetParamsForTile({
      query: queryText,
      queryValidationSelections: selections,
    })
  }

  onPageSizeChange = (pageSize, newRows = []) => {
    const queryResponse = this.props.tile?.queryResponse?.data?.data?.rows
      ? _cloneDeep(this.props.tile.queryResponse)
      : undefined

    queryResponse.data.data.rows = newRows

    this.debouncedSetParamsForTile({ pageSize, queryResponse })
  }

  onAggConfigChange = (aggConfig) => this.debouncedSetParamsForTile({ aggConfig })
  // Persist data config immediately so axis selector save actions are not lost
  // when users quickly save the dashboard before debounce flushes.
  onDataConfigChange = (dataConfig) => {
    this.props.setParamsForTile({ dataConfig }, this.props.tile.i, [])
  }
  onDisplayTypeChange = (displayType) => this.debouncedSetParamsForTile({ displayType })
  onBucketSizeChange = (bucketSize) => this.debouncedSetParamsForTile({ bucketSize })
  onNetworkColumnChange = (networkColumnConfig) => this.debouncedSetParamsForTile({ networkColumnConfig })
  onLegendFilterChange = (legendFilterConfig) => this.debouncedSetParamsForTile({ legendFilterConfig })
  onAxisSortChange = (axisSorts) => this.debouncedSetParamsForTile({ axisSorts })
  onNewQueryId = (queryId) => queryId && this.debouncedSetParamsForTile({ queryId })
  onColumnOrderChange = (columnOrder) => this.debouncedSetParamsForTile({ columnOrder })
  onFrozenColumnsChange = (frozenColumns) => this.debouncedSetParamsForTile({ frozenColumns })

  // Chart controls (including pivoted/raw data source) should apply immediately so the axis selectors
  // and chart data source update without waiting for the debounce timer.
  onChartControlsChange = (chartControls) => {
    this.props.setParamsForTile({ chartControls }, this.props.tile.i, [])
  }

  onTableParamsChange = (params, formattedParams) => {
    if (!this.props.isEditing) {
      // Track whether view-mode header filters narrowed the rows below the tile's base filter (see componentDidUpdate).
      const viewModeFiltersDiffer = !_isEqual(formattedParams?.filters || [], this.props.tile?.tableFilters || [])
      if (viewModeFiltersDiffer !== this.state.viewModeFiltersDiffer) {
        this.setState({ viewModeFiltersDiffer })
      }
      return
    }
    this.debouncedSetParamsForTile({
      tableFilters: formattedParams.filters,
      orders: formattedParams.sorters,
    })
  }

  onColumnChange = (displayOverrides, columns, columnSelects, queryResponse, dataConfig, filters) => {
    if (!this.props.isEditing) return
    // Mark this query_id as self-reported so componentDidUpdate skips the remount bump (isSelfColumnChange)
    this._columnChangeQueryId = queryResponse?.data?.data?.query_id
    this.debouncedSetParamsForTile({
      columns,
      columnSelects,
      queryResponse,
      queryId: queryResponse?.data?.data?.query_id,
      dataConfig,
      displayOverrides,
      filters,
    })
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef?.openReportProblemModal()
    }
  }

  // Project the tile's query was executed against: flat project_id/project_name on response.data.data (AQLP-585)
  getTileProject = (response) => {
    const data = response?.data?.data
    if (!data?.project_id && !data?.project_name) {
      return null
    }

    return {
      id: data.project_id,
      name: data.project_name,
    }
  }

  renderProjectBadge = () => {
    if (!this.props.showProjectIndicator) {
      return null
    }

    const project = this.getTileProject(this.props.tile?.queryResponse)
    if (!project?.name) {
      return null
    }

    const currentProjectId = getAutoQLConfig(this.props.autoQLConfig).projectId
    if (currentProjectId != null && `${project.id}` === `${currentProjectId}`) {
      return null
    }

    return (
      <span
        className='dashboard-tile-project-badge'
        data-tooltip-content={`Project: ${project.name}`}
        data-tooltip-id={this.props.tooltipID}
      >
        {project.name}
      </span>
    )
  }

  onProjectSelectChange = (projectId) => {
    this.props.setParamsForTile({ projectId }, this.props.tile.i, [])
  }

  getSelectedProjectName = () => {
    const projectId = this.props.tile?.projectId
    const match = this.props.projectSelectList?.find((project) => project.projectId === projectId)
    return match?.displayName || this.getTileProject(this.props.tile?.queryResponse)?.name
  }

  openProjectModal = () => {
    this.setState({ isProjectModalOpen: true, pendingProjectId: this.props.tile?.projectId })
  }

  closeProjectModal = () => {
    this.setState({ isProjectModalOpen: false })
  }

  confirmProjectChange = () => {
    this.onProjectSelectChange(this.state.pendingProjectId)
    this.closeProjectModal()
  }

  // True when this tile's project differs from the dashboard's default project (edit mode indicator)
  hasNonDefaultProject = () => {
    const tileProjectId = this.props.tile?.projectId
    if (tileProjectId == null) {
      return false
    }
    const currentProjectId = getAutoQLConfig(this.props.autoQLConfig).projectId
    return `${tileProjectId}` !== `${currentProjectId}`
  }

  // Icon-only button that opens a modal to deliberately change the tile's project (multi-project dashboards).
  // Shows a small dot badge when the tile's project differs from the dashboard default — the tooltip alone
  // (revealed only on hover) is easy to miss.
  renderProjectButton = () => {
    if (!this.props.showProjectIndicator || !this.props.projectSelectList?.length) {
      return null
    }

    const projectName = this.getSelectedProjectName()

    return (
      <button
        type='button'
        className='dashboard-tile-project-button'
        aria-label='Change project'
        data-tooltip-content={projectName ? `Change project (current: ${projectName})` : 'Change project'}
        data-tooltip-id={this.props.tooltipID}
        onClick={this.openProjectModal}
      >
        <Icon type='database' />
        {this.hasNonDefaultProject() && <span className='dashboard-tile-project-button-indicator' />}
      </button>
    )
  }

  renderProjectModal = () => {
    if (!this.props.showProjectIndicator || !this.props.projectSelectList?.length) {
      return null
    }

    return (
      <Modal
        isVisible={this.state.isProjectModalOpen}
        title='Change Project'
        subtitle='Choose which project this tile should query.'
        width='400px'
        confirmText='Change Project'
        confirmDisabled={
          this.state.pendingProjectId == null || this.state.pendingProjectId === this.props.tile?.projectId
        }
        onClose={this.closeProjectModal}
        onConfirm={this.confirmProjectChange}
      >
        <Select
          fullWidth
          placeholder='Select a project'
          options={this.props.projectSelectList.map((project) => ({
            value: project.projectId,
            label: project.displayName,
          }))}
          value={this.state.pendingProjectId}
          onChange={(projectId) => this.setState({ pendingProjectId: projectId })}
          color='text'
        />
      </Modal>
    )
  }

  renderRTPopoverContent = (queryResponse) => {
    const response = queryResponse || this.props.tile?.queryResponse
    if (!response) return null

    const parsedInterpretation = response?.data?.data?.parsed_interpretation
    const interpretation = response?.data?.data?.interpretation

    const renderChunk = (chunk) => {
      switch (chunk?.c_type) {
        case 'VALIDATED_VALUE_LABEL':
        case 'VALIDATED_GROUP_BY':
        case 'VALIDATED_SEED':
        case 'DATE':
        case 'TEXT':
        case 'FILTER':
          return chunk.eng
        case 'SEED':
        case 'GROUP_BY':
        case 'PREFIX':
          return titlelizeString(chunk.eng)
        default:
          return chunk.eng
      }
    }

    const rtArray = parsedInterpretation ? constructRTArray(parsedInterpretation) : []

    return (
      <div className='react-autoql-reverse-translation-popover-content'>
        <div className='react-autoql-reverse-translation'>
          <div className='react-autoql-reverse-translation-header'>
            <Icon
              type='info'
              data-tooltip-content={
                'This statement reflects how your query was interpreted in order to return this data response.'
              }
              data-tooltip-id={this.props.tooltipID}
            />
            <strong> Interpreted as: </strong>
          </div>
          <div className='react-autoql-reverse-translation-content'>
            {parsedInterpretation && rtArray.length > 0 ? (
              <>
                {rtArray.map((chunk, i) => (
                  <div className='react-autoql-reverse-translation-chunk' key={i}>
                    {renderChunk(chunk)}
                  </div>
                ))}
              </>
            ) : (
              <div>{interpretation}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  renderHeader = () => {
    if (this.props.isEditing) {
      return (
        <div className='dashboard-tile-edit-wrapper'>
          <div
            className={`dashboard-tile-input-container
            ${this.state.isQueryInputFocused ? 'query-focused' : ''}
            ${this.state.isTitleInputFocused ? 'title-focused' : ''}`}
          >
            <div className='dashboard-tile-left-input-container'>
              <div className='query-input-icon-wrapper'>
                <Icon
                  className='query-input-icon'
                  type='react-autoql-bubbles-outlined'
                  tooltip='Query'
                  tooltipID={this.props.tooltipID}
                />
                {this.props.tile?.queryResponse &&
                  (this.props.tile.queryResponse?.data?.data?.parsed_interpretation ||
                    this.props.tile.queryResponse?.data?.data?.interpretation) && (
                    <Popover
                      isOpen={this.state.isRTHovered}
                      positions={['top', 'bottom']}
                      align='start'
                      padding={8}
                      onClickOutside={() => this.setState({ isRTHovered: false })}
                      content={this.renderRTPopoverContent()}
                    >
                      <div
                        className='query-input-interpretation-badge'
                        onMouseEnter={() => this.setState({ isRTHovered: true })}
                        onMouseLeave={() => this.setState({ isRTHovered: false })}
                      >
                        <Icon type='thinking-bubble' />
                      </div>
                    </Popover>
                  )}
              </div>
              {getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete ? (
                <Autosuggest
                  onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                  onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                  getSuggestionValue={this.userSelectedSuggestionHandler}
                  suggestions={this.state.suggestions}
                  ref={(ref) => {
                    this.autoSuggest = ref
                  }}
                  renderSuggestion={(suggestion) => {
                    return <>{suggestion.name}</>
                  }}
                  inputProps={{
                    className: 'dashboard-tile-autocomplete-input',
                    placeholder: 'Type a query in your own words',
                    value: this.state.query,
                    onFocus: (e) => {
                      e.stopPropagation()
                      this.setState({ isQueryInputFocused: true })
                    },
                    onChange: this.onQueryInputChange,
                    onKeyDown: this.onQueryTextKeyDown,
                    onBlur: () => this.setState({ isQueryInputFocused: false }),
                  }}
                />
              ) : (
                <input
                  className='dashboard-tile-input query'
                  placeholder='Type a query in your own words'
                  value={this.state.query}
                  data-tooltip-content='Query'
                  data-tooltip-id={this.props.tooltipID}
                  data-place='bottom'
                  spellCheck={false}
                  onChange={this.onQueryInputChange}
                  onKeyDown={this.onQueryTextKeyDown}
                  onFocus={() => this.setState({ isQueryInputFocused: true })}
                  onBlur={() => this.setState({ isQueryInputFocused: false })}
                />
              )}
              {this.props.tile?.queryResponse && (
                <div
                  className='dashboard-tile-rt-container'
                  onMouseEnter={() => this.setState({ isRTHovered: true })}
                  onMouseLeave={() => this.setState({ isRTHovered: false })}
                >
                  <ReverseTranslation
                    authentication={this.getTileAuthentication()}
                    queryResponse={this.props.tile.queryResponse}
                    tooltipID={this.props.tooltipID}
                    enableEditReverseTranslation={this.props.autoQLConfig?.enableEditReverseTranslation}
                    compact={true}
                    isHovered={this.state.isRTHovered}
                  />
                </div>
              )}
              <button
                className='dashboard-tile-send-button'
                onClick={() => this.processTile()}
                disabled={!this.isQueryValid(this.state.query)}
                type='button'
              >
                <Icon type='send' />
              </button>
            </div>

            <div className='dashboard-tile-right-input-container'>
              <Icon className='title-input-icon' type='title' tooltip='Title' tooltipID={this.props.tooltipID} />
              <input
                className='dashboard-tile-input title'
                placeholder='Add descriptive title (optional)'
                value={this.state.title}
                onChange={(e) => this.debounceTitleInputChange(e.target.value)}
                onFocus={() => this.setState({ isTitleInputFocused: true })}
                onBlur={() => this.setState({ isTitleInputFocused: false })}
              />
            </div>

            {this.renderProjectButton()}
          </div>
          {this.renderProjectModal()}
        </div>
      )
    }

    const fullTitle = this.props.tile.title || this.props.tile.query || 'Untitled'
    return (
      <div className='dashboard-tile-title-container dashboard-tile-title-wrap'>
        <span
          ref={(r) => (this.dashboardTileTitleRef = r)}
          className='dashboard-tile-title'
          id={`dashboard-tile-title-${this.COMPONENT_KEY}`}
        >
          {fullTitle}
        </span>
        {this.renderProjectBadge()}
        <div className='dashboard-tile-title-divider'></div>
      </div>
    )
  }

  renderContentPlaceholder = ({ isExecuting, isExecuted } = {}) => {
    if (isExecuting) {
      // This should always take priority over the other conditions below
      return (
        <div className='loading-container-centered'>
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.query?.trim()) {
      return (
        <div className='loading-container-centered'>
          <div className='dashboard-tile-placeholder-text'>
            {this.props.isEditing ? (
              <span>
                To get started, enter a query and click <Icon className='send-icon' type='send' />
              </span>
            ) : (
              <span>No query was supplied for this tile.</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className='loading-container-centered'>
        <div className='dashboard-tile-placeholder-text'>
          {this.props.isEditing ? (
            <span>
              Hit <Icon className='edit-mode-placeholder-icon' type='send' /> to run this tile
            </span>
          ) : (
            <span>{this.props.notExecutedText}</span>
          )}
        </div>
      </div>
    )
  }

  onCSVDownloadStart = (params) =>
    this.props.onCSVDownloadStart({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadProgress = (params) =>
    this.props.onCSVDownloadProgress({
      ...params,
      tileId: this.props.tile.i,
    })

  onCSVDownloadFinish = (params) =>
    this.props.onCSVDownloadFinish({
      ...params,
      tileId: this.props.tile.i,
    })

  onPNGDownloadFinish = () => this.props.onPNGDownloadFinish({ tileId: this.props.tile.i })

  onOpenFollowOnModal = () => {
    this.setState({ isFollowOnModalOpen: true })
  }

  onDrilldownStart = (activeKey) =>
    this.props.onDrilldownStart({
      tileId: this.props.tile.i,
      activeKey,
      queryOutputRef: this.state.responseRef,
    })

  renderToolbars = ({ queryOutputProps, vizToolbarProps, optionsToolbarProps }) => {
    const { hideOnError, ...toolbarProps } = optionsToolbarProps
    return (
      <div className='dashboard-tile-toolbars-container'>
        <div className='dashboard-tile-toolbars-left-container'>
          {this.props.isEditing && (
            <VizToolbar
              {...vizToolbarProps}
              shouldRender={!this.props.isDragging}
              tooltipID={this.props.tooltipID}
              compact={true}
            />
          )}
        </div>
        <div className='dashboard-tile-toolbars-right-container'>
          {!hideOnError && (
            <OptionsToolbar
              authentication={this.getTileAuthentication()}
              autoQLConfig={this.getTileAutoQLConfig()}
              onErrorCallback={this.props.onErrorCallback}
              onSuccessAlert={this.props.onSuccessCallback}
              onCSVDownloadStart={this.onCSVDownloadStart}
              onCSVDownloadProgress={this.onCSVDownloadProgress}
              onCSVDownloadFinish={this.onCSVDownloadFinish}
              onPNGDownloadFinish={this.onPNGDownloadFinish}
              shouldRender={!this.props.isDragging}
              tooltipID={this.props.tooltipID}
              popoverPositions={['top', 'left', 'bottom', 'right']}
              customOptions={this.props.customToolbarOptions}
              popoverAlign='end'
              enableMagicWand={this.props.enableMagicWand}
              showMagicWandQuoteButton={this.props.showMagicWandQuoteButton}
              enableFollowOnQuery={this.props.enableFollowOnQuery}
              onOpenFollowOnModal={this.onOpenFollowOnModal}
              isEditing={this.props.isEditing}
              source={this.props.dashboardId ? `dashboards.${this.props.dashboardId}` : 'dashboards.user'}
              scope={this.props.scope}
              {...toolbarProps}
            />
          )}
        </div>
      </div>
    )
  }

  renderResponseContent = ({ queryOutputProps, isExecuting, isExecuted, renderPlaceholder }) => {
    if (renderPlaceholder) {
      return this.renderContentPlaceholder({
        isExecuting,
        isExecuted,
      })
    }

    return (
      <QueryOutput
        authentication={this.getTileAuthentication()}
        autoQLConfig={this.getTileAutoQLConfig()}
        dataFormatting={this.props.dataFormatting}
        renderTooltips={false}
        autoSelectQueryValidationSuggestion={false}
        autoChartAggregations={this.props.autoChartAggregations}
        isResizing={this.props.isDragging || this.state.isDraggingSplitter}
        renderSuggestionsAsDropdown={this.props.tile.h < 4}
        enableDynamicCharting={this.props.enableDynamicCharting}
        backgroundColor={document.documentElement.style.getPropertyValue('--react-autoql-background-color-secondary')}
        showQueryInterpretation={false}
        reverseTranslationPlacement='bottom'
        reverseTranslationCompact={false}
        tooltipID={this.props.tooltipID}
        chartTooltipID={this.props.chartTooltipID}
        shouldRender={!this.props.isDragging}
        allowColumnAddition={this.props.isEditing}
        enableTableContextMenu={this.props.isEditing}
        source={this.props.dashboardId ? `dashboards.${this.props.dashboardId}` : 'dashboards.user'}
        scope='dashboards'
        autoHeight={false}
        height='100%'
        width='100%'
        onUpdateFilterResponse={this.onUpdateFilterResponse}
        localRTFilterResponse={this.state.localRTFilterResponse}
        enableCustomColumns={this.props.enableCustomColumns}
        preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
        useInfiniteScroll={this.props.useInfiniteScroll}
        enableCyclicalDates={this.props.enableCyclicalDates}
        {...queryOutputProps}
      />
    )
  }

  renderResponse = ({
    queryOutputProps = {},
    vizToolbarProps = {},
    optionsToolbarProps = {},
    isExecuting,
    isExecuted,
    renderPlaceholder,
  }) => {
    return (
      <div className='loading-container-centered' id={queryOutputProps.key}>
        {this.renderResponseContent({
          queryOutputProps,
          isExecuting,
          isExecuted,
          renderPlaceholder,
        })}
        {this.renderToolbars({
          queryOutputProps,
          vizToolbarProps,
          optionsToolbarProps,
        })}
      </div>
    )
  }

  renderTopResponse = () => {
    const isExecuting = this.state.isTopExecuting
    const isExecuted = this.state.isTopExecuted

    const renderPlaceholder = !this.props.tile?.queryResponse || isExecuting || !isExecuted

    const initialDisplayType = this.props?.tile?.displayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        ref: (ref) => ref && ref !== this.state.responseRef && this._isMounted && this.setState({ responseRef: ref }),
        optionsToolbarRef: this.optionsToolbarRef,
        vizToolbarRef: this.vizToolbarRef,
        key: `dashboard-tile-query-top-${this.FIRST_QUERY_RESPONSE_KEY}-${this.state.queryResponseVersion}`,
        initialDisplayType,
        queryResponse: this.props.tile?.queryResponse,
        initialTableConfigs: (() => {
          const dataConfig = this.props.tile?.dataConfig || {}
          // Extract columnOverrides from tile.columns if it exists (for date precision persistence)
          // Compare tile.columns with queryResponse columns to find overrides
          // Use columnOverrides from dataConfig if it exists (preferred method)
          let columnOverrides = dataConfig?.columnOverrides || {}

          // Fallback: Extract columnOverrides from tile.columns if dataConfig doesn't have it
          // This handles backwards compatibility with dashboards saved before columnOverrides was added
          if (
            !dataConfig?.columnOverrides &&
            this.props.tile?.columns &&
            this.props.tile?.queryResponse?.data?.data?.columns
          ) {
            const savedColumns = this.props.tile.columns
            const originalColumns = this.props.tile.queryResponse.data.data.columns
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
            ...(!pivotConfigIsEmpty && pivotTableConfig !== undefined ? { pivotTableConfig } : {}),
            ...(!pivotConfigIsEmpty && tableConfig !== undefined ? { tableConfig } : {}),
          }
        })(),
        initialAggConfig: this.props.tile.aggConfig,
        onTableConfigChange: this.onDataConfigChange,
        onTableParamsChange: this.onTableParamsChange,
        onAggConfigChange: this.onAggConfigChange,
        onColumnChange: this.onColumnChange,
        queryValidationSelections: this.props.tile.queryValidationSelections,
        onSuggestionClick: this.onSuggestionClick,
        defaultSelectedSuggestion: this.props.tile?.defaultSelectedSuggestion,
        onNoneOfTheseClick: this.onNoneOfTheseClick,
        onDrilldownStart: this.onDrilldownStart,
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onQueryValidationSelectOption,
        reportProblemCallback: this.reportProblemCallback,
        queryRequestData: this.topRequestData,
        onDisplayTypeChange: this.onDisplayTypeChange,
        dataPageSize: this.props.tile.pageSize,
        onPageSizeChange: this.onPageSizeChange,
        onBucketSizeChange: this.onBucketSizeChange,
        bucketSize: this.props.tile.bucketSize,
        initialNetworkColumnConfig: this.props.tile.networkColumnConfig,
        onNetworkColumnChange: this.onNetworkColumnChange,
        legendFilterConfig: this.props.tile.legendFilterConfig,
        onLegendFilterChange: this.onLegendFilterChange,
        initialAxisSorts: this.normalizeAxisSorts(this.props.tile?.axisSorts),
        onAxisSortChange: this.onAxisSortChange,
        initialColumnOrder: this.props.tile?.columnOrder,
        onColumnOrderChange: this.onColumnOrderChange,
        initialFrozenColumns: this.props.tile?.frozenColumns,
        onFrozenColumnsChange: this.onFrozenColumnsChange,
        disableAggregationMenu: this.props.disableAggregationMenu,
        allowCustomColumnsOnDrilldown: this.props.allowCustomColumnsOnDrilldown,
        initialFormattedTableParams: {
          filters: this.props.tile?.tableFilters,
          sorters: this.props.tile?.orders,
          sessionFilters: this.props.tile?.filters || [],
        },
        lockedFilters: this.props.tile?.tableFilters ?? [],
        enableChartControls: true,
        initialChartControls: this.props.tile?.chartControls || {
          showAverageLine: false,
          showRegressionLine: false,
        },
        onChartControlsChange: this.onChartControlsChange,
        isDashboardEditing: this.props.isEditing,
        skipInitialFilters: true,
        onNewQueryId: this.onNewQueryId,
        initialIsFiltering: this.wasFilteringBeforeRemount,
      },
      vizToolbarProps: {
        ref: (r) => (this.vizToolbarRef = r),
        responseRef: this.state.responseRef,
        key: `dashboard-tile-viz-toolbar-${this.FIRST_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
      },
      optionsToolbarProps: {
        ref: (r) => (this.optionsToolbarRef = r),
        responseRef: this.state.responseRef,
        key: `dashboard-tile-options-toolbar-${this.FIRST_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
        initialIsFiltering: this.wasFilteringBeforeRemount,
        onRefreshClick: () => this.props.executeSingleTile(this.props.tile.i),
        onResetClick: () => this.props.resetTile?.(this.props.tile.i),
        showRefreshInEdit:
          this.props.isEditing &&
          this.props.tile?.displayType !== 'single-value' &&
          !this.hasError(this.props.tile?.queryResponse),
        showResetQueryOption:
          this.props.showResetQueryOption && !!this.props.tile?.query && !!this.props.tile?.queryResponse,
        hideReportProblem: this.hasError(this.props.tile?.queryResponse),
        hideOnError: this.shouldHideOptions(this.props.tile?.queryResponse),
      },
    })
  }

  renderContent = () => {
    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${this.props.tile.h < 4 ? ' small' : ''}`}
      >
        <div className='dashboard-tile-response-container'>{this.renderTopResponse()}</div>
      </div>
    )
  }

  renderDragHandle = (props, placement) => {
    return <div {...props} className={`react-autoql-dashboard-tile-drag-handle ${placement}`} />
  }

  renderDragHandles = () => {
    const propsToPassToDragHandle = {
      onMouseDown: (e) => {
        e.stopPropagation()
        return this.props.onMouseDown(e)
      },
      onMouseUp: (e) => {
        e.stopPropagation()
        return this.props.onMouseUp(e)
      },
      onTouchStart: (e) => {
        e.stopPropagation()
        return this.props.onTouchStart(e)
      },
      onTouchEnd: (e) => {
        e.stopPropagation()
        return this.props.onTouchEnd(e)
      },
    }

    return (
      <>
        {this.renderDragHandle(propsToPassToDragHandle, 'top')}
        {this.renderDragHandle(propsToPassToDragHandle, 'bottom')}
        {this.renderDragHandle(propsToPassToDragHandle, 'left')}
        {this.renderDragHandle(propsToPassToDragHandle, 'right')}
      </>
    )
  }

  renderDeleteBtn = () => {
    return (
      <button
        className='dashboard-tile-delete-button'
        onClick={() => this.props.deleteTile(this.props.tile.i)}
        type='button'
        aria-label='Delete tile'
      >
        <Icon type='close' />
      </button>
    )
  }

  render = () => {
    const style = {}
    if (this.props.isDragging) {
      style.pointerEvents = 'none'
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.ref = r)}
          className={`${this.props.className}${this.shouldShowDirtyBadge() ? ' dirty' : ''}${
            this.props.isEditing && this.props.isFailed && !this.props.tile?.splitView ? ' failed' : ''
          }`}
          style={{ ...this.props.style }}
          data-grid={this.props.tile}
          data-test='react-autoql-dashboard-tile'
        >
          {this.props.children}
          <div
            id={`react-autoql-dashboard-tile-inner-div-${this.COMPONENT_KEY}`}
            ref={(r) => (this.tileInnerDiv = r)}
            className='react-autoql-dashboard-tile-inner-div'
            style={style}
          >
            <>
              {this.renderHeader()}
              {this.renderContent()}
            </>
          </div>
          {this.shouldShowDirtyBadge() && (
            <div
              className='react-autoql-dashboard-tile-dirty-badge'
              data-tooltip-content='Re-execute this query before saving the dashboard'
              data-tooltip-id={this.props.tooltipID}
            >
              !
            </div>
          )}
          {this.props.isEditing && this.props.isFailed && !this.props.tile?.splitView && (
            <div
              className='react-autoql-dashboard-tile-failed-badge'
              data-tooltip-content='This query has failed'
              data-tooltip-id={this.props.tooltipID}
            >
              !
            </div>
          )}
          {this.props.isEditing && this.renderDragHandles()}
          {this.props.isEditing && this.renderDeleteBtn()}
          {this.props.enableFollowOnQuery && (
            <FollowOnModal
              isVisible={this.state.isFollowOnModalOpen}
              onClose={() => this.setState({ isFollowOnModalOpen: false })}
              authentication={this.getTileAuthentication()}
              autoQLConfig={this.getTileAutoQLConfig()}
              dataFormatting={this.props.dataFormatting}
              responseRef={this.state.responseRef}
              queryResponse={this.props.tile?.queryResponse}
              initialResults={this.state.followOnResults}
              onResultsChange={(results) => this.setState({ followOnResults: results })}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

// React-Grid-Layout needs the forwarded original ref
// we can forward our own ref down to DashboardTile as a prop
export default React.forwardRef(({ style, className, key, ...props }, ref) => (
  <div style={{ ...style }} className={className} ref={ref}>
    <DashboardTile
      {...props}
      rglRef={ref}
      ref={props.tileRef}
      className={`${props.innerDivClass} ${props.isEditing ? 'editing' : ''}`}
    />
  </div>
))
