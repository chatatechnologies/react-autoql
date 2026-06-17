import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import Autosuggest from 'react-autosuggest'
import SplitterLayout from 'react-splitter-layout'

import {
  runQuery,
  fetchAutocomplete,
  deepEqual,
  isChartType,
  findNetworkColumns,
  REQUEST_CANCELLED_ERROR,
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
import { Button } from '../../Button'
import { VizToolbar } from '../../VizToolbar'
import { QueryOutput } from '../../QueryOutput'
import { OptionsToolbar } from '../../OptionsToolbar'
import LoadingDots from '../../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { ReverseTranslation } from '../../ReverseTranslation'
import { Popover } from '../../Popover'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './DashboardTile.scss'

let autoCompleteArray = []

export class DashboardTile extends React.Component {
  constructor(props) {
    super(props)
    this._isMounted = false
    this.dashboardTileTitleRef = undefined
    this.optionsToolbarRef = undefined
    this.secondOptionsToolbarRef = undefined
    this.COMPONENT_KEY = uuid()
    this.FIRST_QUERY_RESPONSE_KEY = uuid()
    this.SECOND_QUERY_RESPONSE_KEY = uuid()
    this.DEFAULT_AJAX_PAGE_SIZE = 50
    this.autoCompleteTimer = undefined
    this.debounceTime = 50
    this.paramsToSet = {}
    this.callbackArray = []

    // Store original saved tile config from DB to restore after errors
    this.savedTileConfig = {}
    this.configKeys = [
      'displayType',
      'secondDisplayType',
      'dataConfig',
      'secondDataConfig',
      'aggConfig',
      'secondAggConfig',
      'columns',
      'secondColumns',
      'tableFilters',
      'secondTableFilters',
      'axisSorts',
      'secondAxisSorts',
      'networkColumnConfig',
      'secondNetworkColumnConfig',
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

    const newSecondAggConfig = {}
    tile?.secondAggConfig &&
      Object.keys(tile.secondAggConfig)?.forEach((column) => {
        if (tile.secondAggConfig?.[column]) {
          newSecondAggConfig[column] = tile.secondAggConfig[column].toUpperCase()
        }
      })

    props.setParamsForTile(
      {
        aggConfig: newAggConfig,
        secondAggConfig: newSecondAggConfig,
      },
      tile.i,
    )
    // -------------------------------------------------------------------------------------

    this.state = {
      tileIdx: tile.i,
      query: tile.query,
      secondQuery: tile.secondQuery || tile.query,
      title: tile.title,
      isTopExecuting: false,
      isBottomExecuting: false,
      suggestions: [],
      isSecondQueryInputOpen: false,
      isTopExecuted: !!tile.queryResponse,
      localRTFilterResponse: null,
      isBottomExecuted:
        tile.splitView && (this.areTopAndBottomSameQuery() ? !!tile.queryResponse : !!tile.secondQueryResponse),
      initialFormattedTableParams: {
        filters: tile?.tableFilters,
        sorters: tile?.orders,
        sessionFilters: tile?.filters || [],
      },
      initialSecondFormattedTableParams: {
        filters: tile?.secondTableFilters,
        sorters: tile?.secondOrders,
        sessionFilters: tile?.filters || [],
      },
      isRTHovered: false,
      isSecondRTHovered: false,
      currentSplitPercent: tile?.secondDisplayPercentage ?? 50,
      queryResponseVersion: 0,
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
      secondQuery: PropTypes.string,
      title: PropTypes.string,
      displayType: PropTypes.string,
      secondDisplayType: PropTypes.string,
      pageSize: PropTypes.number,
      secondPageSize: PropTypes.number,
      bucketSize: PropTypes.number,
      secondBucketSize: PropTypes.number,
      columns: PropTypes.array,
      secondColumns: PropTypes.array,
      columnSelects: PropTypes.array,
      secondColumnSelects: PropTypes.array,
      dataConfig: PropTypes.object,
      secondDataConfig: PropTypes.object,
      aggConfig: PropTypes.object,
      secondAggConfig: PropTypes.object,
      tableFilters: PropTypes.array,
      secondTableFilters: PropTypes.array,
      filters: PropTypes.array,
      secondFilters: PropTypes.array,
      orders: PropTypes.array,
      secondOrders: PropTypes.array,
      axisSorts: PropTypes.array,
      secondAxisSorts: PropTypes.array,
      networkColumnConfig: PropTypes.any,
      secondNetworkColumnConfig: PropTypes.any,
      chartControls: PropTypes.object,
      secondChartControls: PropTypes.object,
      legendFilterConfig: PropTypes.any,
      queryResponse: PropTypes.shape({}),
      secondQueryResponse: PropTypes.shape({}),
      defaultSelectedSuggestion: PropTypes.string,
      secondDefaultSelectedSuggestion: PropTypes.string,
      queryValidationSelections: PropTypes.any,
      secondQueryValidationSelections: PropTypes.any,
      splitView: PropTypes.bool,
    }).isRequired,
    isEditing: PropTypes.bool,
    isDirty: PropTypes.bool,
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
    showResetQueryOption: PropTypes.bool,
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
    // If query or title change from props (due to undo for example), update state
    if (this.props.tile?.title !== prevProps.tile?.title) {
      this.setState({ title: this.props.tile?.title })
    }
    if (this.props.tile?.query !== prevProps.tile?.query) {
      this.setState({ query: this.props.tile?.query })
    }
    if (this.props.tile?.secondQuery !== prevProps.tile?.secondQuery) {
      this.setState({ secondQuery: this.props.tile?.secondQuery })
    }
    if (
      this.responseRef?._isMounted &&
      this.props.tile?.displayType &&
      this.props.tile.displayType !== prevProps.tile?.displayType &&
      this.props.tile.displayType !== this.responseRef.state.displayType
    ) {
      this.responseRef.changeDisplayType(this.props.tile.displayType)
    }
    const prevQR = prevProps.tile?.queryResponse
    const nextQR = this.props.tile?.queryResponse
    const prevQRId = prevQR?.data?.data?.query_id
    const nextQRId = nextQR?.data?.data?.query_id
    if (nextQR && !this.state.isTopExecuting && (prevQR === null || (prevQR && prevQRId !== nextQRId))) {
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
        prevTile.query !== nextTile.query

      if (topChanged && this.topRequestData) {
        this.topRequestData = {
          ...this.topRequestData,
          tableFilters: nextTile.tableFilters || [],
          filters: nextTile.filters || [],
          orders: nextTile.orders || [],
          pageSize: nextTile.pageSize,
          query: nextTile.query || this.topRequestData.query,
        }
      }

      const prevBottom = prevTile.secondQuery || null
      const nextBottom = nextTile.secondQuery || null
      const bottomChanged =
        !_isEqual(prevTile.secondTableFilters, nextTile.secondTableFilters) ||
        !_isEqual(prevTile.secondFilters, nextTile.secondFilters) ||
        !_isEqual(prevTile.secondOrders, nextTile.secondOrders) ||
        prevTile.secondPageSize !== nextTile.secondPageSize ||
        prevBottom !== nextBottom

      if (bottomChanged && this.bottomRequestData) {
        this.bottomRequestData = {
          ...this.bottomRequestData,
          tableFilters: nextTile.secondTableFilters || [],
          filters: nextTile.secondFilters || [],
          orders: nextTile.secondOrders || [],
          pageSize: nextTile.secondPageSize,
          query: nextTile.secondQuery || this.bottomRequestData.query,
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
      clearTimeout(this.secondQueryInputTimer)
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
    this.state.secondResponseRef?.refreshLayout()
  }

  cancelAllQueries = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
    this.secondAxiosSource?.cancel(REQUEST_CANCELLED_ERROR)
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
    this.setParamsForTileTimeout = setTimeout(() => {
      if (!this._isMounted) return
      this.props.setParamsForTile(this.paramsToSet, this.props.tile.i, _cloneDeep(this.callbackArray))
      this.paramsToSet = {}
      this.callbackArray = []
    }, this.debounceTime)
  }

  getFilteredProps = (props) => {
    return {
      ...props,
      children: undefined,
      tileRef: undefined,
    }
  }

  isQueryValid = (query) => {
    return !!query && !!query.trim()
  }

  setTopExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isTopExecuting: false,
        isTopExecuted: true,
      })
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
      // For dataConfig/secondDataConfig, check if it has valid values
      if (key === 'dataConfig' || key === 'secondDataConfig') {
        if (this.hasValidDataConfig(value)) {
          filtered[key] = value
        }
      }
      // For tableFilters/secondTableFilters, allow empty arrays but not null/undefined
      else if (key === 'tableFilters' || key === 'secondTableFilters') {
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
        secondDisplayType: tile.secondDisplayType,
        dataConfig: tile.dataConfig,
        secondDataConfig: tile.secondDataConfig,
        aggConfig: tile.aggConfig,
        secondAggConfig: tile.secondAggConfig,
        columns: tile.columns,
        secondColumns: tile.secondColumns,
        tableFilters: tile.tableFilters,
        secondTableFilters: tile.secondTableFilters,
        axisSorts: tile.axisSorts,
        secondAxisSorts: tile.secondAxisSorts,
        networkColumnConfig: tile.networkColumnConfig,
        secondNetworkColumnConfig: tile.secondNetworkColumnConfig,
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
        // Capture new queryId unless this is a cached view-mode refresh that already has one.
        if (queryChanged || !this.props.tile?.queryId || !isCachedRefresh) {
          const queryId = response?.data?.data?.query_id
          paramsToSet.queryId = queryId
          // When both halves share the same execution (same query or no split), mirror the id
          if (this.areTopAndBottomSameQuery()) {
            paramsToSet.secondQueryId = queryId
          }
        }
        // If successful, update saved config with current tile config (preserve user's saved settings)
        const currentTile = this.props.tile
        if (currentTile) {
          // Only update dataConfig if it has valid values (not just an object with undefined properties)
          const hasValidCurrentDataConfig = this.hasValidDataConfig(currentTile.dataConfig)
          const hasValidSecondDataConfig = this.hasValidDataConfig(currentTile.secondDataConfig)

          if (isReset) {
            // props.tile is stale during reset — only update display-type fields; clear the rest to match the zeroed tile.
            this.savedTileConfig = {
              ...this.savedTileConfig,
              displayType: currentTile.displayType || this.savedTileConfig.displayType,
              secondDisplayType: currentTile.secondDisplayType || this.savedTileConfig.secondDisplayType,
              columns: [],
              tableFilters: [],
              aggConfig: undefined,
              dataConfig: undefined,
              axisSorts: undefined,
              networkColumnConfig: undefined,
            }
          } else {
            this.savedTileConfig = {
              ...this.savedTileConfig,
              displayType: currentTile.displayType || this.savedTileConfig.displayType,
              secondDisplayType: currentTile.secondDisplayType || this.savedTileConfig.secondDisplayType,
              dataConfig: hasValidCurrentDataConfig ? currentTile.dataConfig : this.savedTileConfig.dataConfig,
              secondDataConfig: hasValidSecondDataConfig
                ? currentTile.secondDataConfig
                : this.savedTileConfig.secondDataConfig,
              aggConfig: currentTile.aggConfig || this.savedTileConfig.aggConfig,
              secondAggConfig: currentTile.secondAggConfig || this.savedTileConfig.secondAggConfig,
              columns: currentTile.columns || this.savedTileConfig.columns,
              secondColumns: currentTile.secondColumns || this.savedTileConfig.secondColumns,
              tableFilters:
                currentTile.tableFilters != null ? currentTile.tableFilters : this.savedTileConfig.tableFilters,
              secondTableFilters:
                currentTile.secondTableFilters != null
                  ? currentTile.secondTableFilters
                  : this.savedTileConfig.secondTableFilters,
              axisSorts: currentTile.axisSorts || this.savedTileConfig.axisSorts,
              secondAxisSorts: currentTile.secondAxisSorts || this.savedTileConfig.secondAxisSorts,
              networkColumnConfig: currentTile.networkColumnConfig || this.savedTileConfig.networkColumnConfig,
              secondNetworkColumnConfig:
                currentTile.secondNetworkColumnConfig || this.savedTileConfig.secondNetworkColumnConfig,
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

  setBottomExecuted = () => {
    if (this._isMounted) {
      this.setState({
        isBottomExecuting: false,
        isBottomExecuted: true,
      })
    }
  }

  endBottomQuery = ({ response, isReset = false, queryChanged = true, isCachedRefresh = false }) => {
    if (response?.data?.message !== REQUEST_CANCELLED_ERROR) {
      const isError = this.hasError(response)

      // Build params to set - always include secondQueryResponse
      const paramsToSet = {
        secondQueryResponse: response,
        secondDefaultSelectedSuggestion: undefined,
      }

      if (!isError && (queryChanged || !this.props.tile?.secondQueryId || !isCachedRefresh)) {
        paramsToSet.secondQueryId = response?.data?.data?.query_id
      }

      if (isError) {
        // If there's an error, restore the saved tile config for second query
        // Only restore second query specific configs
        const secondQueryConfig = this.filterValidConfig({
          secondDisplayType: this.savedTileConfig.secondDisplayType,
          secondDataConfig: this.savedTileConfig.secondDataConfig,
          secondAggConfig: this.savedTileConfig.secondAggConfig,
          secondColumns: this.savedTileConfig.secondColumns,
          secondTableFilters: this.savedTileConfig.secondTableFilters,
          secondAxisSorts: this.savedTileConfig.secondAxisSorts,
          secondNetworkColumnConfig: this.savedTileConfig.secondNetworkColumnConfig,
        })
        Object.assign(paramsToSet, secondQueryConfig)
      } else {
        const currentTile = this.props.tile
        if (currentTile) {
          if (isReset) {
            // props.tile is stale during reset — only update display-type fields; clear the rest to match the zeroed tile.
            this.savedTileConfig = {
              ...this.savedTileConfig,
              secondDisplayType: currentTile.secondDisplayType || this.savedTileConfig.secondDisplayType,
              secondColumns: [],
              secondTableFilters: [],
              secondAggConfig: undefined,
              secondDataConfig: undefined,
              secondAxisSorts: undefined,
              secondNetworkColumnConfig: undefined,
            }
          } else {
            const hasValidSecondDataConfig = this.hasValidDataConfig(currentTile.secondDataConfig)
            this.savedTileConfig = {
              ...this.savedTileConfig,
              secondDisplayType: currentTile.secondDisplayType || this.savedTileConfig.secondDisplayType,
              secondDataConfig: hasValidSecondDataConfig
                ? currentTile.secondDataConfig
                : this.savedTileConfig.secondDataConfig,
              secondAggConfig: currentTile.secondAggConfig || this.savedTileConfig.secondAggConfig,
              secondColumns: currentTile.secondColumns || this.savedTileConfig.secondColumns,
              secondTableFilters:
                currentTile.secondTableFilters != null
                  ? currentTile.secondTableFilters
                  : this.savedTileConfig.secondTableFilters,
              secondAxisSorts: currentTile.secondAxisSorts || this.savedTileConfig.secondAxisSorts,
              secondNetworkColumnConfig:
                currentTile.secondNetworkColumnConfig || this.savedTileConfig.secondNetworkColumnConfig,
            }
          }
        }
        paramsToSet.secondNetworkColumnConfig = this.getNetworkColumnConfig(response)
      }

      this.debouncedSetParamsForTile(paramsToSet, this.setBottomExecuted)
      return response
    } else {
      return Promise.reject(REQUEST_CANCELLED_ERROR)
    }
  }

  processQuery = ({ query, userSelection, skipQueryValidation, source, isSecondHalf, isCachedRefresh, isReset = false }) => {
    if (this.isQueryValid(query)) {
      let pageSize
      if (isSecondHalf && isChartType(this.props.tile.secondDisplayType)) {
        pageSize = this.props.tile.secondPageSize ?? this.props.dataPageSize
      } else if (isChartType(this.props.tile.displayType)) {
        pageSize = this.props.tile.pageSize ?? this.props.dataPageSize
      }

      const useSecondAxiosSource = isSecondHalf && !this.areTopAndBottomSameQuery()
      // isReset: use empty arrays — props may carry stale values before parent re-renders.
      const additionalColumnSelects = isReset ? [] : (isSecondHalf ? this.props.tile.secondColumnSelects : this.props.tile.columnSelects)
      const currentDisplayOverrides = isReset ? [] : (isSecondHalf
        ? this.props.tile?.secondDisplayOverrides
        : this.props.tile?.displayOverrides)
      let currentSessionFilters = isReset ? [] : (isSecondHalf ? this.props.tile.secondFilters : this.props.tile.filters || [])

      // Merge dashboard-level slicers (applied even during reset, not tile-specific).
      if (this.props.dashboardSlicers && this.props.dashboardSlicers.length > 0 && !isSecondHalf) {
        currentSessionFilters = [...currentSessionFilters, ...this.props.dashboardSlicers]
      }
      const currentOrders = isReset ? [] : (isSecondHalf ? this.props.tile.secondOrders : this.props.tile.orders)
      const currentFilter = isReset ? [] : (isSecondHalf ? this.props.tile.secondTableFilters : this.props.tile.tableFilters)
      const cancelToken = useSecondAxiosSource ? this.secondAxiosSource?.token : this.axiosSource?.token

      const requestData = {
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        enableQueryValidation: !this.props.isEditing
          ? false
          : getAutoQLConfig(this.props.autoQLConfig).enableQueryValidation,
        skipQueryValidation: skipQueryValidation,
        newColumns: additionalColumnSelects,
        displayOverrides: currentDisplayOverrides,
        filters: currentSessionFilters,
        orders: currentOrders,
        tableFilters: currentFilter,
        // Hardcode this for now until we change the filter lock blacklist to a whitelist
        // mergeSources(this.props.source, source),
        source: this.props.dashboardId ? `dashboards.${this.props.dashboardId}` : 'dashboards.user',
        scope: 'dashboards',
        userSelection,
        cancelToken,
        pageSize,
        query,
        force: false,
      }

      // For Nikki: using GET (`runCachedDashboardQuery`) until backend supports POST. When ready, use `runCachedDashboardQueryPost` here instead.
      const queryFunction = isCachedRefresh ? runCachedDashboardQueryPost : runQuery

      if (isCachedRefresh) {
        requestData.dashboardId = this.props.dashboardId
        requestData.tileKey = this.props.tileKey
        requestData.queryIndex = isSecondHalf ? 1 : 0
      }

      return this.executeQueryWithForceRetry(requestData, queryFunction)
        .then((response) => {
          if (isSecondHalf) {
            this.bottomRequestData = requestData
          } else {
            this.topRequestData = requestData
          }
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

  processTileTop = ({ query, userSelection, skipQueryValidation, source, pageSize, isCachedRefresh, isReset = false }) => {
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
    const columns = isReset ? [] : (queryChanged ? undefined : this.props.tile.columns || this.savedTileConfig.columns)
    const tableFilters = isReset ? [] : (queryChanged ? undefined : this.props.tile.tableFilters || this.savedTileConfig.tableFilters)

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
    } else if (isReset) {
      // tableFilters already set to [] above; set the remaining reset fields here.
      paramsToSet.orders = []
      paramsToSet.columnSelects = []
      paramsToSet.displayOverrides = []
      paramsToSet.filters = []
      paramsToSet.dataConfig = undefined
    }

    this.debouncedSetParamsForTile(paramsToSet)

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      pageSize,
      isSecondHalf: false,
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

  processTileBottom = ({ query, userSelection, skipQueryValidation, source, isCachedRefresh, isReset = false }) => {
    this.setState({
      isBottomExecuting: true,
      isSecondQueryInputOpen: false,
      secondQueryResponse: null,
    })

    const queryChanged = this.props.tile.secondQuery !== query
    const skipValidation = skipQueryValidation || (this.props.tile.secondskipQueryValidation && !queryChanged)

    const queryValidationSelections =
      userSelection || (queryChanged ? undefined : this.props.tile?.secondQueryValidationSelections)

    // Use saved config as fallback if props haven't been updated yet (e.g., after error restoration)
    const secondDataConfig = queryChanged
      ? undefined
      : this.props.tile.secondDataConfig || this.savedTileConfig.secondDataConfig
    const secondColumns = queryChanged ? undefined : this.props.tile.secondColumns || this.savedTileConfig.secondColumns
    const secondTableFilters = isReset ? []
      : (queryChanged
      ? undefined
      : this.props.tile.secondTableFilters || this.savedTileConfig.secondTableFilters)

    // New query is running, reset temporary state fields
    const paramsToSet = {
      secondQuery: query,
      secondDataConfig,
      secondskipQueryValidation: skipValidation,
      secondColumns: isReset ? [] : secondColumns,
      secondCustomColumns: queryChanged ? undefined : this.props.tile.secondCustomColumns,
      secondDefaultSelectedSuggestion: undefined,
      secondQueryValidationSelections: queryValidationSelections,
      secondTableFilters,
    }

    // Reset all tile configs when query changes
    if (queryChanged) {
      paramsToSet.secondColumnSelects = undefined
      paramsToSet.secondFilters = undefined
      paramsToSet.secondOrders = undefined
      paramsToSet.secondDisplayOverrides = undefined
    } else if (isReset) {
      // secondTableFilters already set to [] above; set the remaining reset fields here.
      paramsToSet.secondOrders = []
      paramsToSet.secondColumnSelects = []
      paramsToSet.secondDisplayOverrides = []
      paramsToSet.secondFilters = []
      paramsToSet.secondDataConfig = undefined
    }

    this.debouncedSetParamsForTile(paramsToSet)

    return this.processQuery({
      query,
      userSelection: queryValidationSelections,
      skipQueryValidation: skipQueryValidation,
      source,
      isSecondHalf: true,
      isCachedRefresh,
      isReset,
    })
      .then((response) => this.endBottomQuery({ response, isReset, queryChanged, isCachedRefresh }))
      .catch((response) => {
        if (response?.data?.message === REQUEST_CANCELLED_ERROR) {
          return undefined
        }

        return this.endBottomQuery({ response, isReset, isCachedRefresh })
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

  clearBottomQueryResponse = (newState = {}) => {
    this.setState({
      isBottomExecuted: false,
      isBottomExecuting: false,
      secondUserSelection: undefined,
      ...newState,
    })

    this.debouncedSetParamsForTile({
      secondQueryResponse: undefined,
    })
  }

  processTile = ({
    query,
    secondQuery,
    skipQueryValidation,
    secondskipQueryValidation,
    source,
    isCachedRefresh,
    isReset = false,
  } = {}) => {
    // If tile is already processing, cancel current process
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
    this.secondAxiosSource?.cancel(REQUEST_CANCELLED_ERROR)

    // Create new cancel tokens for each query
    this.axiosSource = axios.CancelToken?.source()
    this.secondAxiosSource = axios.CancelToken.source()

    const q1 = query || this.props.tile.defaultSelectedSuggestion || this.state.query
    const q2 = secondQuery || this.props.tile.secondDefaultSelectedSuggestion || this.state.secondQuery

    const promises = []

    const topFilters = this.props.tile?.tableFilters || []
    const bottomFilters = this.props.tile?.secondTableFilters || []
    const filtersAreDifferent = !_isEqual(topFilters, bottomFilters)

    if (this.getIsSplitView() && q2 && (q1 !== q2 || filtersAreDifferent)) {
      promises[1] = this.processTileBottom({
        query: q2,
        skipQueryValidation: secondskipQueryValidation,
        source,
        isCachedRefresh,
        isReset,
      })
    }

    promises[0] = this.processTileTop({ query: q1, skipQueryValidation, source, isCachedRefresh, isReset })

    return Promise.all(promises)
      .then((queryResponses) => {
        return {
          ...this.props.tile,
          queryResponse: queryResponses?.[0],
          secondQueryResponse: queryResponses?.[1],
          defaultSelectedSuggestion: undefined,
          secondDefaultSelectedSuggestion: undefined,
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
      this.debouncedSetParamsForTile({
        query,
        pageSize: undefined,
        aggConfig: undefined,
        dataConfig: undefined,
        queryValidationSelections: undefined,
      })
    }, 600)
  }

  debounceSecondQueryInputChange = (secondQuery) => {
    if (secondQuery === this.state.secondQuery) {
      return
    }

    this.setState({ secondQuery })

    clearTimeout(this.secondQueryInputTimer)
    this.secondQueryInputTimer = setTimeout(() => {
      this.debouncedSetParamsForTile({
        secondQuery,
        secondPageSize: undefined,
        secondAggConfig: undefined,
        secondDataConfig: undefined,
        secondQueryValidationSelections: undefined,
      })
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

  onSecondQueryTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.processTileBottom({ query: e.target.value })
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

  onSecondSuggestionClick = ({ query, userSelection, isButtonClick, source }) => {
    this.setState({ secondQuery: query })

    if (isButtonClick) {
      this.debouncedSetParamsForTile({
        secondQuery: query,
        secondQueryValidationSelections: userSelection,
      })
      this.processTileBottom({
        query,
        userSelection,
        skipQueryValidation: true,
        source,
      })
    } else {
      this.debouncedSetParamsForTile({ secondQuery: query })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...getAuthentication(this.props.authentication),
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

  onSecondQueryInputChange = (e) => {
    this.setState({ secondQuery: e.target.value })
    this.debouncedSetParamsForTile({ secondSkipQueryValidation: false })
  }

  getIsSplitView = () => this.props.tile?.splitView

  toggleSecondQueryInput = () => {
    this.setState({
      isSecondQueryInputOpen: !this.state.isSecondQueryInputOpen,
    })
  }

  onQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ query: queryText })
    this.debouncedSetParamsForTile({
      query: queryText,
      queryValidationSelections: selections,
    })
  }

  onSecondQueryValidationSelectOption = (queryText, selections) => {
    this.setState({ secondQuery: queryText })
    this.debouncedSetParamsForTile({
      secondQuery: queryText,
      secondqueryValidationSelections: selections,
    })
  }

  onPageSizeChange = (pageSize, newRows = []) => {
    const queryResponse = this.props.tile?.queryResponse?.data?.data?.rows
      ? _cloneDeep(this.props.tile.queryResponse)
      : undefined

    queryResponse.data.data.rows = newRows

    this.debouncedSetParamsForTile({ pageSize, queryResponse })
  }

  onSecondPageSizeChange = (secondPageSize, newRows = []) => {
    let secondQueryResponse = this.props.tile?.secondQueryResponse?.data?.data?.rows
      ? _cloneDeep(this.props.tile.secondQueryResponse)
      : undefined

    const q1 = this.props.tile.defaultSelectedSuggestion || this.state.query
    const q2 = this.props.tile.secondDefaultSelectedSuggestion || this.state.secondQuery
    if (this.getIsSplitView() && q2 && q1 === q2) {
      secondQueryResponse = this.props.tile.queryResponse
    }
    secondQueryResponse.data.data.rows = newRows

    this.debouncedSetParamsForTile({ secondPageSize, secondQueryResponse })
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
  onSecondAxisSortChange = (axisSorts) => this.debouncedSetParamsForTile({ secondAxisSorts: axisSorts })
  onNewQueryId = (queryId) => queryId && this.debouncedSetParamsForTile({ queryId })
  onSecondNewQueryId = (queryId) => queryId && this.debouncedSetParamsForTile({ secondQueryId: queryId })

  // Chart controls (including pivoted/raw data source) should apply immediately so the axis selectors
  // and chart data source update without waiting for the debounce timer.
  onChartControlsChange = (chartControls) => {
    this.props.setParamsForTile({ chartControls }, this.props.tile.i, [])
  }

  onTableParamsChange = (params, formattedParams) => {
    if (!this.props.isEditing) return
    this.debouncedSetParamsForTile({
      tableFilters: formattedParams.filters,
      orders: formattedParams.sorters,
    })
  }

  onSecondTableParamsChange = (params, formattedParams) => {
    if (!this.props.isEditing) return
    this.debouncedSetParamsForTile({
      secondTableFilters: formattedParams.filters,
      secondOrders: formattedParams.sorters,
    })
  }

  onColumnChange = (displayOverrides, columns, columnSelects, queryResponse, dataConfig, filters) => {
    if (!this.props.isEditing) return
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

  onSecondAggConfigChange = (secondAggConfig) => this.debouncedSetParamsForTile({ secondAggConfig })
  onSecondDataConfigChange = (secondDataConfig) => {
    this.props.setParamsForTile({ secondDataConfig }, this.props.tile.i, [])
  }
  onSecondDisplayTypeChange = (secondDisplayType) => this.debouncedSetParamsForTile({ secondDisplayType })
  onSecondBucketSizeChange = (secondBucketSize) => this.debouncedSetParamsForTile({ secondBucketSize })
  onSecondCustomColumnUpdate = (secondCustomColumns) => this.debouncedSetParamsForTile({ secondCustomColumns })

  onSecondChartControlsChange = (secondChartControls) => this.debouncedSetParamsForTile({ secondChartControls })

  onSecondColumnChange = (
    secondDisplayOverrides,
    secondColumns,
    secondColumnSelects,
    secondQueryResponse,
    secondDataConfig,
    secondTableFilters,
    secondOrders,
    secondFilters,
  ) => {
    if (!this.props.isEditing) return
    const paramsToSet = {
      secondDisplayOverrides,
      secondColumnSelects,
      secondQueryResponse,
      secondQueryId: secondQueryResponse?.data?.data?.query_id,
      secondDataConfig,
      secondFilters,
    }

    if (secondTableFilters && secondTableFilters.length > 0) {
      paramsToSet.secondTableFilters = secondTableFilters
    }

    if (secondOrders && secondOrders.length > 0) {
      paramsToSet.secondOrders = secondOrders
    }

    this.debouncedSetParamsForTile(paramsToSet)
  }

  reportProblemCallback = () => {
    if (this.optionsToolbarRef?._isMounted) {
      this.optionsToolbarRef?.openReportProblemModal()
    }
  }

  secondReportProblemCallback = () => {
    if (this.secondOptionsToolbarRef?._isMounted) {
      this.secondOptionsToolbarRef.openReportProblemModal()
    }
  }

  onSplitViewClick = () => {
    const splitView = !this.props.tile?.splitView
    let secondQuery = this.props.tile?.secondQuery

    if (splitView && !secondQuery) {
      secondQuery = this.state.query
    }

    this.debouncedSetParamsForTile({ splitView, secondQuery })
  }

  renderSplitResponse = () => {
    const topContent = this.renderTopResponse()
    const bottomContent = this.renderBottomResponse()

    return (
      <SplitterLayout
        key={`dashboard-tile-splitter-layout-${this.COMPONENT_KEY}`}
        vertical={true}
        percentage={true}
        primaryMinSize={30}
        secondaryMinSize={30}
        secondaryInitialSize={this.props.secondDisplayPercentage || 50}
        onDragStart={() => {
          this.setState({ isDraggingSplitter: true })
        }}
        onDragEnd={() => {
          this.dragEndTimeout = setTimeout(() => {
            const percentString = this.tileInnerDiv?.style?.height ?? ''
            const percentNumber = Number(percentString.substring(0, percentString.length - 1))

            if (!isNaN(percentNumber)) {
              this.debouncedSetParamsForTile({
                secondDisplayPercentage: percentNumber,
              })
              this.setState({ currentSplitPercent: percentNumber })
            }

            this.setState({ isDraggingSplitter: false })
          }, 1000)
        }}
      >
        <div className='dashboard-tile-split-pane-container'>{topContent}</div>
        <div className='dashboard-tile-split-pane-container'>
          {bottomContent}
          {this.props.isEditing && (
            <div
              className={`split-view-query-btn-container react-autoql-toolbar ${
                this.state.isSecondQueryInputOpen ? 'open' : ''
              }`}
            >
              <div
                className='react-autoql-toolbar viz-toolbar split-view-btn split-view-query-btn react-autoql-toolbar-btn'
                data-test='split-view-query-btn'
                style={{ position: 'relative' }}
              >
                <div className='query-input-icon-wrapper'>
                  <Button
                    onClick={() => this.toggleSecondQueryInput()}
                    className='react-autoql-toolbar-btn'
                    tooltip='Query'
                    tooltipID={this.props.tooltipID}
                  >
                    <div className='split-view-query-btn-icon-container'>
                      <Icon type='react-autoql-bubbles-outlined' />
                      <Icon type={this.state.isSecondQueryInputOpen ? 'caret-left' : 'caret-right'} />
                    </div>
                  </Button>
                  {(() => {
                    const secondResponse = this.areTopAndBottomSameQuery()
                      ? this.props.tile?.queryResponse
                      : this.props.tile?.secondQueryResponse
                    return secondResponse &&
                      (secondResponse?.data?.data?.parsed_interpretation ||
                        secondResponse?.data?.data?.interpretation) ? (
                      <Popover
                        isOpen={this.state.isSecondRTHovered}
                        positions={['top', 'bottom']}
                        align='start'
                        padding={8}
                        onClickOutside={() => this.setState({ isSecondRTHovered: false })}
                        content={this.renderRTPopoverContent(secondResponse)}
                      >
                        <div
                          className='query-input-interpretation-badge'
                          onMouseEnter={() => this.setState({ isSecondRTHovered: true })}
                          onMouseLeave={() => this.setState({ isSecondRTHovered: false })}
                        >
                          <Icon type='thinking-bubble' />
                        </div>
                      </Popover>
                    ) : null
                  })()}
                </div>
                <input
                  className={'dashboard-tile-input query second'}
                  value={this.state.secondQuery}
                  spellCheck={false}
                  onChange={this.onSecondQueryInputChange}
                  onKeyDown={this.onSecondQueryTextKeyDown}
                  placeholder={this.props.tile.query || 'Type a query'}
                />
              </div>
            </div>
          )}
        </div>
      </SplitterLayout>
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
                    authentication={this.props.authentication}
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
          </div>
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

  renderSplitViewBtn = () => {
    return (
      <div className='viz-toolbar react-autoql-toolbar split-view-btn' data-test='split-view-btn'>
        <Button
          onClick={this.onSplitViewClick}
          className={`react-autoql-toolbar-btn ${this.getIsSplitView() ? 'active' : ''}`}
          tooltip={this.props.tile.splitView ? 'Split View On' : 'Split View Off'}
          tooltipID={this.props.tooltipID}
          data-test='viz-toolbar-button'
        >
          <Icon type='split-view' />
        </Button>
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

  onDrilldownStart = (activeKey) =>
    this.props.onDrilldownStart({
      tileId: this.props.tile.i,
      isSecondHalf: false,
      activeKey,
      queryOutputRef: this.state.responseRef,
    })

  renderToolbars = ({ queryOutputProps, vizToolbarProps, optionsToolbarProps, isSecondHalf }) => {
    return (
      <div className='dashboard-tile-toolbars-container'>
        <div className='dashboard-tile-toolbars-left-container'>
          {this.props.isEditing && (isSecondHalf || !this.getIsSplitView()) && this.renderSplitViewBtn()}
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
          <OptionsToolbar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
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
            isEditing={this.props.isEditing}
            source={this.props.dashboardId ? `dashboards.${this.props.dashboardId}` : 'dashboards.user'}
            scope={this.props.scope}
            {...optionsToolbarProps}
          />
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
        authentication={this.props.authentication}
        autoQLConfig={this.props.autoQLConfig}
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
    isSecondHalf,
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
          isSecondHalf,
        })}
        {this.renderToolbars({
          queryOutputProps,
          vizToolbarProps,
          optionsToolbarProps,
          isSecondHalf,
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
        disableAggregationMenu: this.props.disableAggregationMenu,
        allowCustomColumnsOnDrilldown: this.props.allowCustomColumnsOnDrilldown,
        initialFormattedTableParams: {
          filters: this.props.tile?.tableFilters,
          sorters: this.props.tile?.orders,
          sessionFilters: this.props.tile?.filters || [],
        },
        enableChartControls: true,
        initialChartControls: this.props.tile?.chartControls || {
          showAverageLine: false,
          showRegressionLine: false,
        },
        onChartControlsChange: this.onChartControlsChange,
        isDashboardEditing: this.props.isEditing,
        skipInitialFilters: true,
        onNewQueryId: this.onNewQueryId,
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
        onRefreshClick: () => this.props.executeSingleTile(this.props.tile.i),
        onResetClick: () => this.props.resetTile?.(this.props.tile.i),
        showRefreshInEdit: this.props.isEditing && this.props.tile?.displayType !== 'single-value',
        showResetQueryOption: this.props.showResetQueryOption && !!this.props.tile?.query && !!this.props.tile?.queryResponse,
      },
    })
  }

  areTopAndBottomSameQuery = () => {
    const topQuery = this.props?.tile?.query
    const bottomQuery = this.props?.tile?.secondQuery
    const isQuerySame = !bottomQuery || topQuery === bottomQuery
    if (!isQuerySame) return false
    const topFilters = this.props.tile?.tableFilters || []
    const bottomFilters = this.props.tile?.secondTableFilters || []
    return _isEqual(topFilters, bottomFilters)
  }

  renderBottomResponse = () => {
    // Text-only: filter differences are handled by processTile running processTileBottom separately.
    const bottomQuery = this.props.tile?.secondQuery
    const isQuerySameAsTop = !bottomQuery || this.props.tile?.query === bottomQuery
    let isExecuting = this.state.isBottomExecuting
    let isExecuted = this.state.isBottomExecuted
    let queryRequestData = this.bottomRequestData

    if (isQuerySameAsTop) {
      isExecuting = this.state.isTopExecuting
      isExecuted = this.state.isTopExecuted
      queryRequestData = this.topRequestData
    }

    const renderPlaceholder =
      (!isQuerySameAsTop && !this.props.tile?.secondQueryResponse) ||
      (isQuerySameAsTop && !this.props.tile?.queryResponse) ||
      isExecuting ||
      !isExecuted

    const initialDisplayType = this.props?.tile?.secondDisplayType

    return this.renderResponse({
      renderPlaceholder,
      isExecuting,
      isExecuted,
      queryOutputProps: {
        key: `dashboard-tile-query-bottom-${this.SECOND_QUERY_RESPONSE_KEY}`,
        ref: (ref) =>
          ref && ref !== this.state.secondResponseRef && this._isMounted && this.setState({ secondResponseRef: ref }),
        optionsToolbarRef: this.secondOptionsToolbarRef,
        vizToolbarRef: this.secondVizToolbarRef,
        initialDisplayType,
        queryResponse: this.props.tile?.secondQueryResponse || this.props.tile?.queryResponse,
        initialTableConfigs: (() => {
          const dataConfig = this.props.tile?.secondDataConfig || {}
          // Extract columnOverrides from tile.secondColumns if it exists (for date precision persistence)
          // Compare tile.secondColumns with queryResponse columns to find overrides
          // Use columnOverrides from dataConfig if it exists (preferred method)
          let columnOverrides = dataConfig?.columnOverrides || {}

          // Fallback: Extract columnOverrides from tile.secondColumns if dataConfig doesn't have it
          // This handles backwards compatibility with dashboards saved before columnOverrides was added
          const queryResponse = this.props.tile?.secondQueryResponse || this.props.tile?.queryResponse
          if (!dataConfig?.columnOverrides && this.props.tile?.secondColumns && queryResponse?.data?.data?.columns) {
            const savedColumns = this.props.tile.secondColumns
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
          return {
            ...dataConfig,
            columnOverrides,
          }
        })(),
        initialAggConfig: this.props.tile.secondAggConfig,
        onTableConfigChange: this.onSecondDataConfigChange,
        onTableParamsChange: this.onSecondTableParamsChange,
        onAggConfigChange: this.onSecondAggConfigChange,
        queryValidationSelections: this.props.tile.secondQueryValidationSelections,
        onSuggestionClick: this.onSecondSuggestionClick,
        defaultSelectedSuggestion: this.props.tile?.secondDefaultSelectedSuggestion,
        reportProblemCallback: this.secondReportProblemCallback,
        onNoneOfTheseClick: this.secondOnNoneOfTheseClick,
        onDrilldownStart: (activeKey) => {
          this.props.onDrilldownStart({
            tileId: this.props.tile.i,
            isSecondHalf: true,
            activeKey,
            queryOutputRef: this.state.secondResponseRef,
          })
        },
        onDrilldownEnd: this.props.onDrilldownEnd,
        onQueryValidationSelectOption: this.onSecondQueryValidationSelectOption,
        queryRequestData,
        onDisplayTypeChange: this.onSecondDisplayTypeChange,
        dataPageSize: this.props.tile.secondPageSize,
        onPageSizeChange: this.onSecondPageSizeChange,
        onBucketSizeChange: this.onSecondBucketSizeChange,
        onColumnChange: this.onSecondColumnChange,
        bucketSize: this.props.tile.secondBucketSize,
        initialNetworkColumnConfig: this.props.tile.secondNetworkColumnConfig,
        initialAxisSorts: this.normalizeAxisSorts(this.props.tile?.secondAxisSorts),
        onAxisSortChange: this.onSecondAxisSortChange,
        disableAggregationMenu: this.props.disableAggregationMenu,
        allowCustomColumnsOnDrilldown: this.props.allowCustomColumnsOnDrilldown,
        initialFormattedTableParams: {
          filters: this.props.tile?.secondTableFilters,
          sorters: this.props.tile?.secondOrders,
          sessionFilters: this.props.tile?.secondFilters || [],
        },
        isDashboardEditing: this.props.isEditing,
        skipInitialFilters: true,
        enableChartControls: true,
        initialChartControls: this.props.tile?.secondChartControls || {
          showAverageLine: false,
          showRegressionLine: false,
        },
        onChartControlsChange: this.onSecondChartControlsChange,
        onNewQueryId: this.onSecondNewQueryId,
      },
      vizToolbarProps: {
        ref: (r) => (this.secondVizToolbarRef = r),
        responseRef: this.state.secondResponseRef,
        key: `dashboard-tile-viz-toolbar-${this.SECOND_QUERY_RESPONSE_KEY}${this.props.isEditing ? '-editing' : ''}`,
      },
      optionsToolbarProps: {
        ref: (r) => (this.secondOptionsToolbarRef = r),
        responseRef: this.state.secondResponseRef,
        key: `dashboard-tile-options-toolbar-${this.SECOND_QUERY_RESPONSE_KEY}${
          this.props.isEditing ? '-editing' : ''
        }`,
        onRefreshClick: () => this.props.executeSingleTile(this.props.tile.i),
      },
      isSecondHalf: true,
    })
  }

  renderContent = () => {
    return (
      <div
        className={`dashboard-tile-response-wrapper
      ${this.props.isEditing ? ' editing' : ''}
      ${this.props.tile.h < 4 ? ' small' : ''}`}
      >
        <div className='dashboard-tile-response-container'>
          {this.getIsSplitView() ? this.renderSplitResponse() : this.renderTopResponse()}
        </div>
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
          className={`${this.props.className}${this.props.isDirty ? ' dirty' : ''}`}
          style={{ ...this.props.style }}
          data-grid={this.props.tile}
          data-test='react-autoql-dashboard-tile'
        >
          {this.props.children}
          <div
            id={`react-autoql-dashboard-tile-inner-div-${this.COMPONENT_KEY}`}
            ref={(r) => (this.tileInnerDiv = r)}
            className={`react-autoql-dashboard-tile-inner-div
              ${this.getIsSplitView() ? 'split' : ''}`}
            style={style}
          >
            <>
              {this.renderHeader()}
              {this.renderContent()}
            </>
          </div>
          {this.props.isDirty && (
            <div
              className='react-autoql-dashboard-tile-dirty-badge'
              data-tooltip-content='Re-execute this query before saving the dashboard'
              data-tooltip-id={this.props.tooltipID}
            >
              !
            </div>
          )}
          {this.props.isEditing && this.renderDragHandles()}
          {this.props.isEditing && this.renderDeleteBtn()}
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
