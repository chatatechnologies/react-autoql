import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { mean, sum } from 'd3-array'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import dayjs from '../../js/dayjsWithPlugins'

import {
  deepEqual,
  formatTableParams,
  getFilterPrecision,
  currentEventLoopEnd,
  REQUEST_CANCELLED_ERROR,
  DAYJS_PRECISION_FORMATS,
  isDataLimited,
  formatElement,
  MAX_CHART_ELEMENTS,
  getDataFormatting,
  COLUMN_TYPES,
  ColumnTypes,
  MAX_DATA_PAGE_SIZE,
  getDayJSObj,
  setColumnVisibility,
  sortDataByColumn,
  filterDataByColumn,
  getAuthentication,
  getAutoQLConfig,
  runQueryOnly,
  TranslationTypes,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import ReactDOMServer from 'react-dom/server'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { Popover } from '../Popover'
import { Tooltip } from '../Tooltip'
import TableWrapper from './TableWrapper'
import { DateRangePicker } from '../DateRangePicker'
import { DataLimitWarning } from '../DataLimitWarning'
import { columnOptionsList } from './tabulatorConstants'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { DATASET_TOO_LARGE, TABULATOR_LOCAL_ROW_LIMIT, LOCAL_OR_REMOTE } from '../../js/Constants'
import CustomColumnModal from '../AddColumnBtn/CustomColumnModal'
import PivotAxisSelector, { computePivotAxisSelectorLocation } from './PivotAxisSelector'

import './ChataTable.scss'
import 'tabulator-tables/dist/css/tabulator.min.css' //import Tabulator stylesheet

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()

    this.hasSetInitialData = false
    this.isSettingInitialData = false
    this.isFiltering = false
    this.filterCount = 0
    this.isSorting = false
    this.filteredResponseData = null
    this.pageSize = props.pageSize ?? 50
    // WeakMap to keep pivot header capture handlers without polluting DOM
    this.pivotHeaderHandlers = new WeakMap()
    this.pivotHeaderElements = new Set()

    // Pre-rendered hamburger icon markup for header injection
    this.PIVOT_HAMBURGER_ICON = ReactDOMServer.renderToStaticMarkup(<Icon type='menu' />)
    this.useRemote =
      this.props.response?.data?.data?.count_rows > TABULATOR_LOCAL_ROW_LIMIT
        ? LOCAL_OR_REMOTE.REMOTE
        : this.props.response?.data?.data?.fe_req?.filters?.length > 0 || props.initialTableParams?.filter?.length > 0
        ? LOCAL_OR_REMOTE.REMOTE
        : LOCAL_OR_REMOTE.LOCAL
    this.isLocal = this.useRemote === LOCAL_OR_REMOTE.LOCAL
    this.totalPages = this.getTotalPages(props.response)
    if (isNaN(this.totalPages) || !this.totalPages) {
      this.totalPages = 1
    }
    this.useInfiniteScroll = props.useInfiniteScroll !== false && !this.isLocal

    this.originalQueryData = _cloneDeep(props.response?.data?.data?.rows)
    if (props.pivot) {
      this.originalQueryData = _cloneDeep(props.data)
    }

    this.tableParams = {
      filter: props?.initialTableParams?.filter || [],
      sort: props?.initialTableParams?.sort || [],
      page: 1,
    }

    // pivot table headers reflect the correct sort direction
    let initialSort = undefined
    if (props.pivot && props.initialTableParams?.sort?.length) {
      initialSort = props.initialTableParams.sort.map((sorter) => ({
        field: sorter.field,
        dir: sorter.dir,
      }))
    }

    this.tableOptions = {
      selectableRowsCheck: () => false,
      movableColumns: true,
      initialSort,
      initialFilter: undefined, // Let getRows do initial sorting and filtering
      progressiveLoadScrollMargin: 50, // Trigger next ajax load when scroll bar is 800px or less from the bottom of the table.
      // renderHorizontal: 'virtual', // v4: virtualDomHoz = false
      movableColumns: true,
      downloadEncoder: function (fileContents, mimeType) {
        //fileContents - the unencoded contents of the file
        //mimeType - the suggested mime type for the output

        //custom action to send blob to server could be included here

        return new Blob([fileContents], { type: mimeType }) //must return a blob to proceed with the download, return false to abort download
      },
      ...this.props.tableOptions,
    }

    this.tableOptions.sortMode = LOCAL_OR_REMOTE.REMOTE
    this.tableOptions.filterMode = LOCAL_OR_REMOTE.REMOTE
    this.tableOptions.pagination = false
    this.tableOptions.paginationMode = LOCAL_OR_REMOTE.REMOTE
    this.tableOptions.paginationSize = this.pageSize
    this.tableOptions.paginationInitialPage = 1
    this.tableOptions.progressiveLoad = 'scroll' // v4: ajaxProgressiveLoad
    this.tableOptions.ajaxURL = 'https://required-placeholder-url.com'
    this.tableOptions.ajaxRequesting = (url, params) => this.ajaxRequesting(props, params)
    this.tableOptions.ajaxRequestFunc = (url, config, params) => this.ajaxRequestFunc(props, params)
    this.tableOptions.ajaxResponse = (url, params, response) => this.ajaxResponseFunc(props, response)
    this.summaryStats = {}

    this.state = {
      isFiltering: false,
      isSorting: false,
      loading: false,
      pageLoading: false,
      scrollLoading: false,
      isLastPage: this.tableParams.page === this.totalPages,
      subscribedData: undefined,
      firstRender: true,
      scrollTop: 0,
      pivotAxisSelectorOpen: false,
      pivotAxisSelectorLocation: null,
      isCustomColumnPopoverOpen: false,
      activeCustomColumn: undefined,
      contextMenuColumn: undefined,
      contextMenuLocation: null,
    }
  }

  // Pivot tables: remove ajax/progressive/pagination options so Tabulator treats them as static tables.
  getTableWrapperOptions = () => {
    // Return a deep-cloned tableOptions so TableWrapper handles pivot cleanup without breaking remote sorting/filtering
    return _cloneDeep(this.tableOptions || {})
  }

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.array),
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    queryRequestData: PropTypes.shape({}),
    onTableParamsChange: PropTypes.func,
    isResizing: PropTypes.bool,
    useInfiniteScroll: PropTypes.bool,
    autoHeight: PropTypes.bool,
    rowChangeCount: PropTypes.number,
    isAnimating: PropTypes.bool,
    onCellClick: PropTypes.func,
    onErrorCallback: PropTypes.func,
    hidden: PropTypes.bool,
    onNewData: PropTypes.func,
    tooltipID: PropTypes.string,
    pivot: PropTypes.bool,
    pivotTableDataLimited: PropTypes.bool,
    style: PropTypes.shape({}),
    supportsDrilldowns: PropTypes.bool,
    response: PropTypes.any,
    tableOptions: PropTypes.shape({}),
    updateColumns: PropTypes.func,
    keepScrolledRight: PropTypes.bool,
    allowCustomColumns: PropTypes.bool,
    onCustomColumnChange: PropTypes.func,
    enableContextMenu: PropTypes.bool,
    initialTableParams: PropTypes.shape({ filter: PropTypes.array, sort: PropTypes.array, page: PropTypes.number }),
    updateColumnsAndData: PropTypes.func,
    onUpdateFilterResponse: PropTypes.func,
    isDrilldown: PropTypes.bool,
    scope: PropTypes.string,
    // Pivot axis selector props
    pivotAxisOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number, label: PropTypes.string })),
    pivotAxisCurrentIndex: PropTypes.number,
    onPivotAxisChange: PropTypes.func,
    originalColumns: PropTypes.arrayOf(PropTypes.shape({})),
    // Pivot table sizing info
    maxColumns: PropTypes.number,
  }

  static defaultProps = {
    queryRequestData: {},
    data: undefined,
    columns: undefined,
    isResizing: false,
    useInfiniteScroll: undefined,
    autoHeight: true,
    rowChangeCount: 0,
    isAnimating: false,
    hidden: false,
    response: undefined,
    tooltipID: undefined,
    pivot: false,
    pivotTableDataLimited: false,
    tableOptions: {},
    keepScrolledRight: false,
    allowCustomColumns: true,
    enableContextMenu: true,
    onTableParamsChange: () => {},
    onCellClick: () => {},
    onErrorCallback: () => {},
    onNewData: () => {},
    updateColumns: () => {},
    onCustomColumnChange: () => {},
    updateColumnsAndData: () => {},
    onUpdateFilterResponse: () => {},
    isDrilldown: false,
    scope: undefined,
    // Pivot axis selector defaults
    pivotAxisOptions: [],
    pivotAxisCurrentIndex: undefined,
    onPivotAxisChange: () => {},
    originalColumns: [],
    // Pivot table sizing info
    maxColumns: 100,
  }

  componentDidMount = () => {
    this._isMounted = true
    this._setFiltersTime = Date.now() // Track when component mounted to avoid duplicate requests
    if (!this.props.autoHeight) {
      this.initialTableHeight = this.tabulatorContainer?.clientHeight
      this.lockedTableHeight = this.initialTableHeight
    }

    this.summaryStats = this.calculateSummaryStats(this.props)

    this.setState({
      firstRender: false,
    })
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const tabulatorJustMounted = !this.state.tabulatorMounted && nextState.tabulatorMounted
    const dataChanged = this.props.response?.data?.data?.query_id !== nextProps.response?.data?.data?.query_id
    const animationEnded = this.props.isAnimating && !nextProps.isAnimating
    const datePickerClosed = !!this.state.datePickerColumn && !nextState.datePickerColumn
    const hiddenStateChanged = this.props.hidden !== nextProps.hidden
    const isVisibleAndColumnsChanged = !this.props.hidden && !deepEqual(this.props.columns, nextProps.columns)

    if (
      tabulatorJustMounted ||
      dataChanged ||
      animationEnded ||
      datePickerClosed ||
      hiddenStateChanged ||
      isVisibleAndColumnsChanged
    ) {
      return true
    }

    if (
      (this.props.hidden && nextProps.hidden) ||
      (this.state.scrollLoading && nextState.scrollLoading) ||
      (this.state.pageLoading && nextState.pageLoading) ||
      (this.props.isResizing && nextProps.isResizing) ||
      (this.props.isAnimating && nextProps.isAnimating)
    ) {
      return false
    }

    const propsOrStateNotEqual = !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
    return propsOrStateNotEqual
  }

  getSnapshotBeforeUpdate = (prevProps, prevState) => {
    let newTableHeight
    let shouldSetTableHeight
    if (
      (!this.props.isResizing && prevProps.isResizing) ||
      (!this.props.isAnimating && prevProps.isAnimating) ||
      (!this.state.firstRender && prevState.firstRender) ||
      (!this.props.hidden && prevProps.hidden && !this.hasSetTableHeight)
    ) {
      shouldSetTableHeight = true
    }

    if (this.props.isResizing && !prevProps.isResizing) {
      shouldSetTableHeight = true
      newTableHeight = '100%'
    }

    return { shouldSetTableHeight, newTableHeight }
  }

  componentDidUpdate = (prevProps, prevState, { shouldSetTableHeight, newTableHeight }) => {
    if (shouldSetTableHeight) {
      this.setTableHeight(newTableHeight)
    }

    if (this.props.response?.data?.data?.query_id !== prevProps.response?.data?.data?.query_id) {
      this.filteredResponseData = null
    }

    // Update originalQueryData when pivot table data changes (e.g., after switching pivot axis column)
    // This ensures sorting uses the correct current pivot data as the source
    if (this.props.pivot && !deepEqual(this.props.data, prevProps.data)) {
      this.originalQueryData = _cloneDeep(this.props.data)
    }

    if (!this.props.hidden && prevProps.hidden) {
      if (this.state.subscribedData) {
        this.updateData(this.state.subscribedData)
        this.setState({ subscribedData: undefined })
      } else {
        // Restore Tabulator redraw after hidden->visible transition so the table can reflow and update columns/headers.
        this.ref?.restoreRedraw()
      }
    }

    if (this.props.columns && this.state.tabulatorMounted && !deepEqual(this.props.columns, prevProps.columns)) {
      this.ref?.tabulator?.setColumns(this.getFilteredTabulatorColumnDefinitions())
      this.updateData(this.getRows(this.props, 1)).then(() => {
        if (this.props.keepScrolledRight) {
          this.scrollToRight()
        }
        this.setFilterBadgeClasses()
      })
      this.setHeaderInputEventListeners()
      this.setFilters()
      this.setSorters()
      this.clearLoadingIndicators()
    }

    if (this.tabulatorMounted && !prevState.tabulatorJustMounted) {
      this.setFilterBadgeClasses()
    }

    if (this.state.tabulatorMounted && !prevState.tabulatorMounted) {
      this.tableParams.filter = this.props?.initialTableParams?.filter
      this.setFilters(this.props?.initialTableParams?.filter)
      this.setHeaderInputEventListeners()
      if (!this.props.hidden) {
        this.setTableHeight()
      }
      // Refresh filter badges after initial filters are set
      this.setFilterBadgeClasses()
    }
    this.summaryStats = this.calculateSummaryStats(this.props)
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      clearTimeout(this.clickListenerTimeout)
      clearTimeout(this.setDimensionsTimeout)
      clearTimeout(this.setStateTimeout)
      clearTimeout(this._debounceTimeout)

      // Clear any pending filter check timeouts to prevent state updates after unmount
      if (this._filterCheckTimeout) {
        clearTimeout(this._filterCheckTimeout)
        this._filterCheckTimeout = null
      }

      this.cancelCurrentRequest()
      // Remove any pivot header handlers we attached
      if (this.pivotHeaderElements) {
        this.pivotHeaderElements.forEach((el) => {
          const handler = this.pivotHeaderHandlers.get(el)
          if (handler && el.removeEventListener) {
            el.removeEventListener('click', handler, true)
          }
        })
        this.pivotHeaderElements.clear()
      }
    } catch (error) {
      console.error(error)
    }
  }

  resetCustomColumnModal = () => {
    this.setState({ isCustomColumnPopoverOpen: false, activeCustomColumn: undefined })
  }

  calculateSummaryStats = (props) => {
    const stats = {}

    try {
      const rows = this.getAllRows(props)

      if (!(rows?.length > 1)) {
        return {}
      }

      props.columns?.forEach((column, columnIndex) => {
        // If column has a mutator function, stats cannot be calculated based on the cell values
        if (column.mutator) {
          return
        }

        if (column?.type === ColumnTypes.QUANTITY || column?.type === ColumnTypes.DOLLAR_AMT) {
          const columnData = rows.map((r) => r[columnIndex]).filter((val) => Number.isFinite(val))
          stats[columnIndex] = {
            avg: formatElement({ element: mean(columnData), column, config: props.dataFormatting }),
            sum: formatElement({ element: sum(columnData), column, config: props.dataFormatting }),
          }
        } else if (column?.type === ColumnTypes.DATE) {
          const dates = rows.map((r) => r[columnIndex]).filter((date) => !!date)
          const columnData = dates.map((date) => getDayJSObj({ value: date, column }))?.filter((r) => r?.isValid?.())

          const min = dayjs.min(columnData)
          const max = dayjs.max(columnData)

          if (min && min?.length > 0 && max && max?.length > 0) {
            stats[columnIndex] = {
              min: formatElement({
                element: min?.toISOString(),
                column,
                config: props.dataFormatting,
              }),
              max: formatElement({
                element: max?.toISOString(),
                column,
                config: props.dataFormatting,
              }),
            }
          }
        }
      })
    } catch (error) {
      console.error(error)
    }

    return stats
  }

  isValidTableParams = (params) => {
    if (!params || typeof params !== 'object') return false
    if (Array.isArray(params.filters) && params.filters.some((f) => !f || typeof f !== 'object')) return false
    if (Array.isArray(params.sorters) && params.sorters.some((s) => !s || typeof s !== 'object')) return false
    return true
  }

  getTotalPages = (response) => {
    // For pivot tables, use props.data instead of response.data.data.rows
    // because response contains the original query data, not the pivot table data
    if (this.props.pivot) {
      const pivotRows = this.props.data || []
      if (!pivotRows.length) {
        return 1
      }
      return Math.ceil(pivotRows.length / this.pageSize)
    }
    const rows = response?.data?.data?.rows
    if (!rows?.length) {
      return 1
    }

    const totalPages = Math.ceil(rows.length / this.pageSize)

    if (totalPages >= 1 && totalPages !== Infinity) {
      return totalPages
    }

    return 1
  }

  setInfiniteScroll = () => {
    if (!this.ref?.tabulator?.options) {
      return
    }

    this.ref.tabulator.options.sortMode = LOCAL_OR_REMOTE.REMOTE
    this.ref.tabulator.options.filterMode = LOCAL_OR_REMOTE.REMOTE
    this.ref.tabulator.options.paginationMode = LOCAL_OR_REMOTE.REMOTE
  }

  updateData = (data, useInfiniteScroll) => {
    if (useInfiniteScroll) {
      this.setInfiniteScroll(true)
    }

    return this.ref?.updateData(data)
  }

  getRTForRemoteFilterAndSort = async () => {
    let headerFilters = []
    let headerSorters = []

    if (this._isMounted && this.state.tabulatorMounted) {
      headerFilters = this.ref?.tabulator?.getHeaderFilters()
      headerSorters = this.ref?.tabulator?.getSorters()
    }

    this.tableParams.filter = _cloneDeep(headerFilters)
    this.tableParams.sort = headerSorters

    const tableParamsFormatted = formatTableParams(this.tableParams, this.props.columns)

    if (!this.isValidTableParams(tableParamsFormatted)) {
      console.error('Invalid tableParamsFormatted:', tableParamsFormatted)
      return
    }

    try {
      await runQueryOnly({
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        query: this.props.queryText,
        translation: TranslationTypes.REVERSE_ONLY,
        orders: tableParamsFormatted?.sorters,
        tableFilters: tableParamsFormatted?.filters,
        source: 'data_messenger',
        allowSuggestions: false,
      }).then((response) => {
        this.props.onUpdateFilterResponse(response)
      })
    } catch (error) {
      console.error('error', error)
    }
  }

  onDataSorting = (sorters) => {
    if (this._isMounted) {
      const formattedSorters = sorters.map((sorter) => {
        return {
          dir: sorter.dir,
          field: sorter.field,
        }
      })

      if (this.tableParams?.sort && !_isEqual(formattedSorters, this.tableParams?.sort)) {
        this.isSorting = true
        this.setLoading(true)
      }
    }
  }

  onDataSorted = (sorters, rows) => {
    // persists sort state when the user sorts the table when switching between tabs
    if (Array.isArray(sorters)) {
      this.tableParams.sort = sorters.map((s) => ({ field: s.field, dir: s.dir }))
    }
    if (this.isSorting) {
      this.isSorting = false
      this.setLoading(false)
    }
  }

  onDataFiltering = () => {
    if (this._isMounted && this.state.tabulatorMounted) {
      const headerFilters = this.ref?.tabulator?.getHeaderFilters()

      if (headerFilters && !_isEqual(headerFilters, this.tableParams?.filter)) {
        this.isFiltering = true
        this.setLoading(true)
      }
    }
  }

  onDataFiltered = (filters, rows) => {
    if (this.isFiltering && this.state.tabulatorMounted) {
      this.isFiltering = false
      this.debounceSetState({ loading: false })
    }

    // Debounce getRTForRemoteFilterAndSort to prevent multiple calls after hide/show columns
    if (!this.useInfiniteScroll && !this.props.pivot && this.tableParams?.filter?.length > 0) {
      if (this._debounceTimeout) clearTimeout(this._debounceTimeout)
      this._debounceTimeout = setTimeout(() => {
        if (!this._isMounted) return
        try {
          this.getRTForRemoteFilterAndSort()
        } catch (error) {
          console.error('Error in debounced getRTForRemoteFilterAndSort:', error)
        }
      }, 100)
    }

    this.setFilterBadgeClasses()
  }

  onDataProcessed = (data) => {
    if (this.hasSetInitialData || data?.length || !this.props.response?.data?.data?.rows?.length) {
      this.hasSetInitialData = true
      this.isSettingInitialData = false
      this.clearLoadingIndicators()
    }
  }

  onDataLoadError = (error) => {
    console.error(error)
  }

  setLoading = (loading) => {
    // Don't update state unnecessarily
    if (loading !== this.state.loading && this._isMounted) {
      this.setState({ loading })
    }
  }

  setPageLoading = (loading) => {
    if (this._isMounted) {
      this.setState({ pageLoading: !!loading })
    }
  }

  onTableBuilt = async () => {
    if (this._isMounted) {
      this.setState({
        tabulatorMounted: true,
        pageLoading: false,
      })

      if (this.props.keepScrolledRight) {
        this.scrollToRight()
      }
    }
  }

  setTableHeight = (height) => {
    // The table height and width after initial render should height for the session
    // Doing this avoids the scroll jump when filtering or sorting the data
    // It is also makes tabulator more efficient
    if (
      this.state.tabulatorMounted &&
      this.tabulatorContainer &&
      !this.props.isAnimating &&
      !this.props.isResizing &&
      !this.props.hidden
    ) {
      const tableHeight = height ?? this.tabulatorContainer.clientHeight
      if (tableHeight && tableHeight !== this.lockedTableHeight) {
        this.ref?.tabulator?.setHeight(tableHeight)
        this.lockedTableHeight = tableHeight
        if (height !== '100%') {
          this.hasSetTableHeight = true
        }
      }
    }
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  ajaxRequesting = (props, params) => {
    // Use this fn to abort a request
    const tableParamsFormatted = formatTableParams(this.tableParams, props.columns)
    const nextTableParamsFormatted = formatTableParams(params, props.columns)
    const tableParamsUnchanged = _isEqual(tableParamsFormatted, nextTableParamsFormatted)

    if (this.hasSetInitialData && (this.state.scrollLoading || this.props.hidden || tableParamsUnchanged)) {
      // Return undefined to let the request proceed, but ajaxRequestFunc will handle it
      return
    }
  }

  ajaxRequestFunc = async (props, params) => {
    const initialData = {
      rows: this.getRows(this.props, 1),
      page: 1,
      isInitialData: true,
    }

    let response = initialData

    try {
      // Check if table just mounted - avoid any AJAX requests for recently mounted tables
      const DEBOUNCE_MS = 1000
      const hasRecentlySetHeaderFilters =
        this.state.tabulatorMounted && Date.now() - (this._setFiltersTime || 0) < DEBOUNCE_MS

      if (!this.hasSetInitialData || !this._isMounted || hasRecentlySetHeaderFilters) {
        return initialData
      }

      const nextTableParamsFormatted = formatTableParams(params, this.props.columns)

      this.cancelCurrentRequest()
      this.axiosSource = axios.CancelToken?.source()
      this.tableParams = params

      if (params?.page > 1) {
        if (this._isMounted) {
          this.setState({ scrollLoading: true })
        }
        response = await this.getNewPage(this.props, nextTableParamsFormatted)
      } else {
        if (this._isMounted) {
          this.setState({ pageLoading: true })
        }

        if (!this.isValidTableParams(nextTableParamsFormatted)) {
          console.error('Invalid nextTableParamsFormatted:', nextTableParamsFormatted)
          return response
        }

        const responseWrapper = await this.queryFn({
          tableFilters: nextTableParamsFormatted?.filters,
          orders: nextTableParamsFormatted?.sorters,
          cancelToken: this.axiosSource.token,
        })

        const currentScrollValue = this.ref?.tabulator?.rowManager?.element?.scrollLeft
        if (currentScrollValue > 0) {
          this.scrollLeft = currentScrollValue
        }

        /* wait for current event loop to end so table is updated
        before callbacks are invoked */
        await currentEventLoopEnd()

        this.props.onTableParamsChange?.(params, nextTableParamsFormatted)

        this.props.onNewData(responseWrapper)

        // For pivot tables, use sorted data from responseWrapper if sorting/filtering,
        // otherwise use props.data (unsorted)
        if (this.props.pivot) {
          const hasSorters = nextTableParamsFormatted?.sorters?.length > 0
          const hasFilters = nextTableParamsFormatted?.filters?.length > 0

          // If sorting or filtering, use the sorted/filtered data from queryFn response
          // Otherwise, use the unsorted props.data
          const pivotData = hasSorters || hasFilters ? responseWrapper?.data?.data?.rows || [] : this.props.data || []

          const totalPages = Math.ceil(pivotData.length / this.pageSize) || 1
          this.totalPages = totalPages
          this.filteredResponseData = pivotData
          this.filterCount = pivotData.length

          response = {
            rows: pivotData.slice(0, this.pageSize) ?? [],
            page: 1,
            last_page: totalPages,
          }
        } else {
          const totalPages = this.getTotalPages(responseWrapper)
          this.totalPages = totalPages
          this.filteredResponseData = responseWrapper?.data?.data?.rows ?? []
          this.filterCount = this.filteredResponseData.length

          response = {
            rows: this.filteredResponseData.slice(0, this.pageSize) ?? [],
            page: 1,
            last_page: totalPages,
          }
        }
      }

      return response
    } catch (error) {
      if (error?.data?.message !== REQUEST_CANCELLED_ERROR) {
        console.error(error)
        this.clearLoadingIndicators()
      } else {
        return
      }
    }

    return response
  }

  clientSortAndFilterData = (params) => {
    // Use FE for sorting and filtering
    let response = _cloneDeep(this.props.response)
    // For pivot tables, use the pivot data, not the original query data
    let data = this.props.pivot ? _cloneDeep(this.props.data) : _cloneDeep(this.originalQueryData)

    // Ensure data is always an array
    if (!data) {
      data = []
    }

    // Filters
    if (params.tableFilters?.length) {
      params.tableFilters.forEach((filter) => {
        const filterColumnIndex = this.props.columns.find((col) => col.id === filter.id)?.index

        data = filterDataByColumn(data, this.props.columns, filterColumnIndex, filter.value, filter.operator)
      })
    }

    // Update filterCount for local filtering
    this.filterCount = data?.length || 0

    // Sorters
    if (params.orders?.length) {
      const sortDirection = params.orders[0].sort === 'DESC' ? 'desc' : 'asc'

      if (this.props.pivot) {
        // For pivot tables, use sortDataByColumn with the pivot column index
        const searchId = params?.orders[0]?.id
        const column =
          this.props.columns.find((col) => col.id === searchId) ||
          this.props.columns.find((col) => col.field === searchId)

        if (column?.field !== undefined) {
          const pivotColumnIndex = parseInt(column.field, 10)
          if (!isNaN(pivotColumnIndex)) {
            data = sortDataByColumn(data, this.props.columns, pivotColumnIndex, sortDirection)
          }
        }
      } else {
        const sortColumnIndex = this.props.columns.find((col) => col.id === params?.orders[0]?.id)?.index
        data = sortDataByColumn(data, this.props.columns, sortColumnIndex, sortDirection)
      }
    }

    response.data.data.rows = data
    response.data.data.count_rows = data.length

    return response
  }

  queryFn = (params) => {
    // Always use server-side queryFn when dealing with column changes (newColumns)
    // because column removal is a schema change, not just data filtering
    if ((this.useInfiniteScroll || typeof params.newColumns !== 'undefined') && !this.props.pivot) {
      return this.props.queryFn(params)
    } else if (this.props.pivot) {
      // For pivot tables, check if there are filters
      const hasFilters = params.tableFilters && params.tableFilters.length > 0

      if (hasFilters) {
        // If filtering, don't filter the pivot data directly
        // Return current pivot data and let onTableParamsChange trigger generatePivotData()
        // which will filter the source data and regenerate the pivot table
        return new Promise((resolve) => {
          const response = _cloneDeep(this.props.response)
          response.data.data.rows = _cloneDeep(this.props.data) || []
          response.data.data.count_rows = (this.props.data || []).length
          resolve(response)
        })
      } else {
        // If only sorting (no filters), sort the pivot data directly
        return new Promise((resolve) => {
          const result = this.clientSortAndFilterData(params)
          resolve(result)
        })
      }
    } else {
      return new Promise((resolve) => {
        const result = this.clientSortAndFilterData(params)
        resolve(result)
      })
    }
  }

  getAllRows = (props) => {
    if (props.pivot) {
      return props.data
    }

    return props.response?.data?.data?.rows
  }

  getRows = (props, pageNumber) => {
    const page = pageNumber ?? this.tableParams.page
    const start = (page - 1) * this.pageSize
    const end = start + this.pageSize

    const tableParamsFormatted = formatTableParams(this.tableParams, props.columns)
    const tableParamsForAPI = {
      tableFilters: tableParamsFormatted?.filters,
      orders: tableParamsFormatted?.sorters,
    }

    let newRows
    if (props.pivot) {
      // For pivot tables, check if there are filters
      const hasFilters = tableParamsForAPI.tableFilters && tableParamsForAPI.tableFilters.length > 0

      if (hasFilters) {
        // If filtering, don't filter the pivot data directly
        // Filtering triggers generatePivotData() which regenerates the pivot table from filtered source data
        // Just slice the current pivot data for pagination
        const pivotData = props.data || []
        newRows = pivotData.slice(start, end)
      } else {
        // If only sorting (no filters), sort the pivot data before slicing
        const sortedData = this.clientSortAndFilterData(tableParamsForAPI)?.data?.data?.rows || []
        newRows = sortedData.slice(start, end)
      }
    } else if (!this.useInfiniteScroll) {
      const sortedData = this.clientSortAndFilterData(tableParamsForAPI)?.data?.data?.rows

      newRows = sortedData?.slice(start, end) ?? []
    } else {
      const sourceData = this.filteredResponseData ?? props.response?.data?.data?.rows ?? []
      newRows = sourceData.slice(start, end) ?? []
    }

    return _cloneDeep(newRows)
  }

  clearLoadingIndicators = async () => {
    // After sorting/filtering/data updates, ensure redraw is enabled so
    // scrollbar and layout measurements are correct.
    this.ref?.restoreRedraw()

    // Temporary fix to scrollbars resetting after filtering or sorting
    // It isnt perfect since there are still error cases where it will jump
    // Watching tabulator for a fix:
    // https://github.com/olifolkerd/tabulator/issues/3450
    if (this.scrollLeft !== undefined) {
      this.ref.tabulator.columnManager.element.scrollLeft = this.scrollLeft
      this.ref.tabulator.rowManager.element.scrollLeft = this.scrollLeft
      this.scrollLeft = undefined
    }

    if (this._isMounted) {
      this.setState({
        loading: false,
        scrollLoading: false,
        pageLoading: false,
      })
    }
  }

  // TODO: implement "clear all filters" button in options toolbar
  // clearHeaderFilters = () => {
  //   this.ref?.tabulator?.clearHeaderFilter()
  // }

  scrollToRight = () => {
    if (this.ref?.tabulator) {
      const tableWidth = document.querySelector(
        `#react-autoql-table-container-${this.TABLE_ID} .tabulator-table`,
      )?.clientWidth

      this.ref.tabulator.columnManager.element.scrollLeft = tableWidth
      this.ref.tabulator.rowManager.element.scrollLeft = tableWidth
    }
  }

  getNewPage = (props, tableParams) => {
    try {
      const rows = this.getRows(props, tableParams.page)
      // For pivot tables, calculate last_page based on actual pivot data length
      const lastPage = props.pivot ? Math.ceil((props.data || []).length / this.pageSize) || 1 : this.totalPages
      const response = { page: tableParams.page, rows, last_page: lastPage }
      return Promise.resolve(response)
    } catch (error) {
      console.error(error)
      return Promise.reject(error)
    }
  }

  ajaxResponseFunc = (props, response) => {
    const modResponse = { data: response?.rows ?? [], last_page: response?.last_page ?? this.totalPages }

    if (response) {
      if (this.tableParams?.page > 1) {
        // Only restore redraw for new page - doing this for filter/sort will reset the scroll value
        // (we re-enable redraw here after a paged data replace).
        this.ref?.restoreRedraw()
      }

      const isLastPage = (response?.rows?.length ?? 0) < this.pageSize

      if (isLastPage !== this.state.isLastPage && this._isMounted) {
        this.setState({ isLastPage })
      }
      // Force re-render to update filter count display after data is processed
      // Note: this.filterCount is already set correctly in ajaxRequestFunc from the queryFn response
      if (this._isMounted) {
        setTimeout(() => {
          this.forceUpdate()
        }, 0)
      }
    } else {
      return {}
    }

    return modResponse
  }

  cellClick = (e, cell) => {
    this.props.onCellClick(cell)
  }

  copyToClipboard = () => {
    if (this._isMounted && this.ref?.tabulator) {
      this.ref.tabulator.copyToClipboard('active', true)
    }
  }

  saveAsCSV = (delay) => {
    if (this._isMounted && this.ref?.tabulator) {
      let tableClone = _cloneDeep(this.ref.tabulator)
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          tableClone.download('csv', 'export.csv', {
            delimiter: ',',
          })
          tableClone = undefined
          resolve()
        }, delay)
      })
    } else {
      throw new Error('Unable to save CSV - Table instance not found')
    }
  }

  debounceSetState = (state) => {
    this.stateToSet = {
      ...this.stateToSet,
      ...state,
    }

    clearTimeout(this.setStateTimeout)
    this.setStateTimeout = setTimeout(() => {
      if (this._isMounted) {
        this.setState(this.stateToSet)
        this.stateToSet = {}
      }
    }, 50)
  }

  inputKeydownListener = (event) => {
    // Re-enable redraw after input interactions that mutate header filters
    // so Tabulator can recompute column widths/layout.
    if (!this.useInfiniteScroll) {
      this.ref?.restoreRedraw()
    }
  }

  inputSearchListener = () => {
    // When "x" button is clicked in the input box
    // Ensure redraw is enabled after clearing search so layout stabilizes.
    if (!this.useInfiniteScroll) {
      this.ref?.restoreRedraw()
    }
  }

  inputDateSearchListener = () => {
    this.currentDateRangeSelections = {}
    this.debounceSetState({
      datePickerColumn: undefined,
    })
  }

  inputDateClickListener = (e, col) => {
    const coords = e.target.getBoundingClientRect()
    const tableCoords = this.tableContainer.getBoundingClientRect()
    if (coords?.top && coords?.left) {
      this.debounceSetState({
        datePickerLocation: {
          top: coords.top - tableCoords.top + coords.height + 5,
          left: coords.left - tableCoords.left,
        },
        datePickerColumn: col,
      })
    }
  }

  headerContextMenuClick = (e, col) => {
    e.stopPropagation()
    e.preventDefault()

    const coords = e.target.getBoundingClientRect()
    const tableCoords = this.tableContainer.getBoundingClientRect()
    if (coords?.top && coords?.left) {
      this.debounceSetState({
        contextMenuLocation: {
          top: coords.top - tableCoords.top + coords.height + 5,
          left: coords.left - tableCoords.left,
        },
        contextMenuColumn: col,
      })
    }
  }

  inputDateKeypressListener = (e) => {
    e.stopPropagation()
    e.preventDefault()
  }

  addCustomColumn = () => {
    this.setState({ isCustomColumnPopoverOpen: true })
  }

  renderHeaderInputClearBtn = (inputElement, column) => {
    const clearBtnText = document.createElement('span')
    clearBtnText.innerHTML = '&#x00d7;'

    const clearBtn = document.createElement('div')
    clearBtn.className = 'react-autoql-input-clear-btn'
    clearBtn.id = `react-autoql-clear-btn-${this.TABLE_ID}-${column.field}`
    clearBtn.setAttribute('data-tooltip-id', this.props.tooltipID)
    clearBtn.setAttribute('data-tooltip-content', 'Clear filter')
    clearBtn.appendChild(clearBtnText)

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.setHeaderInputValue(inputElement, '')
      if (column?.type === ColumnTypes.DATE && !column?.pivot) {
        this.currentDateRangeSelections = {}
        this.debounceSetState({
          datePickerColumn: undefined,
        })
      }
    })

    inputElement.parentNode.appendChild(clearBtn)
  }

  setHeaderInputEventListeners = (cols) => {
    const columns = cols ?? this.props.columns
    if (!columns) {
      return
    }

    columns.forEach((col, i) => {
      const inputElement = document.querySelector(
        `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${col.field}"] .tabulator-col-content input`,
      )

      const headerElement = document.querySelector(
        `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${col.field}"]:not(.tabulator-col-group) .tabulator-col-title-holder`,
      )

      if (headerElement) {
        headerElement.setAttribute('data-tooltip-id', `selectable-table-column-header-tooltip-${this.TABLE_ID}`)
        headerElement.setAttribute('data-tooltip-content', JSON.stringify({ ...col, index: i }))

        if (!this.props.pivot) {
          headerElement.addEventListener('contextmenu', (e) => this.headerContextMenuClick(e, col))
        }

        // Attach capture handler to the first pivot header only
        if (this.props.pivot && i === 0) {
          const captureHandler = (ev) => {
            const btn = ev?.target?.closest?.('.pivot-axis-header-btn')
            if (!btn) return
            ev.preventDefault()
            ev.stopImmediatePropagation()
            this.openPivotAxisSelectorForElement(headerElement)
          }

          // Remove any previous handler stored in WeakMap
          const prev = this.pivotHeaderHandlers.get(headerElement)
          if (prev) {
            headerElement.removeEventListener('click', prev, true)
          }

          this.pivotHeaderHandlers.set(headerElement, captureHandler)
          this.pivotHeaderElements.add(headerElement)
          headerElement.addEventListener('click', captureHandler, true)
        }
      }

      if (inputElement) {
        inputElement.removeEventListener('keydown', this.inputKeydownListener)
        inputElement.addEventListener('keydown', this.inputKeydownListener)

        const clearBtn = document.querySelector(`#react-autoql-clear-btn-${this.TABLE_ID}-${col.field}`)
        if (!clearBtn) {
          this.renderHeaderInputClearBtn(inputElement, col)
        }

        if (col.type === ColumnTypes.DATE && !col.pivot) {
          // Open Calendar Picker when user clicks on this field
          inputElement.removeEventListener('click', (e) => this.inputDateClickListener(e, col))
          inputElement.addEventListener('click', (e) => this.inputDateClickListener(e, col))

          // Do not allow user to type in this field
          const keyboardEvents = ['keypress', 'keydown', 'keyup']
          keyboardEvents.forEach((evt) => {
            inputElement.removeEventListener(evt, this.inputDateKeypressListener)
            inputElement.addEventListener(evt, this.inputDateKeypressListener)
          })
        }
      }
    })
  }

  setFilterBadgeClasses = () => {
    if (!this._isMounted || !this.state.tabulatorMounted) return

    try {
      const allColumns = this.ref?.tabulator?.getColumns?.()
      if (!allColumns) return

      const filters = this.tableParams?.filter ?? []
      const filteredFields = new Set(filters.map((f) => f?.field).filter(Boolean))
      const container = document.getElementById(`react-autoql-table-container-${this.TABLE_ID}`)

      if (!filteredFields.size) {
        allColumns.forEach((col) => col?.getElement?.()?.classList.remove('is-filtered'))
        if (this.props.pivot) {
          container?.querySelectorAll('.tabulator-col-group')?.forEach((g) => g.classList.remove('is-filtered'))
        }
        return
      }

      if (this.props.pivot) {
        this.setPivotFilterBadges(allColumns, filters, container)
      } else {
        this.setNonPivotFilterBadges(allColumns, filteredFields)
      }
    } catch (err) {
      console.error('Error in setFilterBadgeClasses:', err)
    }
  }

  setNonPivotFilterBadges = (allColumns, filteredFields) => {
    allColumns.forEach((column) => {
      const field = column.getField?.()
      const def = column.getDefinition?.() || {}
      const origField = def.origColumn?.field
      const isFiltered = filteredFields.has(field) || filteredFields.has(def.name) || filteredFields.has(origField)

      const element = column.getElement?.()
      if (element?.classList) {
        element.classList.toggle('is-filtered', isFiltered)
      }
    })
  }

  setPivotFilterBadges = (allColumns, filters, container) => {
    const columnDefs = this.getFilteredTabulatorColumnDefinitions()
    const feFilters = this.props?.response?.data?.data?.fe_req?.filters || []

    const filteredIndices = new Set()
    feFilters.forEach((f) => f?.column_index !== undefined && filteredIndices.add(String(f.column_index)))
    filters.forEach((f) => f?.field !== undefined && filteredIndices.add(String(f.field)))

    const rowHeaderIndex = columnDefs?.[0]?.index
    const groupDef = columnDefs?.find((d) => d?.columns?.length > 0)
    const firstChild = groupDef?.columns?.[0]
    const colDimensionIndex = firstChild?.origPivotColumn?.index
    const measureIndex = firstChild?.origColumn?.index

    if (groupDef?.columns?.length && !firstChild?.origPivotColumn) {
      console.warn('ChataTable: Pivot columns missing origPivotColumn - filter badges may not display correctly')
    }

    const isRowFiltered = rowHeaderIndex !== undefined && filteredIndices.has(String(rowHeaderIndex))
    const isColDimensionFiltered = colDimensionIndex !== undefined && filteredIndices.has(String(colDimensionIndex))
    const isMeasureFiltered = measureIndex !== undefined && filteredIndices.has(String(measureIndex))

    allColumns.forEach((column) => {
      const def = column?.getDefinition?.() || {}
      const isChild = def?.origPivotColumn !== undefined
      const isFiltered = isChild ? isColDimensionFiltered : isRowFiltered

      column?.getElement?.()?.classList.toggle('is-filtered', isFiltered)
    })

    container?.querySelectorAll('.tabulator-col-group')?.forEach((el) => {
      el.classList.toggle('is-filtered', isMeasureFiltered)
    })
  }

  setFilters = async (newFilters) => {
    this._setFiltersTime = Date.now()

    const filterValues = newFilters || this.tableParams?.filter

    if (filterValues) {
      try {
        // Batch header filter updates without triggering repeated Tabulator
        // redraws; this prevents intermediate layout thrashing. Use the
        // TableWrapper API so wrapper state (redrawRestored) stays in sync.
        this.ref?.blockRedraw()

        try {
          filterValues.forEach((filter) => {
            const columns = this.ref.tabulator.getColumns()
            const targetColumn = columns.find((col) => col.getField() === filter.field)

            if (targetColumn && targetColumn.getDefinition().headerFilter) {
              this.ref?.tabulator?.setHeaderFilterValue(filter.field, filter.value)
            }
          })
        } finally {
          this.ref?.restoreRedraw()
        }

        this._filterCheckTimeout = setTimeout(() => {
          this._filterCheckTimeout = null
        }, 10)
      } catch (error) {
        console.error('CHATATABLE - error setting filters:', error)
      }
    }

    this.setFilterBadgeClasses()
  }

  onDateRangeSelectionApplied = () => {
    this.setState({ datePickerColumn: undefined })
    const column = this.state.datePickerColumn
    if (!this.state.dateRangeSelection) {
      return
    }
    const { startDate, endDate } = this.state.dateRangeSelection

    if (!column) {
      return
    }

    let start = startDate
    let end = endDate
    if (startDate && !endDate) {
      end = start
    } else if (!startDate && endDate) {
      start = end
    }

    const inputElement = document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${column.field}"] .tabulator-col-content input`,
    )

    if (inputElement) {
      const filterPrecision = getFilterPrecision(column)
      const dayJSFormatStr = DAYJS_PRECISION_FORMATS[filterPrecision]

      const startDateStr = dayjs(start).format(dayJSFormatStr)
      const startDateUTC = dayjs.utc(startDateStr).toISOString()
      const formattedStartDate = dayjs(startDateUTC).utc().format(dayJSFormatStr)

      const endDateStr = dayjs(end).format(dayJSFormatStr)
      const endDateUTC = dayjs.utc(endDateStr).toISOString()
      const formattedEndDate = dayjs(endDateUTC).utc().format(dayJSFormatStr)

      let filterInputText = `${formattedStartDate} to ${formattedEndDate}`
      if (formattedStartDate === formattedEndDate) {
        filterInputText = formattedStartDate
      }

      this.setHeaderInputValue(inputElement, filterInputText)
      this.currentDateRangeSelections = {
        [column.field]: this.state.dateRangeSelection,
      }
    }
  }

  onDateRangeSelection = (dateRangeSelection) => {
    this.setState({ dateRangeSelection })
  }

  setSorters = (newSorters) => {
    const sorterValues = newSorters || this.tableParams?.sort
    this.settingSorters = true

    if (this.ref?.tabulator && sorterValues && Array.isArray(sorterValues)) {
      sorterValues.forEach((sorter) => {
        try {
          this.ref.tabulator.setSort(sorter.field, sorter.dir)
        } catch (_) {
          // Error silently handled by tabulator
        }
      })
    }

    this.settingSorters = false
  }

  toggleIsFiltering = (filterOn, scrollToFirstFilteredColumn) => {
    if (scrollToFirstFilteredColumn && this.tableParams?.filter?.length) {
      const column = this.ref?.tabulator
        ?.getColumns()
        ?.find((col) => col.getField() === this.tableParams.filter[0]?.field)

      column?.scrollTo('middle')
    }

    let isFiltering = !this.state.isFiltering
    if (typeof filterOn === 'boolean') {
      isFiltering = filterOn
    }

    if (this._isMounted) {
      this.setState({ isFiltering })
    }

    return isFiltering
  }

  setHeaderInputValue = (inputElement, value) => {
    if (!inputElement) {
      return
    }

    inputElement.focus()
    this.ref?.restoreRedraw()
    inputElement.value = value
    inputElement.title = value
    inputElement.blur()
  }

  onUpdateColumnConfirm = () => {
    const column = _cloneDeep(this.state.contextMenuColumn)
    this.setState({ contextMenuColumn: undefined, isCustomColumnPopoverOpen: true, activeCustomColumn: column })
  }

  isColumnFrozen = (column) => {
    const columns = this.ref?.tabulator?.getColumns()
    const targetColumn = columns?.find((col) => col.getField() === column.field)
    return targetColumn?.getDefinition()?.frozen === true
  }

  onFreezeColumnClick = (column) => {
    this.setState({ contextMenuColumn: undefined })
    const columns = this.ref?.tabulator?.getColumns()
    const targetColumn = columns?.find((col) => col.getField() === column.field)

    if (targetColumn) {
      // Capture current filter values before freezing/unfreezing
      const currentFilters = this.ref?.tabulator?.getHeaderFilters()

      const isCurrentlyFrozen = this.isColumnFrozen(column)
      targetColumn.updateDefinition({ frozen: !isCurrentlyFrozen })

      // Re-attach event listeners and restore filters after DOM recreation
      setTimeout(() => {
        this.setHeaderInputEventListeners()
        // Restore filter values after column recreation
        if (currentFilters && currentFilters.length > 0) {
          this.setFilters(currentFilters)
        }
      }, 0)
    }
  }

  onRemoveColumnClick = async () => {
    const column = _cloneDeep(this.state.contextMenuColumn)
    this.setState({ contextMenuColumn: undefined })

    const currentAdditionalSelectColumns = this.props.response?.data?.data?.fe_req?.additional_selects ?? []
    const newAdditionalSelectColumns = currentAdditionalSelectColumns.filter((select) => {
      return select?.columns?.[0]?.replace(/ /g, '') !== column?.name?.replace(/ /g, '')
    })

    if (currentAdditionalSelectColumns.length !== newAdditionalSelectColumns.length) {
      this.setPageLoading(true)
      try {
        const response = await this.queryFn({ newColumns: newAdditionalSelectColumns })
        if (response?.data?.data?.rows) {
          this.props.updateColumnsAndData(response)
        } else {
          console.error('Column deletion failed: no rows returned')
        }
      } catch (error) {
        console.error(error)
      } finally {
        this.setPageLoading(false)
      }
      return
    }

    const newColumns = this.props.columns.map((col) =>
      col.name === column.name ? { ...col, visible: false, is_visible: false } : col,
    )

    this.props.updateColumns(
      newColumns,
      this.props.response?.data?.data?.fe_req,
      this.props.response?.data?.data?.available_selects,
    )

    setColumnVisibility({ ...this.props.authentication, columns: newColumns }).catch((error) => {
      console.error(error)
    })
  }

  updateColumn = (field, newParams) => {
    this.ref?.updateColumn?.(field, newParams)?.then(() => {
      if (this.props.keepScrolledRight) {
        this.scrollToRight()
      }
      setTimeout(() => {
        this.setHeaderInputEventListeners()
      }, 0)
    })
  }

  renderEmptyPlaceholderText = () => {
    return (
      <div className='table-loader table-page-loader table-placeholder'>
        <div>No data matching your query</div>
      </div>
    )
  }

  renderPageLoader = () => {
    return (
      <div className='table-loader table-page-loader'>
        <div className='page-loader-spinner'>
          <Spinner />
        </div>
      </div>
    )
  }

  renderScrollLoader = () => {
    return (
      <div className='table-loader table-scroll-loader'>
        <Spinner />
      </div>
    )
  }

  renderDateRangePickerPopover = () => {
    if (!this.state.datePickerColumn) {
      return null
    }

    return (
      <Popover
        isOpen={!!this.state.datePickerColumn}
        align='start'
        positions={['bottom', 'right', 'left', 'top']}
        onClickOutside={(e) => {
          e.stopPropagation()
          if (this._isMounted) {
            this.setState({
              datePickerColumn: undefined,
            })
          }
        }}
        content={
          <div className='react-autoql-popover-date-picker'>
            <h3>{this.state.datePickerColumn.display_name}</h3>
            <DateRangePicker
              initialRange={this.currentDateRangeSelections?.[this.state.datePickerColumn.field]}
              onSelection={this.onDateRangeSelection}
              validRange={this.state.datePickerColumn.dateRange}
              type={this.state.datePickerColumn.precision}
            />
            <Button type='primary' onClick={this.onDateRangeSelectionApplied}>
              Apply
            </Button>
          </div>
        }
      >
        <div
          style={{
            position: 'absolute',
            top: this.state.datePickerLocation?.top,
            left: this.state.datePickerLocation?.left,
          }}
        />
      </Popover>
    )
  }

  renderCustomColumnPopover = () => {
    if (!this.props.allowCustomColumns) {
      return null
    }

    if (this.state.isCustomColumnPopoverOpen) {
      return (
        <CustomColumnModal
          {...this.props}
          isOpen={this.state.isCustomColumnPopoverOpen}
          onClose={() => this.resetCustomColumnModal()}
          tableRef={this.ref}
          aggConfig={this.props.aggConfig}
          queryResponse={this.props.response}
          dataFormatting={this.props.dataFormatting}
          initialColumn={this.state.activeCustomColumn}
          onUpdateColumn={(column) => {
            this.props.onCustomColumnChange(column)
            this.resetCustomColumnModal()
          }}
          onAddColumn={(column) => {
            this.props.onCustomColumnChange(column)
            this.resetCustomColumnModal()
          }}
        />
      )
    }

    return null
  }

  renderContextMenuContent = () => {
    const { contextMenuColumn } = this.state
    return (
      <div className='more-options-menu' data-test='react-autoql-toolbar-more-options'>
        <ul className='context-menu-list'>
          <li onClick={() => this.onFreezeColumnClick(contextMenuColumn)}>
            <Icon type={this.isColumnFrozen(contextMenuColumn) ? 'unlock' : 'lock'} />
            {this.isColumnFrozen(contextMenuColumn) ? 'Unfreeze Column' : 'Freeze Column'}
          </li>
          {!!contextMenuColumn?.custom && !contextMenuColumn?.has_window_func && (
            <li onClick={() => this.onUpdateColumnConfirm()}>
              <Icon type='edit' />
              Edit Column
            </li>
          )}
          <li onClick={this.onRemoveColumnClick}>
            <Icon type='close' />
            Remove Column
          </li>
        </ul>
      </div>
    )
  }

  renderHeaderContextMenuPopover = () => {
    if (!this.state.contextMenuColumn) {
      return null
    }

    return (
      <Popover
        isOpen={!!this.state.contextMenuColumn}
        padding={0}
        align='start'
        positions={['bottom', 'right', 'left', 'top']}
        onClickOutside={(e) => {
          e.stopPropagation()
          if (this._isMounted) {
            this.setState({ contextMenuColumn: undefined })
          }
        }}
        content={this.renderContextMenuContent()}
      >
        <div
          style={{
            position: 'absolute',
            top: this.state.contextMenuLocation?.top,
            left: this.state.contextMenuLocation?.left,
          }}
        />
      </Popover>
    )
  }

  getFilteredTabulatorColumnDefinitions = () => {
    try {
      if (this.props.pivot && this.props.columns?.length) {
        const columns = []

        this.props.columns.forEach((col, i) => {
          if (i === 0) {
            const pivotCol = { ...col }
            // Inject a compact header button (hamburger) to open the pivot-axis selector
            pivotCol.title = pivotCol.title || pivotCol.display_name || pivotCol.name || ''
            pivotCol.title = `<div class="pivot-header-title"><button class="pivot-axis-header-btn" type="button" aria-label="Pivot axis">${this.PIVOT_HAMBURGER_ICON}</button>${pivotCol.title}</div>`
            columns.push(pivotCol)
          } else {
            if (!columns[1]) {
              columns.push({
                title: col.origColumn?.display_name,
                columns: [col],
              })
            } else {
              columns[1].columns.push(col)
            }
          }
        })

        return columns
      } else if (this.props.columns?.length) {
        const filteredColumns = this.props.columns.map((col) => {
          const newCol = {}
          Object.keys(col).forEach((option) => {
            if (columnOptionsList.includes(option)) {
              newCol[option] = col[option]
            }
          })
          return newCol
        })
        return filteredColumns
      }
    } catch (error) {
      console.error(error)
    }

    return []
  }

  renderPivotAxisSelectorPopover = () => {
    if (!this.props.pivot || !this.props.pivotAxisOptions?.length) {
      return null
    }

    return (
      <PivotAxisSelector
        isOpen={this.state.pivotAxisSelectorOpen}
        options={this.props.pivotAxisOptions}
        activeIndex={this.props.pivotAxisCurrentIndex}
        location={this.state.pivotAxisSelectorLocation}
        onClose={() => this.setState({ pivotAxisSelectorOpen: false })}
        onChange={this.props.onPivotAxisChange}
      />
    )
  }

  openPivotAxisSelectorForElement = (element) => {
    const location = computePivotAxisSelectorLocation(element, this.tableContainer)
    if (location) {
      this.setState({
        pivotAxisSelectorOpen: true,
        pivotAxisSelectorLocation: location,
      })
    }
  }

  openPivotAxisSelectorAboveRowCount = (e) => {
    if (!this.tableContainer) return

    const button = e?.currentTarget
    let location = button ? computePivotAxisSelectorLocation(button, this.tableContainer) : null

    // If position calculation fails, center relative to table container
    if (!location) {
      const containerRect = this.tableContainer.getBoundingClientRect()
      location = {
        top: containerRect.height / 2 - 50,
        left: containerRect.width / 2 - 75,
      }
    }

    this.setState({
      pivotAxisSelectorOpen: true,
      pivotAxisSelectorLocation: location,
    })
  }

  renderTableRowWarning = () => {
    // For pivot tables - render icon
    if (this.props.pivot) {
      if ((this.useInfiniteScroll && isDataLimited(this.props.response)) || this.props.pivotTableDataLimited) {
        const rowLimit = this.props.response?.data?.data?.row_limit
        const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
        const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)
        const totalRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(
          this.props.response?.data?.data?.count_rows,
        )
        const totalPivotRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(this.props.totalRows)
        const totalPivotColumnsFormatted = new Intl.NumberFormat(languageCode, {}).format(this.props.totalColumns)
        const maxColumnsFormatted = new Intl.NumberFormat(languageCode, {}).format(this.props.maxColumns)

        let tooltipContent

        if (this.useInfiniteScroll && isDataLimited(this.props.response)) {
          tooltipContent = `To optimize performance, this pivot table is limited to the initial <em>${rowLimitFormatted}/${totalRowsFormatted}</em> rows of the original dataset.`
        } else if (this.props.pivotTableDataLimited) {
          tooltipContent = `To optimize performance, this pivot table has been limited to <em>${maxColumnsFormatted}</em> columns. The original table would have had <em>${totalPivotColumnsFormatted}</em> columns.`
        }

        return (
          <div
            className='react-autoql-table-data-limit-icon'
            data-tooltip-html={tooltipContent}
            data-tooltip-id={this.props.tooltipID}
          >
            <Icon type='warning' />
          </div>
        )
      }
      return null
    }

    // For regular tables - show warning whenever data is limited, regardless of useInfiniteScroll
    // useInfiniteScroll is only set once in constructor and may be stale after axis changes
    if (isDataLimited(this.props.response)) {
      const rowLimit = this.props.response?.data?.data?.row_limit ?? MAX_DATA_PAGE_SIZE
      const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
      const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)
      const totalRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(
        this.props.response?.data?.data?.count_rows,
      )
      const tooltipContent = `To optimize performance, this table is limited to the initial <em>${rowLimitFormatted}/${totalRowsFormatted}</em> rows.`
      const content = `Limited to ${rowLimitFormatted} rows`

      return (
        <DataLimitWarning
          tooltipID={this.props.tooltipID}
          rowLimit={rowLimit}
          tooltipContent={tooltipContent}
          content={content}
        />
      )
    }

    return null
  }

  onScrollVertical = (top) => {
    this.setState({ scrollTop: top })
  }

  renderTableRowCount = () => {
    if (this.isTableEmpty()) {
      return null
    }

    let currentRowCount = 50
    if (this.props.data?.length < 50) {
      currentRowCount = this.props.data?.length
    }

    let totalRowCount = this.props.pivot ? this.props.data?.length : this.props.response?.data?.data?.count_rows

    // If filters are applied, use the full filtered count captured before slicing
    if (this.tableParams?.filter?.length > 0) {
      if (this.filterCount > 0) {
        totalRowCount = this.filterCount
      }
    }

    // Calculate which group of 50 records user has scrolled to
    if (this.tableContainer) {
      const tableHolder = this.tableContainer?.querySelector('.tabulator-tableholder')
      const scrollTop = tableHolder?.scrollTop || 0
      const rowHeight = this.tableContainer?.querySelector('.tabulator-row')?.offsetHeight || 0

      if (rowHeight > 0) {
        const visibleRows = Math.ceil(scrollTop / rowHeight)
        currentRowCount = Math.min((Math.floor(visibleRows / 50) + 1) * 50, totalRowCount)
      }
    }

    if (!totalRowCount || !(currentRowCount > 0)) {
      return null
    }

    const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
    const currentRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(currentRowCount)
    const totalRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(totalRowCount)
    const rowLimit = this.props.response?.data?.data?.row_limit ?? MAX_DATA_PAGE_SIZE
    const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)

    return (
      <div>
        <div className='table-row-count'>
          <span>
            {`Scrolled ${currentRowsFormatted} / ${
              totalRowCount > rowLimit ? rowLimitFormatted + '+' : totalRowsFormatted
            } rows`}
          </span>
        </div>
      </div>
    )
  }

  renderHeaderTooltipContent = ({ content }) => {
    try {
      let column
      try {
        column = JSON.parse(content)
      } catch (error) {
        return null
      }

      if (!column) {
        return null
      }

      const name = column.display_name
      const altName = column.title
      const type = COLUMN_TYPES[column?.type]?.description
      const icon = COLUMN_TYPES[column?.type]?.icon

      const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
      const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(MAX_DATA_PAGE_SIZE)

      const stats = this.summaryStats[column.index]

      return (
        <div>
          <div className='selectable-table-tooltip-title'>
            <span>
              {name}
              {altName !== name ? ` (${altName})` : ''}
            </span>
          </div>
          {!!type && (
            <div className='selectable-table-tooltip-section selectable-table-tooltip-subtitle'>
              {!!icon && <Icon type={icon} />}
              <span>{type}</span>
            </div>
          )}
          {!!column.fnSummary && (
            <div className='selectable-table-tooltip-section'>
              <span>
                <strong>Custom formula:</strong>
                <span> = {column.fnSummary}</span>
              </span>
            </div>
          )}
          {(column?.type === ColumnTypes.QUANTITY ||
            column?.type === ColumnTypes.DOLLAR_AMT ||
            column?.type === ColumnTypes.DATE) &&
            stats &&
            (this.useInfiniteScroll && isDataLimited(this.props.response) ? (
              <div className='selectable-table-tooltip-section'>
                <span>
                  <Icon type='warning' /> {`Summary stats unavailable - ${DATASET_TOO_LARGE}`}
                </span>
              </div>
            ) : (
              <>
                {(column?.type === ColumnTypes.QUANTITY || column?.type === ColumnTypes.DOLLAR_AMT) && (
                  <div className='selectable-table-tooltip-section'>
                    <span>
                      <strong>Total: </strong>
                      <span>{stats?.sum}</span>
                    </span>
                  </div>
                )}
                {(column?.type === ColumnTypes.QUANTITY || column?.type === ColumnTypes.DOLLAR_AMT) && (
                  <div className='selectable-table-tooltip-section'>
                    <span>
                      <strong>Average: </strong>
                      <span>{stats?.avg}</span>
                    </span>
                  </div>
                )}
                {column?.type === ColumnTypes.DATE && stats?.min !== null && (
                  <div className='selectable-table-tooltip-section'>
                    <span>
                      <strong>Earliest: </strong>
                      <span>{stats.min}</span>
                    </span>
                  </div>
                )}
                {column?.type === ColumnTypes.DATE && stats?.max !== null && (
                  <div className='selectable-table-tooltip-section'>
                    <span>
                      <strong>Latest: </strong>
                      <span>{stats.max}</span>
                    </span>
                  </div>
                )}
              </>
            ))}
        </div>
      )
    } catch (error) {
      return null
    }
  }

  getCurrentRowCount = () => {
    let rowCount = this.ref?.tabulator?.getDataCount('active')

    if (rowCount === undefined) {
      rowCount = this.tableParams.page * this.pageSize
    }

    if (rowCount > this.props.response?.data?.data?.rows?.length) {
      rowCount = this.props.response?.data?.data?.rows?.length
    }

    return rowCount
  }

  getTabulatorHeaderFilters = () => {
    if (this._isMounted && this.state.tabulatorMounted) {
      return this.ref?.tabulator?.getHeaderFilters()
    }
  }

  isTableEmpty = () => {
    return this.props.response?.data?.data?.rows?.length === 0
  }

  render = () => {
    const isEmpty = this.isTableEmpty()
    const isLoading = this.state.pageLoading || !this.state.tabulatorMounted

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          ref={(ref) => (this.tableContainer = ref)}
          data-test='react-autoql-table'
          style={this.props.style}
          className={`react-autoql-table-container 
            ${isLoading ? 'loading' : ''}
            ${getAutoQLConfig(this.props.autoQLConfig)?.enableDrilldowns ? 'supports-drilldown' : 'disable-drilldown'}
            ${this.state.isFiltering ? 'filtering' : ''}
            ${this.props.isAnimating ? 'animating' : ''}
            ${this.useInfiniteScroll ? 'infinite' : 'limited'}
            ${this.useInfiniteScroll && this.state.isLastPage ? 'last-page' : ''}
            ${this.props.pivot ? 'pivot' : ''}
            ${this.props.hidden ? 'hidden' : ''}
            ${isEmpty ? 'empty' : ''}`}
        >
          {this.renderTableRowWarning()}
          <div ref={(r) => (this.tabulatorContainer = r)} className='react-autoql-tabulator-container'>
            {!!this.props.response?.data?.data?.rows &&
              !!this.props.columns &&
              (this.props.autoHeight || !this.state.firstRender) && (
                <>
                  <TableWrapper
                    ref={(r) => (this.ref = r)}
                    height={this.props.autoHeight ? false : this.initialTableHeight}
                    tableKey={`react-autoql-table-${this.TABLE_ID}`}
                    id={`react-autoql-table-${this.TABLE_ID}`}
                    key={`react-autoql-table-wrapper-${this.TABLE_ID}`}
                    data-test='autoql-tabulator-table'
                    columns={this.getFilteredTabulatorColumnDefinitions()}
                    data={this.getRows(this.props)}
                    options={this.getTableWrapperOptions()}
                    hidden={this.props.hidden}
                    data-custom-attr='test-custom-attribute'
                    className='react-autoql-table'
                    onTableBuilt={(...args) => this.onTableBuilt(...args)}
                    onCellClick={(...args) => this.cellClick(...args)}
                    onDataSorting={(...args) => this.onDataSorting(...args)}
                    onDataSorted={(...args) => this.onDataSorted(...args)}
                    onDataFiltering={(...args) => this.onDataFiltering(...args)}
                    onDataFiltered={(...args) => this.onDataFiltered(...args)}
                    onDataProcessed={(...args) => this.onDataProcessed(...args)}
                    onDataLoadError={(...args) => this.onDataLoadError(...args)}
                    onScrollVertical={(...args) => this.onScrollVertical(...args)}
                    pivot={this.props.pivot}
                    scope={this.props.scope}
                    isDrilldown={this.props.isDrilldown}
                  />
                  {isEmpty && this.renderEmptyPlaceholderText()}
                  {(this.state.pageLoading || !this.state.tabulatorMounted) && this.renderPageLoader()}
                  {this.state.scrollLoading && this.renderScrollLoader()}
                </>
              )}
          </div>
          {this.renderDateRangePickerPopover()}
          {this.renderCustomColumnPopover()}
          {this.renderHeaderContextMenuPopover()}
          {this.renderPivotAxisSelectorPopover()}
          {this.renderTableRowCount()}
        </div>
        <Tooltip
          tooltipId={`selectable-table-column-header-tooltip-${this.TABLE_ID}`}
          className='selectable-table-column-header-tooltip'
          render={this.renderHeaderTooltipContent}
          opacity={1}
          delayHide={0}
          border
        />
      </ErrorBoundary>
    )
  }
}
