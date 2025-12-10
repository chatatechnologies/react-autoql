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
  isColumnSummable,
  getColumnFieldCompat,
  getColumnOriginalIndexCompat,
  getColumnPositionCompat,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { Popover } from '../Popover'
import { Tooltip } from '../Tooltip'
import TableWrapper from './TableWrapper'
import { DateRangePicker } from '../DateRangePicker'
import { DataLimitWarning } from '../DataLimitWarning'
import { columnOptionsList } from './tabulatorConstants'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { DATASET_TOO_LARGE, TABULATOR_LOCAL_ROW_LIMIT, LOCAL_OR_REMOTE, TOOLTIP_COPY_TEXTS } from '../../js/Constants'
import CustomColumnModal from '../AddColumnBtn/CustomColumnModal'
import PivotAxisSelector, { buildPivotAxisTitleElement, computePivotAxisSelectorLocation } from './PivotAxisSelector'

import './ChataTable.scss'
import 'tabulator-tables/dist/css/tabulator.min.css' //import Tabulator stylesheet
import { PerformanceOptimizer } from './PerformanceOptimizer'
import { SummaryStatsCalculator } from './SummaryStatsCalculator'
import { SummaryRowRenderer } from './SummaryRowRenderer'
import { AsyncErrorHandler } from './AsyncErrorHandler'
import { TableLifecycleManager } from './TableLifecycleManager'
import { TimeoutManager } from './TimeoutManager'

export default class ChataTable extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()
    this.SUMMARY_TOOLTIP_ID = `summary-tooltip-${uuid()}`

    this.hasSetInitialData = false
    this.isSettingInitialData = false
    this.isFiltering = false
    this.filterCount = 0
    this.isSorting = false
    this.filteredResponseData = null
    this.pageSize = props.pageSize ?? 50
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
      initialSort, //: undefined, // Let getRows do initial sorting and filtering
      initialFilter: undefined, // Let getRows do initial sorting and filtering
      progressiveLoadScrollMargin: 50, // Trigger next ajax load when scroll bar is 800px or less from the bottom of the table.
      movableColumns: true,
      smoothScroll: true,
      touchUndoSize: 5,
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

    // Persistent column mapping that survives table rebuilds and component remounts
    this.persistentColumnMapping = null
    this.persistentStoredMapping = null

    // Create a stable key based on queryRequestData or response content, not random UUID
    const stableId = this.getStableMappingKey(props)
    const ns = props.persistKeyNamespace || props.scope
    this.persistentMappingKey = props.persistColumnOrder
      ? `chataTable_columnMapping_${ns ? `${ns}_` : ''}${stableId}`
      : undefined

    // Initialize utility classes
    this.summaryStatsCalculator = new SummaryStatsCalculator(this.props.dataFormatting)
    this.summaryRowRenderer = new SummaryRowRenderer(
      this.SUMMARY_TOOLTIP_ID,
      TOOLTIP_COPY_TEXTS,
      this.props.dataFormatting,
    )
    this.lifecycleManager = new TableLifecycleManager(this)
    this.timeoutManager = new TimeoutManager()

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
    }
  }

  // For pivot tables, remove ajax/progressive/pagination options so Tabulator treats them as static tables.
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
    persistColumnOrder: PropTypes.bool,
    persistKeyNamespace: PropTypes.string,
    // Pivot axis selector props
    pivotAxisOptions: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.number, label: PropTypes.string })),
    pivotAxisCurrentIndex: PropTypes.number,
    onPivotAxisChange: PropTypes.func,
    originalColumns: PropTypes.arrayOf(PropTypes.shape({})),
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
    persistColumnOrder: true,
    persistKeyNamespace: undefined,
    // Pivot axis selector defaults
    pivotAxisOptions: [],
    pivotAxisCurrentIndex: undefined,
    onPivotAxisChange: () => {},
    originalColumns: [],
  }

  // Generate a stable key for localStorage based on table content, not random UUID
  getStableMappingKey = (props) => {
    try {
      // Use query ID if available
      const qid = props.response?.data?.data?.query_id
      if (qid) return `query_${qid}`

      // Use response ID if available
      const rid = props.response?.data?.response_id
      if (rid) return `response_${rid}`

      // Use hash of column names as fallback
      if (Array.isArray(props.columns) && props.columns.length > 0) {
        const s = props.columns.map((c) => c.field || '').join('|')
        let h = 0
        for (let i = 0; i < s.length; i++) (h = (h << 5) - h + s.charCodeAt(i)), (h &= h)
        return `columns_${Math.abs(h).toString(36)}`
      }
      // Final fallback - use a default key
      return 'default'
    } catch (_) {
      return 'fallback'
    }
  }

  savePersistedMappings = (columnMapping, storedColumnMapping) => {
    try {
      if (!this.props.persistColumnOrder || !this.persistentMappingKey) return
      localStorage.setItem(this.persistentMappingKey, JSON.stringify({ columnMapping, storedColumnMapping }))
    } catch (_) {}
  }

  loadPersistedMappings = () => {
    try {
      if (!this.props.persistColumnOrder || !this.persistentMappingKey) return
      const stored = localStorage.getItem(this.persistentMappingKey)
      if (!stored) return
      const { columnMapping, storedColumnMapping } = JSON.parse(stored)
      if (Array.isArray(columnMapping) && columnMapping.length > 0) {
        this.persistentColumnMapping = columnMapping
        this.columnMapping = [...columnMapping]
      }
      if (Array.isArray(storedColumnMapping) && storedColumnMapping.length > 0) {
        this.persistentStoredMapping = storedColumnMapping
        this.storedColumnMapping = [...storedColumnMapping]
      }
    } catch (_) {}
  }

  clearColumnOrderPersistence = (restoreDefault = true) => {
    try {
      if (this.persistentMappingKey) localStorage.removeItem(this.persistentMappingKey)
    } catch (_) {}
    this.columnMapping = null
    this.storedColumnMapping = null
    this.persistentColumnMapping = null
    this.persistentStoredMapping = null
    if (restoreDefault && Array.isArray(this.props.columns)) {
      const updatedColumns = (this.props.columns || []).map((c, i) => ({ ...c, index: i }))
      if (this.props.updateColumns) this.props.updateColumns(updatedColumns)
    }
  }

  // Resolve a column's field name across Tabulator ColumnComponent and utils Column instances
  // Uses autoql-fe-utils getColumnFieldCompat when available, with safe fallbacks.
  resolveColumnField = (col) => {
    try {
      if (!col) return undefined

      const v = getColumnFieldCompat(col)
      if (v) return v
      return col?.getField?.() || col?.getDefinition?.()?.field || col?.field
    } catch (e) {
      return undefined
    }
  }

  // Best-effort check to detect Tabulator ColumnComponent instances
  isTabulatorColumnComponent = (obj) => {
    if (!obj || typeof obj !== 'object') return false
    return (
      typeof obj.getField === 'function' ||
      typeof obj.getDefinition === 'function' ||
      typeof obj.getCells === 'function' ||
      typeof obj.getElement === 'function'
    )
  }

  // Compat: best-effort resolve original index without touching Tabulator-only methods
  compatOriginalIndex = (col) => {
    // Prefer utils helper when the object is not a Tabulator ColumnComponent
    if (!this.isTabulatorColumnComponent(col) && typeof getColumnOriginalIndexCompat === 'function') {
      try {
        const idx = getColumnOriginalIndexCompat(col, this.props.columns)
        if (typeof idx === 'number' && idx >= 0) return idx
      } catch (_) {}
    }
    const field = this.resolveColumnField(col)
    if (field) {
      const idx = (this.props.columns || []).findIndex((c) => c?.field === field)
      if (idx >= 0) return idx
    }
    const defIdx = col?.getDefinition?.()?.index
    return typeof defIdx === 'number' ? defIdx : undefined
  }

  // Compat: best-effort resolve visual position without calling ColumnComponent.getPosition
  compatVisualPosition = (col, visibleColumns) => {
    if (!this.isTabulatorColumnComponent(col) && typeof getColumnPositionCompat === 'function') {
      try {
        const pos = getColumnPositionCompat(col, visibleColumns)
        if (typeof pos === 'number' && pos >= 0) return pos
      } catch (_) {}
    }
    return Array.isArray(visibleColumns) ? visibleColumns.indexOf(col) : -1
  }

  componentDidMount = () => {
    this._isMounted = true
    this._setFiltersTime = Date.now() // Track when component mounted to avoid duplicate requests

    this.initializeHelpers()

    if (!this.props.autoHeight) {
      this.initialTableHeight = this.tabulatorContainer?.clientHeight
      this.lockedTableHeight = this.initialTableHeight
    }

    this.summaryStats = this.summaryStatsCalculator.calculate(this.props)

    this.setState({
      firstRender: false,
    })
  }

  initializeHelpers = () => {
    PerformanceOptimizer.applyPassiveEventPatch()
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

    if (!this.props.hidden && prevProps.hidden) {
      if (this.state.subscribedData) {
        this.updateData(this.state.subscribedData)
        this.setState({ subscribedData: undefined })
      } else {
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
    this.updateSummaryStats(this.props)
  }

  componentWillUnmount = () => {
    try {
      this._isMounted = false
      this.timeoutManager.clearAllTimeouts()
      clearTimeout(this.setStateTimeout)

      this.cancelCurrentRequest()

      // DON'T clean up localStorage here - we need it to persist across component remounts
      // Only clean up when the parent component/page is truly done with the table
      // localStorage will be cleaned up by browser when appropriate
    } catch (error) {
      console.error(error)
    }
  }

  resetCustomColumnModal = () => {
    this.setState({ isCustomColumnPopoverOpen: false, activeCustomColumn: undefined })
  }

  updateSummaryStats = (props) => {
    this.setTimeout(
      'summaryStats',
      () => {
        this.summaryStats = this.summaryStatsCalculator.calculate(props)

        if (this.shouldUpdateColumns()) {
          this.updateColumnDefinitions()
        }
      },
      10,
    )

    return this.summaryStats
  }

  shouldUpdateColumns = () => {
    return this.state.tabulatorMounted && this._isMounted && this.ref?.tabulator
  }

  updateColumnDefinitions = () => {
    // No longer needed: bottomCalcParams logic removed
    // All summary logic handled by custom React summary row
    return
  }

  scheduleTooltipRefresh = (delay = 10) => {
    this.timeoutManager.scheduleTooltipRefresh(() => this.setHeaderInputEventListeners(), delay)
  }

  refreshTooltips = () => {
    this.timeoutManager.scheduleTooltipRefresh(() => {
      this.setupTooltips()
      this.setHeaderInputEventListeners()
    })
  }

  setTimeout = (key, callback, delay) => {
    this.timeoutManager.setNamedTimeout(key, callback, delay)
  }

  addPassiveScrollListeners = () => {
    PerformanceOptimizer.applyScrollOptimizations(this.TABLE_ID)
  }

  generateFieldReference = (col, index) => {
    return (
      col.field ||
      (col.name && col.name.replace(/\s+/g, '_').toLowerCase()) ||
      (col.display_name && col.display_name.replace(/\s+/g, '_').toLowerCase()) ||
      `column_${index}`
    )
  }

  findHeaderElement = (fieldRef, index) => {
    if (!this.ref?.tabulator) {
      return null
    }

    try {
      const column = this.ref.tabulator.getColumn(fieldRef)
      if (column && typeof column.getElement === 'function') {
        const columnElement = column.getElement()
        return columnElement?.querySelector('.tabulator-col-title-holder') || null
      }

      const allColumns = this.ref.tabulator.getColumns()
      if (allColumns && allColumns[index] && typeof allColumns[index].getElement === 'function') {
        const columnElement = allColumns[index].getElement()
        return columnElement?.querySelector('.tabulator-col-title-holder') || null
      }
    } catch (error) {
      // Silent fallback to DOM query if Tabulator API fails
    }

    return document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${fieldRef}"]:not(.tabulator-col-group) .tabulator-col-title-holder`,
    )
  }

  createTooltipData = (col, fieldRef, index) => {
    const tooltipData = { ...col, field: fieldRef, index }

    if (!tooltipData.display_name && tooltipData.title) {
      tooltipData.display_name = tooltipData.title
    }

    return tooltipData
  }

  setTooltipAttributes = (headerElement, tooltipData, index, fieldRef) => {
    headerElement.setAttribute('data-tooltip-id', `selectable-table-column-header-tooltip-${this.TABLE_ID}`)
    headerElement.setAttribute('data-tooltip-content', JSON.stringify(tooltipData))
    headerElement.setAttribute('data-column-type', tooltipData.type || 'unknown')
    headerElement.setAttribute('data-column-index', index.toString())
    headerElement.setAttribute('data-column-field', fieldRef)
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
    this.updateSummaryStats(this.props)

    return this.ref?.updateData(data)
  }

  transposeTable = () => {
    // This is a WIP
    if (this.ref?.tabulator) {
      const newColumns = [
        { name: 'Property', field: '0', frozen: true },
        { name: 'Value', field: '1' },
      ]

      const row = this.props.response?.data?.data?.rows[0]
      const newData = this.props.columns?.map((column, i) => {
        return [column?.display_name, formatElement({ element: row[i], column, config: this.props.dataFormatting })]
      })

      this.ref.tabulator.options['headerVisible'] = false
      this.ref.tabulator.options['layout'] = 'fitData'
      this.ref.tabulator.setColumns(newColumns)
      this.ref.tabulator.setData(newData)
    }
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
        // source: 'data_messenger',
        source: this.props.source,
        scope: this.props.scope,
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

      this.updateSummaryStats(this.props)

      this.scheduleTooltipRefresh(100)
    }
  }

  onDataFiltering = () => {
    if (this._isMounted && this.state.tabulatorMounted) {
      const headerFilters = this.ref?.tabulator?.getHeaderFilters()

      if (headerFilters && !_isEqual(headerFilters, this.tableParams?.filter)) {
        this.isFiltering = true
        this.setLoading(true)

        this.storeCurrentVisualOrder()
      }
    }
  }

  onDataFiltered = (filters, rows) => {
    if (this.isFiltering && this.state.tabulatorMounted) {
      this.isFiltering = false

      // If columns have been moved and filters are applied, ensure alignment is maintained
      const mappingToCheck = this.storedColumnMapping || this.columnMapping
      if (mappingToCheck && mappingToCheck.length > 0 && filters && filters.length > 0) {
        try {
          // Get filtered data
          const filteredData = this.ref.tabulator.getData()

          // Force a redraw to ensure headers and data stay aligned
          this.ref.tabulator.redraw(true)

          // Additional verification after a short delay
          setTimeout(() => {
            if (this._isMounted && this.ref?.tabulator) {
              this.ref.tabulator.redraw(false)
            }
          }, 10)
        } catch (error) {
          console.error('Error maintaining column alignment after filtering:', error)
        }
      }

      this.debounceSetState({ loading: false })
    }

    // Debounce getRTForRemoteFilterAndSort to prevent multiple calls after hide/show columns
    if (!this.useInfiniteScroll && !this.props.pivot && this.tableParams?.filter?.length > 0) {
      if (this._debounceTimeout) clearTimeout(this._debounceTimeout)
      this._debounceTimeout = setTimeout(() => {
        try {
          this.getRTForRemoteFilterAndSort()
        } catch (error) {
          console.error('Error in debounced getRTForRemoteFilterAndSort:', error)
        }
      }, 100)
    }

    this.setFilterBadgeClasses()
    this.scheduleTooltipRefresh(100)
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
    this.loadPersistedMappings()

    // Fallback to instance variables if localStorage didn't work
    if (!this.columnMapping && this.persistentColumnMapping) this.columnMapping = [...this.persistentColumnMapping]
    if (!this.storedColumnMapping && this.persistentStoredMapping)
      this.storedColumnMapping = [...this.persistentStoredMapping]

    if (this._isMounted) {
      this.setState({ tabulatorMounted: true, pageLoading: false })
      // Add a small delay to ensure DOM is fully ready
      setTimeout(() => {
        if (!this._isMounted) return
        this.setHeaderInputEventListeners()
        this.addPassiveScrollListeners()
      }, 100)
      this.updateSummaryStats(this.props)
      if (this.props.keepScrolledRight) this.scrollToRight()
    }
  }

  // Store the current visual column order for later restoration
  storeCurrentVisualOrder = () => {
    try {
      if (!this.ref?.tabulator || !Array.isArray(this.props.columns)) return
      const visibleColumns = this.ref.tabulator.getColumns()
      if (!Array.isArray(visibleColumns) || visibleColumns.length === 0) return

      // Use existing columnMapping if available, otherwise create new mapping
      if (Array.isArray(this.columnMapping) && this.columnMapping.length > 0) {
        this.storedColumnMapping = [...this.columnMapping]
        this.persistentStoredMapping = [...this.columnMapping]
        this.savePersistedMappings(this.columnMapping, this.storedColumnMapping)
        return
      }

      if (Array.isArray(this.persistentColumnMapping) && this.persistentColumnMapping.length > 0) {
        this.storedColumnMapping = [...this.persistentColumnMapping]
        this.persistentStoredMapping = [...this.persistentColumnMapping]
        this.savePersistedMappings(this.persistentColumnMapping, this.storedColumnMapping)
        return
      }

      const fieldToOriginalIndex = {}
      ;(this.props.columns || []).forEach((col, i) => {
        if (col.field) fieldToOriginalIndex[col.field] = i
      })
      const mapping = []
      visibleColumns.forEach((col) => {
        const field = this.resolveColumnField(col)
        const originalIndex = fieldToOriginalIndex[field]
        if (typeof originalIndex === 'number') mapping.push(originalIndex)
      })
      this.storedColumnMapping = mapping
      this.persistentStoredMapping = [...mapping]
      this.savePersistedMappings(this.columnMapping || mapping, mapping)
    } catch (_) {}
  }

  // Sync the index property on this.props.columns to the current visual order
  syncColumnIndicesToVisualOrder = () => {
    try {
      if (!this.ref?.tabulator || !Array.isArray(this.props.columns)) return
      const visibleColumns = this.ref.tabulator.getColumns()
      if (!Array.isArray(visibleColumns) || visibleColumns.length === 0) return

      const fieldToVisualPos = {}
      visibleColumns.forEach((col, visualIndex) => {
        const field = this.resolveColumnField(col)
        if (field !== undefined) {
          fieldToVisualPos[field] = visualIndex
        }
      })
      const updatedColumns = this.props.columns.map((col) => {
        const visualPos = fieldToVisualPos[col.field]
        return visualPos !== undefined ? { ...col, index: visualPos } : col
      })
      if (!_isEqual(updatedColumns, this.props.columns) && this.props.updateColumns)
        this.props.updateColumns(updatedColumns)
    } catch (e) {}
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
      const hasRecentlySetInitialData = Date.now() - (this._setInitialDataTime || 0) < DEBOUNCE_MS

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

        // Reorder server-side data to match visual column order (client-side is already ordered)
        let alignedResponse = responseWrapper
        try {
          const mappingToUse = this.storedColumnMapping || this.columnMapping
          const isServerSideData = this.useInfiniteScroll || typeof params.newColumns !== 'undefined'
          if (isServerSideData && Array.isArray(mappingToUse) && mappingToUse.length > 0) {
            alignedResponse = this.reorderResponseData(responseWrapper, mappingToUse)
          }
        } catch (e) {
          alignedResponse = responseWrapper
        }

        // this.props.onNewData(alignedResponse)

        // // After new data arrives, ensure column indices match the current visual order
        // this.syncColumnIndicesToVisualOrder()

        // const totalPages = this.getTotalPages(alignedResponse)

        // // Capture the full filtered count before slicing
        // this.filterCount = alignedResponse?.data?.data?.rows?.length || 0

        // response = {
        //   rows: alignedResponse?.data?.data?.rows?.slice(0, this.pageSize) ?? [],
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
    let response = _cloneDeep(this.props.response)
    let data = this.props.pivot
      ? _cloneDeep(this.originalQueryData)
      : _cloneDeep(this.props.response?.data?.data?.rows || this.originalQueryData)

    if (this.props.pivot) {
      if (params?.orders?.length) {
        const primaryOrder = params.orders[0]
        let sortColumnIndex
        if (primaryOrder?.field !== undefined) {
          const parsed = parseInt(primaryOrder.field, 10)
          if (!isNaN(parsed)) {
            sortColumnIndex = parsed
          } else {
            sortColumnIndex = this.props.columns.findIndex((col) => col.field === primaryOrder.field)
          }
        } else if (primaryOrder?.id !== undefined) {
          sortColumnIndex = this.props.columns.findIndex((col) => col.id === primaryOrder.id)
        }

        if (sortColumnIndex !== undefined && sortColumnIndex !== -1) {
          const sortDirection = primaryOrder.sort === 'DESC' ? 'desc' : 'asc'
          data = sortDataByColumn(data, this.props.columns, sortColumnIndex, sortDirection)
        }
      }

      this.originalQueryData = _cloneDeep(data)

      response.data = response.data || {}
      response.data.data = response.data.data || {}
      response.data.data.rows = data
      response.data.data.count_rows = data?.length || 0
      return response
    }

    // Filters
    if (params.tableFilters?.length) {
      params.tableFilters.forEach((filter) => {
        const column = this.props.columns.find((col) => col.id === filter.id)
        if (column) {
          data = filterDataByColumn(data, this.props.columns, column.index, filter.value, filter.operator)
        }
      })
    }

    // Update filterCount for local filtering
    this.filterCount = data?.length || 0

    if (params.orders?.length) {
      const column = this.props.columns.find((col) => col.id === params?.orders[0]?.id)
      if (column) {
        const sortDirection = params.orders[0].sort === 'DESC' ? 'desc' : 'asc'
        data = sortDataByColumn(data, this.props.columns, column.index, sortDirection)
      }
    }

    response.data.data.rows = data
    response.data.data.count_rows = data.length

    setTimeout(() => {
      this.updateSummaryStats({
        ...this.props,
        response: response,
      })
    }, 0)

    return response
  }

  queryFn = (params) => {
    // Always use server-side queryFn when dealing with column changes (newColumns)
    // because column removal is a schema change, not just data filtering
    if ((this.useInfiniteScroll || typeof params.newColumns !== 'undefined') && !this.props.pivot) {
      return this.props.queryFn(params)
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
      // For pivot tables we want to render the full local dataset so users can
      // scroll through all aggregated rows. Returning a sliced page here caused
      // the UI to only show the first `pageSize` rows (default 50).
      newRows = this.originalQueryData ?? []
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
      const response = { page: tableParams.page, rows }
      return Promise.resolve(response)
    } catch (error) {
      console.error(error)
      return Promise.reject(error)
    }
  }

  ajaxResponseFunc = (props, response) => {
    const isLastPage = (response?.rows?.length ?? 0) < this.pageSize
    const modResponse = { data: response?.rows ?? [], last_page: isLastPage }

    if (response) {
      if (this.tableParams?.page > 1) {
        // Only restore redraw for new page - doing this for filter/sort will reset the scroll value
        this.ref?.restoreRedraw()
      }

      if (isLastPage !== this.state.isLastPage && this._isMounted) {
        this.setState({ isLastPage })
      }
      // Force re-render to update filter count display after data is processed
      // Note: this.filterCount is already set correctly in ajaxRequestFunc from the queryFn response
      if (this._isMounted) {
        setTimeout(() => {
          this.lifecycleManager.safeForceUpdate()
          this.scheduleTooltipRefresh(150)
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
    this.lifecycleManager.debounceSetState(state, this.setState.bind(this))
  }

  inputKeydownListener = (event) => {
    if (!this.useInfiniteScroll) {
      this.ref?.restoreRedraw()
    }
  }

  inputSearchListener = () => {
    // When "x" button is clicked in the input box
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
    // Prevent duplicate calls if already in progress
    if (this._settingEventListeners) {
      return
    }

    const columns = cols ?? this.props.columns
    if (!columns?.length) {
      return
    }

    this._settingEventListeners = true

    let pivotSummaryStats = null
    if (this.props.pivot && this.props.data && this.props.data.length > 0) {
      pivotSummaryStats = columns.map((col, i) => {
        if (i === 0) return null
        const values = this.props.data.map((row) => row[i])
        const sum = values.reduce((acc, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val)
          return isNaN(num) ? acc : acc + num
        }, 0)
        return sum
      })
    }

    try {
      columns.forEach((col, i) => {
        if (this.props.pivot && pivotSummaryStats) {
          if (!this.summaryStats) this.summaryStats = {}
          this.summaryStats[i] = pivotSummaryStats[i]
        }
        this.setupColumnHeader(col, i)
        this.setupColumnInput(col, i)
      })
    } finally {
      this._settingEventListeners = false
    }
  }

  findInputElement = (fieldRef, index) => {
    if (!this.ref?.tabulator) {
      return null
    }

    try {
      // Try to get column by field reference first
      const column = this.ref.tabulator.getColumn(fieldRef)
      if (column && typeof column.getElement === 'function') {
        const columnElement = column.getElement()
        return columnElement?.querySelector('.tabulator-col-content input') || null
      }

      // Fallback: get column by index if field reference doesn't work
      const allColumns = this.ref.tabulator.getColumns()
      if (allColumns && allColumns[index] && typeof allColumns[index].getElement === 'function') {
        const columnElement = allColumns[index].getElement()
        return columnElement?.querySelector('.tabulator-col-content input') || null
      }
    } catch (error) {
      // Silent fallback to DOM query if Tabulator API fails
    }

    return document.querySelector(
      `#react-autoql-table-container-${this.TABLE_ID} .tabulator-col[tabulator-field="${fieldRef}"] .tabulator-col-content input`,
    )
  }

  attachInputListeners = (inputElement, col) => {
    // Remove existing listeners to prevent duplicates
    inputElement.removeEventListener('keydown', this.inputKeydownListener)
    inputElement.addEventListener('keydown', this.inputKeydownListener)

    if (col.type === ColumnTypes.DATE && !col.pivot) {
      inputElement.removeEventListener('click', (e) => this.inputDateClickListener(e, col))
      inputElement.addEventListener('click', (e) => this.inputDateClickListener(e, col))

      const keyboardEvents = ['keypress', 'keydown', 'keyup']
      keyboardEvents.forEach((evt) => {
        inputElement.removeEventListener(evt, this.inputDateKeypressListener)
        inputElement.addEventListener(evt, this.inputDateKeypressListener)
      })
    }
  }

  ensureClearButton = (inputElement, col) => {
    const clearBtn = document.querySelector(`#react-autoql-clear-btn-${this.TABLE_ID}-${col.field}`)
    if (!clearBtn) {
      this.renderHeaderInputClearBtn(inputElement, col)
    }
  }

  setFilterBadgeClasses = () => {
    if (!this._isMounted || !this.state.tabulatorMounted || !this.ref?.tabulator) {
      return
    }

    try {
      const activeFilters = {}
      if (this.tableParams?.filter) {
        this.tableParams.filter.forEach((filter) => {
          if (filter.field) {
            activeFilters[filter.field] = true
          }
        })
      }

      const columns = this.ref.tabulator.getColumns()
      if (!columns || !Array.isArray(columns)) {
        return
      }

      columns.forEach((column) => {
        if (!column || typeof column.getField !== 'function') return

        try {
          const field = column.getField()
          const isFiltering = !!activeFilters[field]

          const getElement = column.getElement
          if (typeof getElement !== 'function') return

          const columnElement = getElement.call(column)
          if (!columnElement || !columnElement.classList) return

          if (isFiltering) {
            columnElement.classList.add('is-filtered')
          } else {
            columnElement.classList.remove('is-filtered')
          }
        } catch (err) {
          // Silent fail for individual column to prevent breaking the entire table
        }
      })
    } catch (err) {
      // Silent fail to prevent breaking the entire component
    }
  }

  setupColumnHeader = (col, index) => {
    const fieldRef = this.generateFieldReference(col, index)
    const headerElement = this.findHeaderElement(fieldRef, index)

    if (headerElement) {
      const tooltipData = this.createTooltipData(col, fieldRef, index)
      this.setTooltipAttributes(headerElement, tooltipData, index, fieldRef)

      if (!this.props.pivot) {
        headerElement.addEventListener('contextmenu', (e) => this.headerContextMenuClick(e, col))
      }
    }
  }

  setupColumnInput = (col, index) => {
    const fieldRef = this.generateFieldReference(col, index)
    const inputElement = this.findInputElement(fieldRef, index)

    if (inputElement) {
      this.attachInputListeners(inputElement, col)
      this.ensureClearButton(inputElement, col)
    }
  }

  ensureClearButton = (inputElement, col) => {
    const clearBtn = document.querySelector(`#react-autoql-clear-btn-${this.TABLE_ID}-${col.field}`)
    if (!clearBtn) {
      this.renderHeaderInputClearBtn(inputElement, col)
    }
  }

  // setFilterBadgeClasses = () => {
  //   if (!this._isMounted || !this.state.tabulatorMounted || !this.ref?.tabulator) {
  //     return
  //   }

  //   try {
  //     const activeFilters = {}
  //     if (this.tableParams?.filter) {
  //       this.tableParams.filter.forEach((filter) => {
  //         if (filter.field) {
  //           activeFilters[filter.field] = true
  //         }
  //       })
  //     }

  //     const columns = this.ref.tabulator.getColumns()
  //     if (!columns || !Array.isArray(columns)) {
  //       return
  //     }

  //     columns.forEach((column) => {
  //       if (!column || typeof column.getField !== 'function') return

  //       try {
  //         const field = column.getField()
  //         const isFiltering = !!activeFilters[field]

  //         const getElement = column.getElement
  //         if (typeof getElement !== 'function') return

  //         const columnElement = getElement.call(column)
  //         if (!columnElement || !columnElement.classList) return

  //         if (isFiltering) {
  //           columnElement.classList.add('is-filtered')
  //         } else {
  //           columnElement.classList.remove('is-filtered')
  //         }
  //       } catch (err) {
  //         // Silent fail for individual column to prevent breaking the entire table
  //       }
  //     })
  //   } catch (err) {
  //     // Silent fail to prevent breaking the entire component
  //   }
  // }

  setupColumnHeader = (col, index) => {
    const fieldRef = this.generateFieldReference(col, index)
    const headerElement = this.findHeaderElement(fieldRef, index)

    if (headerElement) {
      const tooltipData = this.createTooltipData(col, fieldRef, index)
      this.setTooltipAttributes(headerElement, tooltipData, index, fieldRef)

      if (!this.props.pivot) {
        headerElement.addEventListener('contextmenu', (e) => this.headerContextMenuClick(e, col))
      }
    }
  }

  setupColumnInput = (col, index) => {
    const fieldRef = this.generateFieldReference(col, index)
    const inputElement = this.findInputElement(fieldRef, index)

    if (inputElement) {
      this.attachInputListeners(inputElement, col)
      this.ensureClearButton(inputElement, col)
    }
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

      column.getElement?.()?.classList.toggle('is-filtered', isFiltered)
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
        this.ref?.tabulator?.blockRedraw()

        try {
          // If columns have been moved, make sure the column indexes are up-to-date
          // This is critical for filtering with the correct column positions
          if (this.columnMapping && this.columnMapping.length > 0) {
            this.prepareForFilterAfterColumnMove()
          }

          filterValues.forEach((filter) => {
            const columns = this.ref.tabulator.getColumns()

            // Find the corresponding column by ID
            const targetColumn = this.props.columns.find((col) => col.id === filter.id)

            // If we found the column, get its field name
            const fieldToUse = targetColumn ? targetColumn.field : filter.field

            // Find the tabulator column by field name
            const tabulatorColumn = columns.find((col) => this.resolveColumnField(col) === fieldToUse)

            if (tabulatorColumn && tabulatorColumn.getDefinition().headerFilter) {
              this.ref?.tabulator?.setHeaderFilterValue(fieldToUse, filter.value)
            }
          })
        } finally {
          this.ref?.tabulator?.restoreRedraw()
        }

        // Final check after all filters set - with cleanup
        this.setTimeout('filterCheck', () => {}, 10)
      } catch (error) {
        console.error('CHATATABLE - error setting filters:', error)
      }
    }

    this.setFilterBadgeClasses()

    this.scheduleTooltipRefresh(100)
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
          //   AsyncErrorHandler.handleTabulatorSort(
          //     this.ref.tabulator,
          //     sorter.field,
          //     sorter.dir,
          //     this.props.onErrorCallback,
          //   )
          // } catch (_) {
          //   // Error already reported by AsyncErrorHandler
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
        ?.find((col) => this.resolveColumnField(col) === this.tableParams.filter[0]?.field)

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
      // } else {
      //   const newColumns = this.props.columns.map((col) => {
      //     if (col.name === column.name) {
      //       return {
      //         ...col,
      //         visible: false,
      //         is_visible: false,
      //       }
      //     }

      //     return col
      //   })

      //   this.props.updateColumns(
      //     newColumns,
      //     this.props.response?.data?.data?.fe_req,
      //     this.props.response?.data?.data?.available_selects,
      //   )

      setColumnVisibility({ ...this.props.authentication, columns: newColumns }).catch((error) => {
        console.error(error)
      })
      this.summaryStats = this.summaryStatsCalculator.calculate(this.props)
      this.lifecycleManager.safeForceUpdate()
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
      this.summaryStats = this.summaryStatsCalculator.calculate(this.props)
      this.lifecycleManager.safeForceUpdate()
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
        content={
          <div className='more-options-menu' data-test='react-autoql-toolbar-more-options'>
            <ul className='context-menu-list'>
              <li onClick={() => this.onFreezeColumnClick(this.state.contextMenuColumn)}>
                <Icon type={this.isColumnFrozen(this.state.contextMenuColumn) ? 'unlock' : 'lock'} />
                {this.isColumnFrozen(this.state.contextMenuColumn) ? 'Unfreeze Column' : 'Freeze Column'}
              </li>
              {!!this.state.contextMenuColumn?.custom && !this.state.contextMenuColumn?.has_window_func && (
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
        }
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
        const hasAxisOptions = this.props.pivotAxisOptions?.length > 1

        this.props.columns.forEach((col, i) => {
          if (i === 0) {
            // First column is the pivot row header - add titleFormatter for axis selector
            const pivotCol = { ...col }
            if (hasAxisOptions) {
              pivotCol.titleFormatter = (cell) => this.buildPivotAxisTitleElement(col)
            }
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
        const filteredColumns = this.props.columns.map((col, index) => {
          // Create a safe copy of the column with essential properties
          const newCol = {
            index,
          }

          if (col.field) {
            newCol.field = col.field
          } else if (col.name) {
            newCol.field = col.name.replace(/\s+/g, '_').toLowerCase()
          } else if (col.display_name) {
            newCol.field = col.display_name.replace(/\s+/g, '_').toLowerCase()
          } else {
            newCol.field = `column_${index}`
          }

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

  buildPivotAxisTitleElement = (col) => {
    return buildPivotAxisTitleElement(col, (element) => this.openPivotAxisSelectorForElement(element))
  }

  renderPivotTableRowWarning = () => {
    if (!this.props.pivot) {
      return null
    }

    if (
      (this.useInfiniteScroll && isDataLimited(this.props.response)) ||
      this.props.pivotTableRowsLimited ||
      this.props.pivotTableColumnsLimited
    ) {
      const rowLimit = this.props.response?.data?.data?.row_limit
      const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
      const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)
      const chartElementLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(MAX_CHART_ELEMENTS)
      const totalRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(
        this.props.response?.data?.data?.count_rows,
      )
      const totalPivotRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(this.props.totalRows)
      const totalPivotColumnsFormatted = new Intl.NumberFormat(languageCode, {}).format(this.props.totalColumns)

      let content
      let tooltipContent

      if (this.useInfiniteScroll && isDataLimited(this.props.response)) {
        tooltipContent = `To optimize performance, this pivot table is limited to the initial <em>${rowLimitFormatted}/${totalRowsFormatted}</em> rows of the original dataset.`
      } else if (this.props.pivotTableRowsLimited && this.props.pivotTableColumnsLimited) {
        content = 'Rows and Columns have been limited!'
        tooltipContent = `To optimize performance, this pivot table has been limited to the first <em>${this.props.maxColumns}/${totalPivotColumnsFormatted}</em> columns and <em>${chartElementLimitFormatted}/${totalPivotRowsFormatted}</em> rows of data.`
      } else if (this.props.pivotTableRowsLimited) {
        content = 'Rows have been limited!'
        tooltipContent = `To optimize performance, this pivot table has limited to the first <em>${chartElementLimitFormatted}/${totalPivotRowsFormatted}</em> rows of data.`
      } else if (this.props.pivotTableColumnsLimited) {
        content = 'Columns have been limited!'
        tooltipContent = `To optimize performance, this pivot table has been limited to the first <em>${this.props.maxColumns}/${totalPivotColumnsFormatted}</em> columns.`
      }

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

  getColumnIndexMapping = (tabulatorColumns) => {
    const mapping = []
    const reorderedColumns = []

    for (const tabulatorCol of tabulatorColumns) {
      const originalIndex = this.compatOriginalIndex(tabulatorCol)
      if (typeof originalIndex === 'number' && originalIndex >= 0 && this.props.columns?.[originalIndex]) {
        mapping.push(originalIndex)
        reorderedColumns.push({ ...this.props.columns[originalIndex] })
      }
    }

    return { mapping, reorderedColumns }
  }

  reorderResponseData = (response, columnIndexMapping) => {
    const newResponse = _cloneDeep(response)

    if (newResponse.data?.data?.rows) {
      // Build a mapping from the original column index (props.columns index)
      // to the response row index. Prefer exact index, otherwise try to
      // match by column name/display_name/field. This keeps rows aligned
      // even when response.columns ordering or presence differs.
      const responseColumns = newResponse.data.data.columns || []
      const responseIndexForOriginal = columnIndexMapping.map((originalIndex) => {
        if (typeof originalIndex === 'number' && responseColumns[originalIndex]) {
          return originalIndex
        }
        const propsCol = this.props?.columns?.[originalIndex]
        if (!propsCol) return originalIndex
        const matchIndex = responseColumns.findIndex((c) => {
          return (
            c?.name === propsCol.name ||
            c?.display_name === propsCol.display_name ||
            c?.field === propsCol.field ||
            c?.name === propsCol.field ||
            String(c?.field) === String(originalIndex) ||
            String(c?.name) === String(propsCol.name)
          )
        })
        return matchIndex >= 0 ? matchIndex : originalIndex
      })

      newResponse.data.data.rows = newResponse.data.data.rows.map((row) =>
        responseIndexForOriginal.map((respIdx) => row[respIdx]),
      )
    }

    if (newResponse.data?.data?.columns) {
      const responseColumns = newResponse.data.data.columns || []
      // Rebuild response.columns in visual order. For each original index
      // try to use the response column at that index, otherwise match by
      // field/name/display_name to find the correct response column.
      newResponse.data.data.columns = columnIndexMapping.map((originalIndex) => {
        if (typeof originalIndex === 'number' && responseColumns[originalIndex]) return responseColumns[originalIndex]
        const propsCol = this.props?.columns?.[originalIndex]
        if (propsCol) {
          const match = responseColumns.find((c) => {
            return (
              c?.name === propsCol.name ||
              c?.display_name === propsCol.display_name ||
              c?.field === propsCol.field ||
              String(c?.field) === String(propsCol.field) ||
              String(c?.name) === String(propsCol.name)
            )
          })
          if (match) return match
          // If no match, fall back to constructing a minimal response-shaped object
          return {
            display_name: propsCol.display_name || propsCol.title || propsCol.field || String(originalIndex),
            name: propsCol.name || propsCol.field || String(originalIndex),
            type: propsCol.type || 'STRING',
            is_visible: typeof propsCol.visible === 'boolean' ? propsCol.visible : true,
            groupable: propsCol.groupable,
            aggType: propsCol.aggType,
          }
        }
        // Last resort: return a minimal placeholder object
        return { display_name: String(originalIndex), name: String(originalIndex), type: 'STRING', is_visible: true }
      })
    }

    return newResponse
  }

  resetTableState = () => {
    this.tableParams.filter = []
    this.tableParams.sort = []
  }

  // Method to prepare the table for filtering after column movement
  prepareForFilterAfterColumnMove = () => {
    if (!this.ref?.tabulator || !this.columnMapping || !this.columnMapping.length) return

    try {
      // Store the current scroll position
      const columnElement = this.ref.tabulator.columnManager.element
      const rowElement = this.ref.tabulator.rowManager.element
      const columnScrollLeft = columnElement.scrollLeft
      const rowScrollLeft = rowElement.scrollLeft

      // Get current columns and their definitions
      const visibleColumns = this.ref.tabulator.getColumns()
      if (!Array.isArray(visibleColumns) || !visibleColumns.length) return

      // Update column indexes if they don't match the current visual order
      if (this.props.columns) {
        // Create a mapping of field names to their current visual positions
        const fieldPositions = {}
        visibleColumns.forEach((col) => {
          const field = this.resolveColumnField(col)
          if (!field) return
          fieldPositions[field] = this.compatVisualPosition(col, visibleColumns)
        })

        // Update indexes in the columns array to match their current positions
        // Create new objects to avoid mutating props directly
        const updatedColumns = (this.props.columns || []).map((col) => {
          const pos = fieldPositions[col.field]
          return pos !== undefined ? { ...col, index: pos } : col
        })

        // If columns changed, update them
        if (!_isEqual(updatedColumns, this.props.columns) && this.props.updateColumns) {
          this.props.updateColumns(updatedColumns)
        }
      }

      // Force a complete redraw to ensure UI consistency
      this.ref.tabulator.redraw(true)

      // Restore scroll positions
      columnElement.scrollLeft = columnScrollLeft
      rowElement.scrollLeft = rowScrollLeft
    } catch (error) {
      console.error('Error preparing for filter after column move:', error)
    }
  }

  onColumnMoved = (column, columns) => {
    const validColumns = Array.isArray(columns) && columns.length ? columns : this.props.columns || []
    if (!validColumns.length || !this.props.updateColumnsAndData) return
    try {
      const { mapping, reorderedColumns } = this.getColumnIndexMapping(validColumns)
      if (reorderedColumns.length !== this.props.columns.length || !this.props.response) return
      reorderedColumns.forEach((col, newIndex) => {
        col.index = newIndex
      })
      this.columnMapping = mapping
      this.persistentColumnMapping = [...mapping]
      this.savePersistedMappings(mapping, this.storedColumnMapping)
      const newResponse = this.reorderResponseData(this.props.response, mapping)

      this.tableParams.sort = []
      if (newResponse && !Array.isArray(newResponse)) {
        this.props.updateColumnsAndData(newResponse)
        setTimeout(() => {
          if (!this.columnMapping || this.columnMapping.length === 0) this.columnMapping = mapping
        }, 0)
      }
    } catch (error) {
      console.error('Error updating column order:', error)
    }
    if (this.props.keepScrolledRight) this.scrollToRight()
    // If the updateColumnsAndData call triggered an unmount of this
    // component (common when parent replaces the table), avoid
    // performing further work that may call setState on an
    // unmounted component. Check `_isMounted` before proceeding.
    if (this._isMounted) {
      this.setHeaderInputEventListeners()
      this.forceUpdate()
    }
  }

  onColumnResized = (column) => {
    if (this.props.keepScrolledRight) {
      this.scrollToRight()
    }
  }

  getFirstVisibleColumnIndex = (columns) => {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].visible !== false && columns[i].is_visible !== false) {
        return i
      }
    }
    return 0
  }

  getVisibleColumns = (columns) => {
    return columns.filter((col) => col.visible !== false && col.is_visible !== false)
  }

  isSingleColumnTable = () => {
    return this.getVisibleColumns(this.props.columns || []).length === 1
  }

  renderTableRowCount = () => {
    if (this.isTableEmpty()) {
      return null
    }

    const totalRowCount = this.props.pivot
      ? this.originalQueryData?.length
      : this.tableParams?.filter?.length > 0 && this.filterCount > 0
      ? this.filterCount
      : this.props.response?.data?.data?.count_rows

    if (!totalRowCount) {
      return null
    }

    let currentRowCount = totalRowCount
    const tableHolder = this.tableContainer?.querySelector('.tabulator-tableholder')
    const firstRow = this.tableContainer?.querySelector('.tabulator-row')

    if (tableHolder && firstRow) {
      const scrollTop = this.state.scrollTop ?? tableHolder.scrollTop ?? 0
      const rowHeight = firstRow.offsetHeight || 0
      const containerHeight = tableHolder.clientHeight || 0

      if (rowHeight > 0) {
        const visibleRows = Math.ceil((scrollTop + containerHeight) / rowHeight)
        currentRowCount = Math.min(visibleRows, totalRowCount)
      }
    }

    const languageCode = getDataFormatting(this.props.dataFormatting).languageCode
    const currentRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(currentRowCount)
    const totalRowsFormatted = new Intl.NumberFormat(languageCode, {}).format(totalRowCount)
    const rowLimit = this.props.response?.data?.data?.row_limit ?? MAX_DATA_PAGE_SIZE
    const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(rowLimit)

    return (
      <div className='table-row-count'>
        <span>
          {`Scrolled ${currentRowsFormatted} / ${
            totalRowCount > rowLimit ? rowLimitFormatted + '+' : totalRowsFormatted
          } rows`}
        </span>
      </div>
    )
  }

  renderHeaderTooltipContent = ({ content }) => {
    try {
      const column = this.parseTooltipContent(content)
      if (!column) return null

      const tooltipProps = this.extractTooltipProps(column)
      return this.renderTooltipSections(tooltipProps)
    } catch (error) {
      console.error('Error in renderHeaderTooltipContent:', error)
      return null
    }
  }

  parseTooltipContent = (content) => {
    if (!content) return null

    try {
      if (typeof content === 'string') {
        return JSON.parse(content)
      }
      return content
    } catch (err) {
      try {
        const unescaped = typeof content === 'string' ? content.replace(/&quot;/g, '"') : content
        return JSON.parse(unescaped)
      } catch (e) {
        return null
      }
    }
  }

  extractTooltipProps = (column) => {
    const name = column.display_name || column.title || column.field || 'Unknown Column'
    const altName = column.title && column.title !== name ? column.title : null
    const type = COLUMN_TYPES[column?.type]?.description
    const icon = COLUMN_TYPES[column?.type]?.icon

    const columnIndex =
      typeof column.index === 'number' ? column.index : column.index ? parseInt(column.index, 10) : null

    const stats =
      columnIndex !== null && !isNaN(columnIndex) && this.summaryStats ? this.summaryStats[columnIndex] : null

    return { column, name, altName, type, icon, stats }
  }

  renderTooltipSections = ({ column, name, altName, type, icon, stats }) => {
    return (
      <div>
        {this.renderTooltipTitle(name, altName)}
        {this.renderTooltipType(type, icon)}
        {this.renderTooltipFormula(column)}
        {this.renderTooltipStats(column, stats)}
      </div>
    )
  }

  renderTooltipTitle = (name, altName) => (
    <div className='selectable-table-tooltip-title'>
      <span>
        {name}
        {altName && ` (${altName})`}
      </span>
    </div>
  )

  renderTooltipType = (type, icon) => {
    if (!type) return null

    return (
      <div className='selectable-table-tooltip-section selectable-table-tooltip-subtitle'>
        {icon && <Icon type={icon} />}
        <span>{type}</span>
      </div>
    )
  }

  renderTooltipFormula = (column) => {
    if (!column.fnSummary) return null

    return (
      <div className='selectable-table-tooltip-section'>
        <span>
          <strong>Custom formula:</strong>
          <span> = {column.fnSummary}</span>
        </span>
      </div>
    )
  }

  renderTooltipStats = (column, stats) => {
    if (!stats) return null

    const isQuantityColumn = isColumnSummable(column)
    const isDateColumn = column.type === ColumnTypes.DATE

    return (
      <>
        {isQuantityColumn && stats.sum !== undefined && this.renderStatSection('Total', stats.sum, column)}
        {isQuantityColumn && stats.avg !== undefined && this.renderStatSection('Average', stats.avg, column)}
        {isDateColumn &&
          stats.min !== null &&
          stats.min !== undefined &&
          this.renderStatSection('Earliest', stats.min, column)}
        {isDateColumn &&
          stats.max !== null &&
          stats.max !== undefined &&
          this.renderStatSection('Latest', stats.max, column)}
      </>
    )
  }

  renderStatSection = (label, value, column) => {
    const formatted =
      typeof value === 'number'
        ? formatElement({ element: value, column, config: getDataFormatting(this.props.dataFormatting) })
        : value
    return (
      <div className='selectable-table-tooltip-section'>
        <span>
          <strong>{label}: </strong>
          <span>{formatted}</span>
        </span>
      </div>
    )
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

  getTableContainerClasses = (isEmpty) => {
    const classes = ['react-autoql-table-container']

    if (this.isSingleColumnTable()) classes.push('single-column')
    if (this.state.pageLoading || !this.state.tabulatorMounted) classes.push('loading')
    if (getAutoQLConfig(this.props.autoQLConfig)?.enableDrilldowns) {
      classes.push('supports-drilldown')
    } else {
      classes.push('disable-drilldown')
    }
    if (this.state.isFiltering) classes.push('filtering')
    if (this.props.isAnimating) classes.push('animating')
    if (this.useInfiniteScroll) classes.push('infinite')
    else classes.push('limited')
    if (this.useInfiniteScroll && this.state.isLastPage) classes.push('last-page')
    if (this.props.pivot) classes.push('pivot')
    if (this.props.hidden) classes.push('hidden')
    if (isEmpty) classes.push('empty')

    return classes.join(' ')
  }

  render = () => {
    const isEmpty = this.isTableEmpty()

    let summaryRow = null

    // Shared logic for both table types
    let colWidths = []
    let columns = this.props.columns || []
    let summaryStats = []
    // Prefer visual column order from Tabulator when available so summary
    // totals track moved columns. `columns` is the canonical list (original
    // order), but Tabulator may present a different visual order after
    // drag-and-drop. Build `visualColumns` and a mapping back to original
    // indices so summaryStats align with what the user sees.
    let visualColumns = columns
    let scrollRef = null
    let isPivot = this.props.pivot && columns && this.props.data && this.props.data.length > 0
    let isRegular = !this.props.pivot && columns && this.props.response?.data?.data?.rows?.length > 0

    if (isPivot || isRegular) {
      const statsObject = this.summaryStatsCalculator.calculate(this.props, this.ref)
      // Build visual order directly from Tabulator to ensure moved columns are reflected
      if (this.ref?.tabulator && Array.isArray(this.ref.tabulator.getColumns)) {
        const tabCols = this.ref.tabulator.getColumns()
        if (tabCols && tabCols.length > 0) {
          visualColumns = []
          summaryStats = []
          tabCols.forEach((tabCol) => {
            const field = tabCol.getField?.() || tabCol.field
            // Find the column in current props.columns by field
            const colIndex = columns.findIndex((c) => c.field === field)
            if (colIndex >= 0 && columns[colIndex]) {
              visualColumns.push(columns[colIndex])
              // Look up stats by field for stability across reordering
              const stats =
                statsObject[field] ||
                statsObject[colIndex] ||
                statsObject[String(field)] ||
                statsObject[String(colIndex)] ||
                null
              summaryStats.push(stats)
            }
          })
        }
      }
      // Fall back to original order if Tabulator unavailable
      if (visualColumns.length === 0 || summaryStats.length === 0) {
        visualColumns = columns
        summaryStats = columns.map(
          (col, idx) =>
            statsObject[col.field] ||
            statsObject[idx] ||
            statsObject[String(col.field)] ||
            statsObject[String(idx)] ||
            null,
        )
      }

      const hasVisibleSummable = columns.some((col, i) => {
        return (
          col.visible !== false &&
          col.is_visible !== false &&
          (col.type === 'QUANTITY' || col.type === 'NUMBER' || isColumnSummable(col))
        )
      })

      if (hasVisibleSummable) {
        if (!this.summaryScrollRef) {
          this.summaryScrollRef = React.createRef()
        }
        scrollRef = this.summaryScrollRef
        if (this.ref?.tabulator) {
          const tabCols = this.ref.tabulator.getColumns()
          // Build colWidths in the same visual order as visualColumns and summaryStats
          colWidths = tabCols.map((col, idx) => {
            const el = col.getElement()
            return el ? el.offsetWidth : 100
          })
          if (!this._summaryResizeListenerAdded) {
            this.ref.tabulator.on('columnResized', () => {
              if (this._isMounted) {
                this.lifecycleManager.safeForceUpdate()
              }
            })
            this._summaryResizeListenerAdded = true
          }
        } else {
          // If no Tabulator, use original column widths
          colWidths = visualColumns.map((col, idx) => col.width || 100)
        }

        setTimeout(() => {
          if (!this._isMounted) return
          if (this.ref?.tabulator && scrollRef?.current) {
            const tableHolder = this.ref.tabulator.rowManager?.element
            const summaryHolder = scrollRef.current
            if (tableHolder && summaryHolder && !summaryHolder._scrollSynced) {
              tableHolder.addEventListener('scroll', () => {
                if (summaryHolder.scrollLeft !== tableHolder.scrollLeft) {
                  summaryHolder.scrollLeft = tableHolder.scrollLeft
                }
              })
              summaryHolder.addEventListener('scroll', () => {
                if (tableHolder.scrollLeft !== summaryHolder.scrollLeft) {
                  tableHolder.scrollLeft = summaryHolder.scrollLeft
                }
              })
              summaryHolder._scrollSynced = true
            }
          }
        }, 0)

        // Use visualColumns (Tabulator order) for rendering the summary so
        // totals follow moved columns. `columnsForSummary` is aligned with
        // `colWidths` and `summaryStats` computed above.
        const columnsForSummary = visualColumns

        summaryRow = (
          <div
            className={`custom-summary-row${isPivot ? ' pivot-summary-row' : ''}`}
            style={{ width: '100%', overflowX: 'auto', fontFamily: 'inherit', fontSize: '11px' }}
            ref={scrollRef}
          >
            {React.Children.toArray([
              this.summaryRowRenderer?.render('total', columnsForSummary, summaryStats, colWidths, isPivot),
              this.summaryRowRenderer?.render('average', columnsForSummary, summaryStats, colWidths, isPivot),
            ])}
          </div>
        )
      }
    }

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-table-container-${this.TABLE_ID}`}
          ref={(ref) => (this.tableContainer = ref)}
          data-test='react-autoql-table'
          style={this.props.style}
          className={this.getTableContainerClasses(isEmpty)}
        >
          {this.renderPivotTableRowWarning()}
          <div ref={(r) => (this.tabulatorContainer = r)} className='react-autoql-tabulator-container'>
            {!!this.props.response?.data?.data?.rows &&
              !!this.props.columns &&
              (this.props.autoHeight || !this.state.firstRender) && (
                <>
                  <TableWrapper
                    ref={(r) => (this.ref = r)}
                    height={this.initialTableHeight}
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
                    onColumnMoved={(...args) => this.onColumnMoved(...args)}
                    onColumnResized={(...args) => this.onColumnResized(...args)}
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
          {summaryRow}
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
