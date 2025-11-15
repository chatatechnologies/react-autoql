import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _isEmpty from 'lodash.isempty'
import _cloneDeep from 'lodash.clonedeep'
import dayjs from '../../js/dayjsWithPlugins'

import { TABULATOR_LOCAL_ROW_LIMIT, TOOLTIP_COPY_TEXTS } from '../../js/Constants'

import {
  AggTypes,
  sendSuggestion,
  runDrilldown,
  runQueryOnly,
  getSupportedDisplayTypes,
  getNumberColumnIndices,
  isDisplayTypeValid,
  getDefaultDisplayType,
  onlyUnique,
  formatElement,
  makeEmptyArray,
  getGroupBysFromPivotTable,
  getGroupBysFromTable,
  isTableType,
  isChartType,
  areAllColumnsHidden,
  sortDataByDate,
  sortDataByColumn,
  filterDataByColumn,
  dateSortFn,
  getDayJSObj,
  getNumberOfGroupables,
  deepEqual,
  isSingleValueResponse,
  removeElementAtIndex,
  isListQuery,
  GENERAL_QUERY_ERROR,
  REQUEST_CANCELLED_ERROR,
  isColumnNumberType,
  getDateColumnIndex,
  getStringColumnIndices,
  isAggregation,
  isColumnDateType,
  isColumnStringType,
  getColumnTypeAmounts,
  MONTH_NAMES,
  DEFAULT_DATA_PAGE_SIZE,
  CHART_TYPES,
  MAX_LEGEND_LABELS,
  getColumnDateRanges,
  getFilterPrecision,
  getPrecisionForDayJS,
  dataFormattingDefault,
  autoQLConfigDefault,
  authenticationDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  isDataLimited,
  MAX_CHART_ELEMENTS,
  formatAdditionalSelectColumn,
  setColumnVisibility,
  ColumnTypes,
  isColumnIndexConfigValid,
  getCleanColumnName,
  isDrilldown,
  CustomColumnTypes,
  formatFiltersForTabulator,
  formatSortersForTabulator,
  DisplayTypes,
  isSelectableNumberColumn,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { ChataTable } from '../ChataTable'
import { AddColumnBtn } from '../AddColumnBtn'
import { ChataChart } from '../Charts/ChataChart'
import { ReverseTranslation } from '../ReverseTranslation'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { QueryValidationMessage } from '../QueryValidationMessage'

import { withTheme } from '../../theme'
import { dataFormattingType, autoQLConfigType, authenticationType } from '../../props/types'

import './QueryOutput.scss'

export class QueryOutput extends React.Component {
  constructor(props) {
    super(props)
    this.minWidth = props.minWidth || 400
    const isChart = typeof isChartType === 'function' && isChartType(this.getDisplayTypeFromInitial(props))
    this.minHeight = 300
    this.resizeMultiplier = props.resizeMultiplier || 1.5
    this.COMPONENT_KEY = uuid()
    this.QUERY_VALIDATION_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-query-output-chart-tooltip-${this.COMPONENT_KEY}`
    this.ALLOW_NUMERIC_STRING_COLUMNS = true
    this.MAX_PIVOT_TABLE_COLUMNS = 50

    this.originalLegendState = {
      hiddenLegendLabels: [],
      isEditing: false,
    }

    let response = props.queryResponse
    this.queryResponse = response
    this.columnDateRanges = getColumnDateRanges(response)
    this.queryID = this.queryResponse?.data?.data?.query_id
    this.interpretation = this.queryResponse?.data?.data?.parsed_interpretation
    this.tableParams = {
      filter: props?.initialTableParams?.filter || [],
      sort: props?.initialTableParams?.sort || [],
      page: props?.initialTableParams?.page || 1,
    }
    this.tableID = uuid()
    this.pivotTableID = uuid()
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    this.isOriginalData = true
    this.renderComplete = false
    this.hasCalledInitialTableConfigChange = false

    const additionalSelects = this.getAdditionalSelectsFromResponse(this.queryResponse)
    const columns = this.formatColumnsForTable(
      this.queryResponse?.data?.data?.columns,
      additionalSelects,
      props.initialAggConfig,
    )
    const customColumnSelects = this.getUpdatedCustomColumnSelects(additionalSelects, columns)

    // Supported display types may have changed after initial data generation
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()

    // Sort data if data is local
    this.sortLocalData(response, columns, props?.initialFormattedTableParams)

    const displayType = this.getDisplayTypeFromInitial(props)
    if (props.onDisplayTypeChange) {
      props.onDisplayTypeChange(displayType)
    }

    // Set initial config if needed
    // If this config causes errors, it will be reset when the error occurs
    if (props.initialTableConfigs?.tableConfig) {
      const isValid = this.isTableConfigValid(props.initialTableConfigs?.tableConfig, columns, displayType)

      if (isValid) {
        const { tableConfig } = props.initialTableConfigs
        this.tableConfig = _cloneDeep(tableConfig)
      }
    }

    this.generateAllData()

    // Set initial table params to be any filters that
    // are already present in the current query
    // Note: We handle sorting ourselves, so we don't pass sorters to Tabulator
    this.formattedTableParams = {
      filters: props?.initialFormattedTableParams?.filters || [],
      sorters: [],
    }

    this.DEFAULT_TABLE_PAGE_SIZE = 100
    this.shouldEnableResize = props.enableResizing && isChart
    this.state = {
      displayType,
      aggConfig: props.initialAggConfig,
      supportedDisplayTypes: this.initialSupportedDisplayTypes,
      columns,
      selectedSuggestion: props.defaultSelectedSuggestion,
      columnChangeCount: 0,
      chartID: uuid(),
      customColumnSelects: customColumnSelects || [],
      height: props.height || `${this.minHeight}px`,
      isResizing: false,
      resizeStartY: 0,
      resizeStartHeight: 0,
      isResizable: this.shouldEnableResize,
      hiddenLegendLabels: [],
      legendStateByChart: {},
      originalLegendState: this.originalLegendState,
    }
    this.updateMaxConstraints()
  }

  // Wrap getNumberColumnIndices to prefer an existing secondary index when inferring defaults.
  getNumberColumnIndicesWithPreferred = (
    columns,
    isPivot = false,
    defaultAmountColumn = undefined,
    preferredSecondIndex = undefined,
  ) => {
    const cols = columns || this.getColumns() || []
    const result = getNumberColumnIndices(cols, isPivot, defaultAmountColumn) || {}

    // Local pure normalizer: returns a new result object with preferred index applied
    const normalize = (res, allCols, preferred) => {
      const origAll = Array.isArray(res.allNumberColumnIndices) ? [...res.allNumberColumnIndices] : []
      const origPrimary = Array.isArray(res.numberColumnIndices) ? [...res.numberColumnIndices] : []
      const origSecondary = Array.isArray(res.numberColumnIndices2) ? [...res.numberColumnIndices2] : []

      const validIndex = (i) => Number.isInteger(i) && allCols[i] && isSelectableNumberColumn(allCols[i])

      let out = { ...res }

      // apply preferred secondary index when valid
      if (preferred != null) {
        const p = Number(preferred)
        if (Number.isInteger(p) && p >= 0 && p < allCols.length && isSelectableNumberColumn(allCols[p])) {
          if (out.numberColumnIndex !== p) {
            out = {
              ...out,
              numberColumnIndex2: p,
              numberColumnIndices2: [p],
              allNumberColumnIndices: Array.from(new Set([...(origAll || []), p])),
            }
          }
        }
      }

      const filteredAll = (out.allNumberColumnIndices ?? []).filter(validIndex)
      const filteredPrimary = (out.numberColumnIndices ?? []).filter(validIndex)
      const filteredSecondary = (out.numberColumnIndices2 ?? []).filter(validIndex)

      const final = {
        ...out,
        allNumberColumnIndices: filteredAll.length ? filteredAll : origAll,
        numberColumnIndices: filteredPrimary.length ? filteredPrimary : origPrimary,
        numberColumnIndices2: filteredSecondary.length ? filteredSecondary : origSecondary,
      }

      if (typeof final.numberColumnIndex === 'number' && !validIndex(final.numberColumnIndex)) {
        final.numberColumnIndex = final.numberColumnIndices?.[0] ?? undefined
      }
      if (typeof final.numberColumnIndex2 === 'number' && !validIndex(final.numberColumnIndex2)) {
        final.numberColumnIndex2 = final.numberColumnIndices2?.[0] ?? undefined
      }

      return final
    }

    return normalize(result, cols, preferredSecondIndex)
  }

  // Find and set a sensible fallback for second-axis number column when current selections are removed.
  findAndSetFallbackNumberColumnIndex2 = (excludedIndices = [], preferred) => {
    const candidates =
      this.getNumberColumnIndicesWithPreferred(
        this.getColumns(),
        this.usePivotDataForChart(),
        this.queryResponse?.data?.data?.default_amount_column,
        preferred,
      )?.allNumberColumnIndices || []

    const fallback = candidates.find(
      (i) =>
        i !== undefined && i !== null && !excludedIndices.includes(i) && isSelectableNumberColumn(this.getColumns()[i]),
    )

    if (fallback !== undefined && fallback >= 0) {
      this.tableConfig.numberColumnIndex2 = fallback
      this.tableConfig.numberColumnIndices2 = [fallback]
      return fallback
    }
    return undefined
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    initialTableConfigs: PropTypes.shape({}),
    initialAggConfig: PropTypes.shape({}),

    queryResponse: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    initialDisplayType: PropTypes.string,
    onQueryValidationSelectOption: PropTypes.func,
    autoSelectQueryValidationSuggestion: PropTypes.bool,
    queryValidationSelections: PropTypes.arrayOf(PropTypes.shape({})),
    renderSuggestionsAsDropdown: PropTypes.bool,
    defaultSelectedSuggestion: PropTypes.string,
    reverseTranslationPlacement: PropTypes.string,
    activeChartElementKey: PropTypes.string,
    preferredDisplayType: PropTypes.string,
    isResizing: PropTypes.bool,
    enableDynamicCharting: PropTypes.bool,
    onTableConfigChange: PropTypes.func,
    onAggConfigChange: PropTypes.func,
    onNoneOfTheseClick: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onRTValueLabelClick: PropTypes.func,
    isTaskModule: PropTypes.bool,
    onDrilldownStart: PropTypes.func,
    onDrilldownEnd: PropTypes.func,
    enableTableSorting: PropTypes.bool,
    showSingleValueResponseTitle: PropTypes.bool,
    allowColumnAddition: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    showQueryInterpretation: PropTypes.bool,
    useInfiniteScroll: PropTypes.bool,
    subjects: PropTypes.arrayOf(PropTypes.shape({})),

    mutable: PropTypes.bool,
    showSuggestionPrefix: PropTypes.bool,
    onDisplayTypeChange: PropTypes.func,
    onColumnChange: PropTypes.func,
    shouldRender: PropTypes.bool,
    dataPageSize: PropTypes.number,
    onPageSizeChange: PropTypes.func,
    allowDisplayTypeChange: PropTypes.bool,
    onMount: PropTypes.func,
    onBucketSizeChange: PropTypes.func,
    bucketSize: PropTypes.number,
    onNewData: PropTypes.func,
    onCustomColumnUpdate: PropTypes.func,
    enableTableContextMenu: PropTypes.bool,
    initialFormattedTableParams: PropTypes.shape({}),
    onUpdateFilterResponse: PropTypes.func,
    enableResizing: PropTypes.bool,
    isEditing: PropTypes.bool,
    minHeight: PropTypes.number,
    maxHeight: PropTypes.number,
    resizeMultiplier: PropTypes.number,
    onResize: PropTypes.func,
    localRTFilterResponse: PropTypes.shape({}),
    enableCustomColumns: PropTypes.bool,
    preferRegularTableInitialDisplayType: PropTypes.bool,
    drilldownFilters: PropTypes.arrayOf(PropTypes.shape({})),
    enableChartControls: PropTypes.bool,
    initialChartControls: PropTypes.shape({
      showAverageLine: PropTypes.bool,
      showRegressionLine: PropTypes.bool,
    }),
    onChartControlsChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    initialTableConfigs: undefined,
    initialAggConfig: undefined,

    queryResponse: undefined,
    initialDisplayType: null,
    onSuggestionClick: undefined,
    autoSelectQueryValidationSuggestion: true,
    queryValidationSelections: undefined,
    renderSuggestionsAsDropdown: false,
    defaultSelectedSuggestion: undefined,
    reverseTranslationPlacement: 'bottom',
    activeChartElementKey: undefined,
    useInfiniteScroll: undefined,
    isResizing: false,
    enableDynamicCharting: true,
    onNoneOfTheseClick: undefined,
    autoChartAggregations: true,
    showQueryInterpretation: false,
    isTaskModule: false,
    enableTableSorting: true,
    preferredDisplayType: undefined,
    onRTValueLabelClick: undefined,
    mutable: true,
    showSuggestionPrefix: true,
    shouldRender: true,
    dataPageSize: undefined,
    allowDisplayTypeChange: true,
    showSingleValueResponseTitle: false,
    bucketSize: undefined,
    allowColumnAddition: false,
    enableTableContextMenu: true,
    subjects: [],
    initialFormattedTableParams: undefined,
    isEditing: false,
    onTableConfigChange: () => {},
    onAggConfigChange: () => {},
    onQueryValidationSelectOption: () => {},
    onErrorCallback: () => {},
    onDrilldownStart: () => {},
    onDrilldownEnd: () => {},
    onColumnChange: () => {},
    onPageSizeChange: () => {},
    onMount: () => {},
    onBucketSizeChange: () => {},
    onNewData: () => {},
    onCustomColumnUpdate: () => {},
    onUpdateFilterResponse: () => {},
    onTableParamsChange: () => {},
    enableResizing: false,
    minHeight: 300,
    maxHeight: undefined,
    resizeMultiplier: 1.5,
    onResize: () => {},
    localRTFilterResponse: undefined,
    enableCustomColumns: true,
    preferRegularTableInitialDisplayType: false,
    drilldownFilters: undefined,
    enableChartControls: true,
    initialChartControls: {
      showAverageLine: false,
      showRegressionLine: false,
    },
    onChartControlsChange: () => {},
  }

  sortLocalData = (response, columns, initialFormattedTableParams) => {
    // Sort data if data is local (count_rows < TABULATOR_LOCAL_ROW_LIMIT)
    // If initialFormattedTableParams.sorters exist, use those; otherwise sort by first visible column
    if (
      response?.data?.data?.count_rows < TABULATOR_LOCAL_ROW_LIMIT &&
      columns &&
      columns.length > 0 &&
      response?.data?.data?.rows &&
      response.data.data.rows.length > 0
    ) {
      const initialSorters = initialFormattedTableParams?.sorters || []

      if (initialSorters.length > 0) {
        // Sort by initial sorters
        let sortedData = response.data.data.rows
        for (const sorter of initialSorters) {
          const columnIndex = columns.findIndex((col) => col.field === sorter.field)
          if (columnIndex !== -1) {
            sortedData = sortDataByColumn(sortedData, columns, columnIndex, sorter.dir || 'asc')
          }
        }
        response.data.data.rows = sortedData
      } else {
        // Sort by first visible column ascending
        const firstVisibleColumn = columns.find((col) => col.is_visible !== false)
        if (firstVisibleColumn) {
          const columnIndex = columns.findIndex((col) => col.field === firstVisibleColumn.field)
          if (columnIndex !== -1) {
            response.data.data.rows = sortDataByColumn(response.data.data.rows, columns, columnIndex, 'asc')
          }
        }
      }
    }
  }

  makeEmptyArrayShared(w, h, value) {
    const hasValue = arguments.length >= 3
    const cellValue = hasValue ? value : ''
    const arr = []
    for (let i = 0; i < h; i++) {
      arr[i] = []
      for (let j = 0; j < w; j++) {
        arr[i][j] = cellValue
      }
    }
    return arr
  }

  componentDidMount = () => {
    try {
      this._isMounted = true
      this.updateToolbars()
      this.props.onMount()
      if (this.shouldEnableResize) {
        document.addEventListener('mousemove', this.handleMouseMove)
        document.addEventListener('mouseup', this.handleMouseUp)
        window.addEventListener('resize', this.handleWindowResize)
        this.updateMaxConstraints()
      }
      this.forceUpdate()
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback?.(error)
    }
  }

  handleLegendVisibilityChange = (hiddenLabels) => {
    const currentType = this.state.displayType
    this.setState({
      hiddenLegendLabels: hiddenLabels,
      legendStateByChart: {
        ...this.state.legendStateByChart,
        [currentType]: hiddenLabels,
      },
    })
  }

  handleLegendClick = (label) => {
    const { hiddenLegendLabels, legendStateByChart, displayType } = this.state
    const isHidden = hiddenLegendLabels.includes(label)
    const newHiddenLabels = isHidden ? hiddenLegendLabels.filter((l) => l !== label) : [...hiddenLegendLabels, label]

    this.setState({
      hiddenLegendLabels: newHiddenLabels,
      legendStateByChart: {
        ...legendStateByChart,
        [displayType]: newHiddenLabels,
      },
    })
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!this.props.shouldRender && !nextProps.shouldRender) {
      return false
    }

    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    if (!this.props.queryResponse && !this.queryResponse) {
      return false
    }

    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      const newState = {}
      let shouldForceUpdate = false

      if (this.state.displayType !== prevState.displayType) {
        const isChart = isChartType(this.state.displayType)
        const shouldEnableResize = this.props.enableResizing && isChart

        if (shouldEnableResize !== this.shouldEnableResize) {
          this.shouldEnableResize = shouldEnableResize

          if (shouldEnableResize) {
            document.addEventListener('mousemove', this.handleMouseMove)
            document.addEventListener('mouseup', this.handleMouseUp)
            window.addEventListener('resize', this.handleWindowResize)
            this.updateMaxConstraints()
          } else {
            document.removeEventListener('mousemove', this.handleMouseMove)
            document.removeEventListener('mouseup', this.handleMouseUp)
            window.removeEventListener('resize', this.handleWindowResize)
          }

          this.setState({ isResizable: shouldEnableResize })
        }
      }

      if (this.state.isResizing !== prevState.isResizing) {
        if (!this.state.isResizing && prevState.isResizing) {
          setTimeout(() => {
            this.refreshLayout()
          }, 50)
        }
      }

      if (prevProps.isEditing !== this.props.isEditing) {
        if (this.props.isEditing) {
          this.originalLegendState = {
            hiddenLegendLabels: [...this.state.hiddenLegendLabels],
            isEditing: true,
          }
        } else {
          this.setState({
            hiddenLegendLabels: this.originalLegendState.hiddenLegendLabels,
          })
        }
      }

      if (this.state.displayType !== prevState.displayType) {
        const { legendStateByChart } = this.state
        const updatedLegendStateByChart = {
          ...legendStateByChart,
          [prevState.displayType]: this.state.hiddenLegendLabels,
        }

        const newChartLegendState = updatedLegendStateByChart[this.state.displayType] || []

        this.setState(
          {
            hiddenLegendLabels: newChartLegendState,
            legendStateByChart: updatedLegendStateByChart,
          },
          () => this.props.onDisplayTypeChange?.(this.state.displayType),
        )

        // If new number column indices conflict, reset table config to resolve the arrays
        // The config should stay the same as much as possible while removing the overlapping indices
        if (!this.isTableConfigValid(this.tableConfig, this.state.columns, this.state.displayType)) {
          this.setTableConfig()
        }
      }
      // If initial data config was changed here, tell the parent
      if (
        !_isEqual(this.props.initialTableConfigs, {
          tableConfig: this.tableConfig,
          pivotTableConfig: this.pivotTableConfig,
        }) &&
        this.props.onTableConfigChange &&
        !this.hasCalledInitialTableConfigChange
      ) {
        this.hasCalledInitialTableConfigChange = true
        this.onTableConfigChange()
      }

      if (!_isEqual(this.state.aggConfig, prevState.aggConfig)) {
        this.props.onAggConfigChange(this.state.aggConfig)
      }

      // If columns changed, regenerate data if necessary
      // If table filtered or columns changed, regenerate pivot data and supported display types
      // Using a count variable so it doesn't have to deep compare on every udpate
      const columnsChanged = this.state.columnChangeCount !== prevState.columnChangeCount
      if (columnsChanged) {
        this.tableID = uuid()
        const dataConfig = {
          tableConfig: this.tableConfig,
          pivotTableConfig: this.pivotTableConfig,
        }

        this.props.onColumnChange(
          this.queryResponse?.data?.data?.fe_req?.display_overrides,
          this.state.columns,
          this.queryResponse?.data?.data?.fe_req?.additional_selects,
          this.queryResponse,
          dataConfig,
          this.queryResponse?.data?.data?.fe_req?.session_filter_locks,
        )

        if (this.shouldGeneratePivotData()) {
          this.generatePivotData({
            isFirstGeneration: true,
            dataChanged: true,
          })
          shouldForceUpdate = true
        }

        const newSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
        if (!_isEqual(newSupportedDisplayTypes, this.state.supportedDisplayTypes)) {
          newState.supportedDisplayTypes = newSupportedDisplayTypes
        } else {
          shouldForceUpdate = true
        }
      }

      if (
        !_isEqual(this.state.supportedDisplayTypes, prevState.supportedDisplayTypes) &&
        !this.isCurrentDisplayTypeValid()
      ) {
        newState.displayType = this.getUpdatedDefaultDisplayType('table')
      }

      setTimeout(() => {
        this.updateToolbars()
      }, 0)

      if (!_isEmpty(newState)) {
        this.setState(newState)
      } else if (shouldForceUpdate) {
        this.forceUpdate()
      }
    } catch (error) {
      console.error(error)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('mouseleave', this.handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('resize', this.handleWindowResize)
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout)
    }
  }

  updateMaxConstraints = () => {
    if (!this.props.enableResizing) return

    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    this.maxWidth = this.props.maxWidth || Math.floor(windowWidth * 0.9)
    this.maxHeight = this.props.maxHeight || Math.floor(windowHeight * 0.9)

    this.maxWidth = Math.max(this.maxWidth, this.minWidth)
    this.maxHeight = Math.max(this.maxHeight, this.minHeight)
  }

  handleWindowResize = () => {
    this.updateMaxConstraints()
  }
  handleResizeStart = (e) => {
    if (!this.props.enableResizing) return

    e.preventDefault()
    this.updateMaxConstraints()

    const rect = this.responseContainerRef?.getBoundingClientRect()

    this.setState({
      isResizing: true,
      resizeStartY: e.clientY,
      resizeStartHeight: rect?.height || this.minHeight,
    })

    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mouseup', this.handleMouseUp)

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  handleMouseMove = (e) => {
    if (!this.state.isResizing || !this.props.enableResizing) return

    const deltaY = (e.clientY - this.state.resizeStartY) * this.resizeMultiplier
    const isChart = isChartType(this.state.displayType)
    const effectiveMinHeight = isChart ? this.minHeight : 80
    const newHeight = Math.min(this.maxHeight, Math.max(effectiveMinHeight, this.state.resizeStartHeight + deltaY))

    this.setState({
      height: `${newHeight}px`,
    })

    if (!this.resizeTimeout) {
      this.resizeTimeout = setTimeout(() => {
        this.refreshLayout()
        this.resizeTimeout = null
      }, 16)
    }

    this.props.onResize({ height: newHeight })
  }
  handleMouseUp = () => {
    if (this.state.isResizing) {
      this.setState({ isResizing: false }, () => {
        this.refreshLayout()
      })
    }

    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('mouseleave', this.handleMouseUp)

    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.mozUserSelect = ''
    document.body.style.msUserSelect = ''
  }

  refreshLayout = () => {
    if (this.chartRef) {
      this.chartRef?.adjustChartPosition()
    }

    if (this.tableRef?._isMounted) {
      this.tableRef.forceUpdate()
    }

    if (this.pivotTableRef?._isMounted) {
      this.pivotTableRef.forceUpdate()
    }
  }

  onTableConfigChange = (initialized = true) => {
    const tableConfig = _cloneDeep(this.tableConfig)
    const pivotTableConfig = _cloneDeep(this.pivotTableConfig)

    this.props.onTableConfigChange({
      tableConfig: tableConfig,
      pivotTableConfig: pivotTableConfig,
    })
  }

  findDefaultNumberColumnIndex = (defaultAmountColumn) => {
    return this.tableConfig.allNumberColumnIndices?.find((index) => {
      return (
        isColumnNumberType(this.queryResponse.data.data.columns[index]) &&
        defaultAmountColumn?.length > 0 &&
        this.queryResponse.data.data.columns[index]?.name === defaultAmountColumn
      )
    })
  }

  getNumberColumnIndex = (foundIndex) => {
    return foundIndex
      ? foundIndex
      : this.tableConfig.numberColumnIndices.length > 0
      ? this.tableConfig.numberColumnIndices[0]
      : 0
  }

  checkAndUpdateTableConfigs = (displayType) => {
    // Check if table configs are still valid for new display type
    const isTableConfigValid = this.isTableConfigValid(this.tableConfig, this.getColumns(), displayType)

    if (!isTableConfigValid) {
      this.setTableConfig()
    }

    if (this.currentlySupportsPivot()) {
      const isPivotTableConfigValid = this.isTableConfigValid(
        this.pivotTableConfig,
        this.pivotTableColumns,
        displayType,
      )
      if (!isPivotTableConfigValid) {
        this.resetPivotTableConfig()
      }
    }
  }

  changeDisplayType = (displayType, callback) => {
    this.checkAndUpdateTableConfigs(displayType)
    this.setState({ displayType }, () => {
      if (typeof callback === CustomColumnTypes.FUNCTION) {
        callback()
      }
    })
  }

  displayTypeInvalidWarning = (displayType) => {
    console.warn(
      `Initial display type "${this.props.initialDisplayType}" provided is not valid for this dataset. Using ${
        displayType || this.state.displayType
      } instead.`,
    )
  }

  getAdditionalSelectsFromResponse = (response) => {
    return response?.data?.data?.fe_req?.additional_selects
  }

  getDisplayOverridesFromResponse = (response) => {
    return response?.data?.data?.fe_req?.display_overrides
  }

  getDataLength = () => {
    return this.tableData?.length
  }

  getPivotDataLength = () => {
    return this.state?.visiblePivotRows ? this.state?.visiblePivotRows?.length : this.pivotTableData?.length
  }

  getUpdatedDefaultDisplayType = (preferredDisplayType) => {
    return getDefaultDisplayType(
      this.props.queryResponse,
      this.props.autoChartAggregations,
      this.getColumns(),
      this.getDataLength(),
      this.getPivotDataLength(),
      preferredDisplayType,
      isDataLimited(this.queryResponse),
      this.props.preferRegularTableInitialDisplayType,
    )
  }

  getDisplayTypeFromInitial = (props) => {
    // Set the initial display type based on prop value, response, and supported display types
    // Start by setting the displayType to the provided initialDisplayType prop value
    let displayType = props.initialDisplayType
    const defaultDisplayType = this.getUpdatedDefaultDisplayType(this.props.preferredDisplayType)

    // If prop is not provided, use default display type
    if (!displayType) {
      displayType = defaultDisplayType
    }
    // If prop is provided, but it isn't supported by the dataset, use default display type
    else if (
      !isDisplayTypeValid(
        props.queryResponse,
        displayType,
        this.tableData?.length,
        this.pivotTableData?.length,
        this.getColumns(),
        isDataLimited(this.queryResponse),
      )
    ) {
      displayType = defaultDisplayType
    }

    return displayType
  }

  hasError = (response) => {
    try {
      const referenceIdNumber = Number(response?.data?.reference_id?.split('.')[2])
      if (referenceIdNumber >= 200 && referenceIdNumber < 300) {
        return false
      }
    } catch (error) {
      console.error(error)
    }
    return true
  }

  getColumns = () => {
    if (this._isMounted) {
      return this.state.columns
    }

    return this.formatColumnsForTable(
      this.queryResponse?.data?.data?.columns,
      this.getAdditionalSelectsFromResponse(this.queryResponse),
    )
  }

  currentlySupportsCharts = () => {
    const chartDisplayTypes = this.getCurrentSupportedDisplayTypes().filter((displayType) =>
      CHART_TYPES.includes(displayType),
    )
    const supportsCharts = !!chartDisplayTypes?.length
    return supportsCharts
  }

  currentlySupportsPivot = () => {
    const currentDisplayTypes = this.getCurrentSupportedDisplayTypes()
    return currentDisplayTypes?.includes('pivot_table')
  }

  potentiallySupportsPivot = () => {
    const potentialDisplayTypes = this.getPotentialDisplayTypes()
    return potentialDisplayTypes?.includes('pivot_table')
  }

  potentiallySupportsDatePivot = () => {
    const columns = this.getColumns()
    return this.potentiallySupportsPivot() && getNumberOfGroupables(columns) === 1
  }

  usePivotDataForChart = () => {
    return this.potentiallySupportsPivot() && !this.potentiallySupportsDatePivot()
  }

  numberIndicesArraysOverlap = (tableConfig) => {
    return (
      tableConfig.numberColumnIndices.length &&
      tableConfig.numberColumnIndices2.length &&
      (tableConfig.numberColumnIndices.filter((index) => tableConfig.numberColumnIndices2.includes(index)).length ||
        tableConfig.numberColumnIndices2.filter((index) => tableConfig.numberColumnIndices.includes(index)).length)
    )
  }

  isTableConfigValid = (tableConfig, columns, displayType) => {
    return isColumnIndexConfigValid({
      response: this.queryResponse,
      columnIndexConfig: tableConfig ?? this.tableConfig,
      columns: columns ?? this.getColumns(),
      displayType: displayType ?? this.state.displayType,
    })
  }

  updateFilters = (filters, prevColumns, newColumns) => {
    try {
      const newFilters = _cloneDeep(filters)
      for (let i = 0; i < filters?.length; i++) {
        const filterColumn = prevColumns?.find((col) => {
          return col?.field === filters[i]?.field
        })

        const newFilterColumn = newColumns?.find((col) => {
          return col?.name?.trim() === filterColumn?.name?.trim()
        })
        newFilters[i] = {
          ...filters[i],
          field: newFilterColumn?.field,
        }
      }

      this.tableParams.filter = newFilters
    } catch (error) {
      console.error(error)
    }
  }

  updateColumnsAndData = (response) => {
    if (response && this._isMounted) {
      this.pivotTableID = uuid()
      this.isOriginalData = false
      this.queryResponse = response
      this.tableData = response?.data?.data?.rows || []

      const additionalSelects = this.getAdditionalSelectsFromResponse(response)
      const newColumns = this.formatColumnsForTable(response?.data?.data?.columns, additionalSelects)
      const customColumnSelects = this.getUpdatedCustomColumnSelects(additionalSelects, newColumns)

      this.updateFilters(this.tableParams.filter, this.state.columns, newColumns)

      this.resetTableConfig(newColumns)

      const aggConfig = this.getAggConfig(newColumns)

      // If data is a single value, change display type to table
      let displayType = this.state.displayType
      if (this.state.displayType === 'single-value' && !isSingleValueResponse(this.queryResponse)) {
        displayType = DisplayTypes.TABLE
      } else if (this.state.displayType !== 'single-value' && isSingleValueResponse(this.queryResponse)) {
        displayType = 'single-value'
      }

      this.setState((prevState) => ({
        columns: newColumns,
        columnChangeCount: prevState.columnChangeCount + 1,
        chartID: uuid(),
        aggConfig,
        customColumnSelects,
        displayType,
      }))
    }
  }

  updateColumns = (columns, feReq, availableSelects) => {
    if (columns && this._isMounted) {
      const newColumns = this.formatColumnsForTable(columns, feReq?.additional_selects)

      const visibleColumnsChanged = !_isEqual(
        newColumns?.filter((col) => col.is_visible).map((col) => col.name),
        this.state.columns?.filter((col) => col.is_visible).map((col) => col.name),
      )

      if (visibleColumnsChanged) {
        if (this.queryResponse?.data?.data?.columns) {
          if (feReq) {
            this.queryResponse.data.data.fe_req = feReq
          }
          if (availableSelects) {
            this.queryResponse.data.data.available_selects = availableSelects
          }
          this.queryResponse.data.data.columns = newColumns
        }
        this.resetTableConfig(newColumns)
      }

      // Determine appropriate display type based on column visibility
      let displayType = this.state.displayType
      const visibleColumns = newColumns?.filter((col) => col.is_visible) || []

      if (isSingleValueResponse(this.queryResponse)) {
        // Single visible column AND single row (or no data) → single-value display
        displayType = 'single-value'
      } else if (displayType === DisplayTypes.TABLE && visibleColumns.length === 0) {
        // All columns hidden → show text
        displayType = 'text'
      } else if (displayType === 'text' && visibleColumns.length > 0) {
        // Multiple visible columns → table display
        displayType = 'table'
      }

      this.setState({
        columns: newColumns,
        aggConfig: this.getAggConfig(newColumns),
        columnChangeCount: this.state.columnChangeCount + 1,
        chartID: visibleColumnsChanged ? uuid() : this.state.chartID,
        displayType,
      })
    }
  }

  getUpdatedCustomColumnSelects = (additionalSelects, columns) => {
    const customColumnSelects = []
    for (let i = 0; i < columns?.length; i++) {
      const foundCustomSelect = additionalSelects?.find((select) => {
        return select?.columns?.[0]?.replace(/ /g, '') === columns?.[i].name?.replace(/ /g, '')
      })
      if (foundCustomSelect) {
        customColumnSelects.push({ id: columns[i].id, ...foundCustomSelect })
      }
    }
    return customColumnSelects
  }

  generateAllData = () => {
    if (this.queryResponse?.data?.data) {
      // Generate new table data from new columns
      // todo: do we really need this or can we just not display the hidden columns
      if (this.shouldGenerateTableData()) {
        this.generateTableData()
        if (this.shouldGeneratePivotData()) {
          this.generatePivotData({
            isFirstGeneration: true,
          })
        }
      }
    }
  }

  shouldGeneratePivotData = () => {
    return this.tableData && this.potentiallySupportsPivot()
  }

  shouldGenerateTableData = () => {
    return !!this.queryResponse?.data?.data?.rows
  }

  generateTableData = (cols, newTableData) => {
    if (newTableData) {
      this.tableData = newTableData
    } else {
      const columns = cols || this.getColumns()
      this.tableData = this.queryResponse?.data?.data?.rows

      // Only set table config if no valid initial config was provided AND this is during mount
      const isDuringMount = !this._isMounted
      const displayType = this.state?.displayType || this.getDisplayTypeFromInitial(this.props)
      const hasValidInitialConfig =
        isDuringMount &&
        this.props.initialTableConfigs?.tableConfig &&
        this.isTableConfigValid(this.props.initialTableConfigs.tableConfig, columns, displayType)

      if (!hasValidInitialConfig) {
        this.setTableConfig()
      }

      if (this._isMounted) {
        this.setState({ columns })
      }
    }
  }

  generatePivotData = ({ isFirstGeneration, dataChanged } = {}) => {
    try {
      this.pivotTableID = uuid()
      const columns = this.getColumns()
      const numGroupables = getNumberOfGroupables(columns)

      if (numGroupables === 1) {
        this.generateDatePivotData(this.tableData)
      } else {
        this.generatePivotTableData({ isFirstGeneration })
      }
    } catch (error) {
      console.error('Error generating pivot data', error)
      this.props.onErrorCallback?.(error)
      this.pivotTableData = undefined
    }

    if (this.props.allowDisplayTypeChange) {
      this.pivotTableRef?.updateData(this.pivotTableData)
    }

    if (dataChanged && this._isMounted) {
      this.setState({
        visiblePivotRowChangeCount: this.state.visiblePivotRowChangeCount + 1,
        chartID: uuid(), // Force chart to re-render with new pivot data
      })
    }
  }

  renderSuggestionMessage = (suggestions, queryId) => {
    let suggestionListMessage

    try {
      suggestionListMessage = (
        <div className='react-autoql-suggestion-message' data-test='suggestion-message-container'>
          <div className='react-autoql-suggestions-container'>
            {this.props.showSuggestionPrefix && (
              <div className='react-autoql-suggestion-message-prefix'>
                I want to make sure I understood your query. Did you mean:
              </div>
            )}
            {this.props.renderSuggestionsAsDropdown ? (
              <select
                key={uuid()}
                onChange={(e) => {
                  if (this._isMounted) {
                    this.setState({ selectedSuggestion: e.target.value })
                    this.onSuggestionClick({
                      query: e.target.value,
                      source: ['suggestion'],
                      queryId,
                    })
                  }
                }}
                value={this.state.selectedSuggestion}
                className='react-autoql-suggestions-select'
              >
                {suggestions.map((suggestion, i) => {
                  return (
                    <option key={uuid()} value={suggestion}>
                      {suggestion}
                    </option>
                  )
                })}
              </select>
            ) : (
              suggestions.map((suggestion) => {
                return (
                  <div key={uuid()} data-test='suggestion-list-button'>
                    <button
                      onClick={() =>
                        this.onSuggestionClick({
                          query: suggestion,
                          isButtonClick: true,
                          source: ['suggestion'],
                          queryId,
                          scope: this.props.scope,
                        })
                      }
                      className='react-autoql-suggestion-btn'
                    >
                      {suggestion}
                    </button>
                    <br />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )
    } catch (error) {
      return (
        <div className='react-autoql-suggestion-message'>
          Sorry something went wrong, I have no suggestions for you.
        </div>
      )
    }

    if (this.props.renderFullSuggestionMessage) {
      return (
        <div style={{ textAlign: 'center' }}>
          {this.renderError(this.queryResponse)}
          {suggestionListMessage}
        </div>
      )
    }
    return suggestionListMessage
  }

  renderSingleValueResponse = () => {
    let column, columnIndex

    // If there's only 1 column, use it regardless of is_visible status
    if (this.state.columns?.length === 1) {
      column = this.state.columns[0]
      columnIndex = 0
    } else {
      // If multiple columns, search for the visible one (existing logic)
      column = this.state.columns?.filter((col) => col.is_visible)?.[0]
      columnIndex = this.state.columns?.findIndex((col) => col.is_visible)
    }

    return (
      <div className='single-value-response-flex-container'>
        <div className='single-value-response-container'>
          <a
            className={`single-value-response ${
              getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? ' with-drilldown' : ''
            }`}
            onClick={() => {
              this.processDrilldown({ groupBys: [], supportedByAPI: true })
            }}
          >
            {this.props.showSingleValueResponseTitle && (
              <span>
                <strong>{column?.display_name}: </strong>
              </span>
            )}
            {formatElement({
              element: this.queryResponse.data.data.rows[columnIndex]?.[0] ?? 0,
              column,
              config: getDataFormatting(this.props.dataFormatting),
            })}
          </a>
        </div>
      </div>
    )
  }

  copyTableToClipboard = () => {
    if (this.state.displayType === 'table' && this.tableRef?._isMounted) {
      this.tableRef.copyToClipboard()
    } else if (this.state.displayType === 'pivot_table' && this.pivotTableRef?._isMounted) {
      this.pivotTableRef.copyToClipboard()
    }
  }

  getBase64Data = () => {
    if (this.chartRef && isChartType(this.state.displayType)) {
      return this.chartRef.getBase64Data().then((data) => {
        const trimmedData = data.split(',')[1]
        return Promise.resolve(trimmedData)
      })
    } else if (this.tableRef?._isMounted && this.state.displayType === 'table') {
      const data = this.tableRef.getBase64Data()
      return Promise.resolve(data)
    } else if (this.pivotTableRef?._isMounted && this.state.displayType === 'pivot_table') {
      const data = this.pivotTableRef.getBase64Data()
      return Promise.resolve(data)
    }

    return undefined
  }

  saveChartAsPNG = () => {
    if (this.chartRef) {
      this.chartRef.saveAsPNG()
    }
  }
  handleQueryFnError = (error) => {
    if (error?.data?.message === REQUEST_CANCELLED_ERROR) {
      return this.queryResponse
    } else {
      return error
    }
  }

  queryFn = async (args = {}) => {
    const queryRequestData = this.queryResponse?.data?.data?.fe_req

    // Update formattedTableParams with current state from ChataTable before processing
    if (args?.tableFilters || args?.orders) {
      this.formattedTableParams = {
        ...this.formattedTableParams,
        filters: args?.tableFilters || [],
        sorters: args?.orders || [],
      }
    }

    const allFilters = this.getCombinedFilters(args?.tableFilters)

    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    this.setState({ isLoadingData: true })

    const sessionFilters =
      queryRequestData?.session_filter_locks ||
      (this.props.scope === 'dashboards' ? this.initialFormattedTableParams?.sessionFilters : [])
    let response

    if (isDrilldown(this.queryResponse)) {
      try {
        response = await runDrilldown({
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          source: this.props.source,
          scope: this.props.scope,
          translation: queryRequestData?.translation,
          filters: sessionFilters,
          pageSize: queryRequestData?.page_size,
          test: queryRequestData?.test,
          groupBys: queryRequestData?.columns,
          query: queryRequestData?.text,
          queryID: this.props.originalQueryID,
          orders: this.formattedTableParams?.sorters,
          cancelToken: this.axiosSource.token,
          ...args,
          tableFilters: allFilters,
        })
      } catch (error) {
        response = this.handleQueryFnError(error)
        console.error(error)
      }
    } else {
      try {
        response = await runQueryOnly({
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          query: queryRequestData?.text,
          translation: queryRequestData?.translation,
          userSelection: queryRequestData?.disambiguation,
          filters: sessionFilters,
          test: queryRequestData?.test,
          pageSize: queryRequestData?.page_size,
          orders: this.formattedTableParams?.sorters,
          source: this.props.source,
          scope: this.props.scope,
          cancelToken: this.axiosSource.token,
          newColumns: queryRequestData?.additional_selects,
          displayOverrides: queryRequestData?.display_overrides,
          ...args,
          tableFilters: allFilters,
        })
      } catch (error) {
        response = this.handleQueryFnError(error)
        console.error(error)
      }
    }

    this.setState({ isLoadingData: false })

    return response
  }

  getFilterDrilldown = ({ stringColumnIndex, row }) => {
    try {
      const filteredRows = this.tableData?.filter((origRow) => {
        return `${origRow[stringColumnIndex]}` === `${row[stringColumnIndex]}`
      })

      const drilldownResponse = _cloneDeep(this.queryResponse)
      drilldownResponse.data.data.rows = filteredRows
      drilldownResponse.data.data.count_rows = filteredRows.length
      return drilldownResponse
    } catch (error) {
      console.error(error)
    }
  }

  getFilterDrilldownWithOr = ({ stringColumnIndices, rows }) => {
    try {
      // Filter rows where ANY of the column/value pairs match (OR logic)
      const filteredRows = this.tableData?.filter((origRow) => {
        return stringColumnIndices.some((colIndex, i) => {
          const row = rows[i]
          return `${origRow[colIndex]}` === `${row[colIndex]}`
        })
      })

      const drilldownResponse = _cloneDeep(this.queryResponse)
      drilldownResponse.data.data.rows = filteredRows
      drilldownResponse.data.data.count_rows = filteredRows.length
      return drilldownResponse
    } catch (error) {
      console.error(error)
    }
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  processDrilldown = async ({ groupBys, supportedByAPI, row, activeKey, stringColumnIndex, filter, useOrLogic }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      try {
        // This will be a new query so we want to reset the page size back to default
        const pageSize = this.getDefaultQueryPageSize()

        if (supportedByAPI) {
          this.props.onDrilldownStart(activeKey)
          try {
            const allFilters = this.getCombinedFilters()
            const response = await runDrilldown({
              ...getAuthentication(this.props.authentication),
              ...getAutoQLConfig(this.props.autoQLConfig),
              queryID: this.queryID,
              source: this.props.source,
              groupBys,
              pageSize,
              tableFilters: allFilters, // Include existing filters
            })
            this.props.onDrilldownEnd({
              response,
              originalQueryID: this.queryID,
              drilldownFilters: allFilters,
            })
          } catch (error) {
            this.props.onDrilldownEnd({ response: error, drilldownFilters: [] })
          }
        } else if ((!isNaN(stringColumnIndex) && !!row?.length) || filter) {
          this.props.onDrilldownStart(activeKey)

          let clickedFilter = filter
          if (!filter) {
            clickedFilter = this.constructFilter({
              column: this.state.columns[stringColumnIndex],
              value: row[stringColumnIndex],
            })
          }

          let response
          // If useOrLogic is true, filter client-side with OR logic
          if (useOrLogic && clickedFilter?.useOrLogic && clickedFilter?.stringColumnIndices && clickedFilter?.rows) {
            // For OR logic, filter client-side instead of sending to backend
            // Use setTimeout to show loading state, just like other filter drilldowns
            setTimeout(() => {
              response = this.getFilterDrilldownWithOr({
                stringColumnIndices: clickedFilter.stringColumnIndices,
                rows: clickedFilter.rows,
              })
              this.props.onDrilldownEnd({
                response,
                originalQueryID: this.queryID,
                drilldownFilters: [],
              })
            }, 800)
          } else {
            // Normal AND logic - combine filters and send to backend
            const filtersToCombine = Array.isArray(clickedFilter) ? clickedFilter : [clickedFilter]
            const allFilters = this.getCombinedFilters(filtersToCombine)
            try {
              response = await this.queryFn({ tableFilters: allFilters, pageSize })
            } catch (error) {
              response = error
            }
            this.props.onDrilldownEnd({
              response,
              originalQueryID: this.queryID,
              drilldownFilters: allFilters,
            })
          }
        }
      } catch (error) {
        console.error(error)
        this.props.onDrilldownEnd({ error: 'Error processing drilldown' })
      }
    }
  }

  // Function to get a filter properly formatted for the request based on the column type
  constructFilter = ({ column, value }) => {
    let formattedValue = value
    let operator = '='
    let column_type

    if (formattedValue === null) {
      formattedValue = 'NULL'
      operator = 'is'
    } else if (column?.type === ColumnTypes.DATE) {
      const isoDate = getDayJSObj({ value, column, config: this.props.dataFormatting })
      const precision = getPrecisionForDayJS(column.precision)
      const isoDateStart = isoDate.startOf(precision).toISOString()
      const isoDateEnd = isoDate.endOf(precision).toISOString()

      formattedValue = `${isoDateStart},${isoDateEnd}`
      operator = 'between'
      column_type = 'TIME'
    } else if (isColumnNumberType(column)) {
      formattedValue = `${value}`
    }

    return {
      name: column.name,
      operator,
      value: formattedValue,
      column_type,
    }
  }

  // Function to combine original query filters and current table filters
  getCombinedFilters = (newFilters = []) => {
    const tableFilters = this.formattedTableParams?.filters || []
    const allFilters = [...tableFilters]

    // Include the drilldown filters if they exist
    if (this.props.drilldownFilters && this.props.drilldownFilters.length > 0) {
      this.props.drilldownFilters.forEach((drilldownFilter) => {
        const existingDrilldownFilterIndex = allFilters.findIndex((filter) => filter.name === drilldownFilter.name)
        if (existingDrilldownFilterIndex >= 0) {
          // Filter already exists, overwrite existing filter with drilldown value
          allFilters[existingDrilldownFilterIndex] = drilldownFilter
        } else {
          // Filter didn't exist yet, add it to the list
          allFilters.push(drilldownFilter)
        }
      })
    }

    // Include new filters if they exist
    if (newFilters && newFilters.length > 0) {
      newFilters.forEach((newFilter) => {
        // Normal filter (AND logic)
        const existingFilterIndex = allFilters.findIndex((filter) => filter.name === newFilter.name)
        if (existingFilterIndex >= 0) {
          // Filter already exists, overwrite existing filter with new value
          allFilters[existingFilterIndex] = newFilter
        } else {
          // Filter didn't exist yet, add it to the list
          allFilters.push(newFilter)
        }
      })
    }

    return allFilters.map((filter) => {
      const foundColumn = this.getColumns()?.find((column) => column.name === filter.name)
      return {
        ...filter,
        columnName: foundColumn?.title,
      }
    })
  }

  onTableCellClick = (cell) => {
    if (cell?.getColumn()?.getDefinition()?.pivot) {
      return
    }

    const columns = this.getColumns()
    if (!columns) {
      return
    }

    let groupBys = {}
    if (this.pivotTableColumns && this.state.displayType === 'pivot_table') {
      if (!cell?.getValue?.()) {
        return
      }

      if (this.potentiallySupportsDatePivot()) {
        // Date pivot table
        const dateColumnIndex = getDateColumnIndex(columns)
        const year = cell.getColumn()?.getDefinition()?.title
        const month = cell.getData()?.[0]
        const value = this.pivotOriginalColumnData?.[year]?.[month]

        groupBys = [
          {
            name: columns[dateColumnIndex]?.name,
            drill_down: columns[dateColumnIndex]?.drill_down,
            value,
          },
        ]
      } else {
        // Regular pivot table
        const columnHeaderDefinition = columns[this.tableConfig.legendColumnIndex]
        const rowHeaderDefinition = columns[this.tableConfig.stringColumnIndex]
        groupBys = getGroupBysFromPivotTable({
          cell,
          rowHeaders: this.pivotRowHeaders,
          columnHeaders: this.pivotColumnHeaders,
          rowHeaderDefinition,
          columnHeaderDefinition,
        })
      }
    } else {
      // Regular table
      groupBys = getGroupBysFromTable(cell, columns)
    }

    if (!!groupBys?.length) {
      this.processDrilldown({ groupBys: groupBys ?? [], supportedByAPI: true })
    }
  }

  onChartClick = ({
    row,
    columnIndex,
    columns,
    stringColumnIndex,
    legendColumn,
    activeKey,
    filter,
    filters,
    stringColumnIndices,
    rows,
    useOrLogic,
  }) => {
    // Support for multiple filters (e.g., network graph links with source and target filters)
    if (filters && Array.isArray(filters) && filters.length > 0) {
      return this.processDrilldown({
        supportedByAPI: false,
        activeKey,
        filter: filters,
      })
    }

    // Support for multiple columns with rows (e.g., network graph links, or nodes that are both sender and receiver)
    if (
      stringColumnIndices &&
      Array.isArray(stringColumnIndices) &&
      rows &&
      Array.isArray(rows) &&
      stringColumnIndices.length === rows.length
    ) {
      // If useOrLogic is true, pass the data needed for client-side OR filtering
      if (useOrLogic) {
        return this.processDrilldown({
          supportedByAPI: false,
          activeKey,
          filter: {
            stringColumnIndices,
            rows,
            useOrLogic: true,
          },
          useOrLogic: true,
        })
      }

      // Normal AND logic for links - construct filters and send to backend
      const constructedFilters = stringColumnIndices.map((colIndex, i) => {
        const row = rows[i]
        return this.constructFilter({
          column: this.state.columns[colIndex],
          value: row[colIndex],
        })
      })
      return this.processDrilldown({
        supportedByAPI: false,
        activeKey,
        filter: constructedFilters,
        useOrLogic: false,
      })
    }

    if (filter) {
      return this.processDrilldown({
        supportedByAPI: false,
        activeKey,
        filter,
      })
    }

    // todo: do we need to provide all those params or can we grab them from this component?
    const drilldownData = {}
    const groupBys = []

    const column = columns[columnIndex]

    const stringColumn = columns?.[stringColumnIndex]?.origColumn || columns?.[stringColumnIndex]

    if (columns?.[stringColumnIndex]?.datePivot) {
      const year = Number(columns?.[columnIndex]?.name)
      const month = row?.[stringColumnIndex]
      const value = `${this.pivotOriginalColumnData?.[year]?.[month]}`

      groupBys.push({
        name: stringColumn.name,
        drill_down: stringColumn.drill_down,
        value,
      })
    } else if (stringColumn?.groupable) {
      groupBys.push({
        name: stringColumn.name,
        drill_down: stringColumn.drill_down,
        value: `${row?.[stringColumnIndex]}`,
      })
    }

    if (legendColumn?.groupable) {
      if (column.origColumn) {
        // It is pivot data, add extra groupby
        groupBys.push({
          name: legendColumn.name,
          drill_down: legendColumn.drill_down,
          value: `${column?.name}`,
        })
      }
    }

    drilldownData.data = groupBys
    drilldownData.supportedByAPI = !!groupBys.length
    this.processDrilldown({
      groupBys,
      supportedByAPI: !!groupBys.length,
      row,
      activeKey,
      stringColumnIndex,
    })
  }

  updateToolbars = () => {
    this.updateVizToolbar()
    this.updateOptionsToolbar()
  }

  updateVizToolbar = () => {
    if (this.props.vizToolbarRef?._isMounted) {
      this.props.vizToolbarRef.updateDisplayTypes(this.getCurrentSupportedDisplayTypes(), this.state.displayType)
    }
  }

  updateOptionsToolbar = () => {
    if (this.props.optionsToolbarRef?._isMounted) {
      this.props.optionsToolbarRef.forceUpdate()
    }
  }

  isFilteringTable = () => {
    return this.tableRef?._isMounted && this.tableRef.state.isFiltering
  }

  getTabulatorHeaderFilters = () => {
    return this.tableRef?._isMounted && this.tableRef.getTabulatorHeaderFilters()
  }

  // Resolves a Tabulator header filter field to its corresponding column index in the columns array.
  resolveHeaderFilterColumnIndex = (field, columns) => {
    if (field === undefined || field === null) return undefined
    const parsed = parseInt(field, 10)
    if (!isNaN(parsed)) return parsed
    return columns.find((col) => col.field === field || col.id === field)?.index
  }

  toggleTableFilter = (filterOn, scrollToFirstFilteredColumn) => {
    if (this.state.displayType === 'table') {
      return this.tableRef?._isMounted && this.tableRef.toggleIsFiltering(filterOn, scrollToFirstFilteredColumn)
    }

    if (this.state.displayType === 'pivot_table') {
      return (
        this.pivotTableRef?._isMounted && this.pivotTableRef.toggleIsFiltering(filterOn, scrollToFirstFilteredColumn)
      )
    }
  }

  onTableParamsChange = (params, formattedTableParams = {}) => {
    this.tableParams = _cloneDeep(params)
    this.formattedTableParams = formattedTableParams

    this.props.onTableParamsChange?.(this.tableParams, this.formattedTableParams)

    // Regenerate pivot data when table params change (filters/sorters)
    if (this.shouldGeneratePivotData()) {
      this.generatePivotData()
    }

    // This will update the filter badge in OptionsToolbar
    setTimeout(() => {
      this.updateToolbars()
    }, 0)
  }

  onNewData = (response) => {
    this.isOriginalData = false
    this.queryResponse = response
    this.tableData = response?.data?.data?.rows || []

    if (this.shouldGeneratePivotData()) {
      this.generatePivotData()
    }

    this.props.onNewData()

    if (this.props.scope === 'dashboards') {
      const dataConfig = {
        tableConfig: this.tableConfig,
        pivotTableConfig: this.pivotTableConfig,
      }
      this.props.onColumnChange(
        response?.data?.data?.fe_req?.display_overrides,
        this.state.columns,
        response?.data?.data?.fe_req?.additional_selects,
        response,
        dataConfig,
        response?.data?.data?.fe_req?.session_filter_locks,
      )
    }

    this.setState({ chartID: uuid() })
  }

  isValidSorter = (sorter) => {
    return sorter && typeof sorter === 'object' && sorter.field !== undefined && typeof sorter.dir === 'string'
  }

  formatSorter = (sorter) => ({
    field: sorter.field,
    dir: sorter.dir,
  })

  updateFormattedTableParams = (validSorters) => {
    this.formattedTableParams = {
      ...this.formattedTableParams,
      sorters: validSorters,
    }
  }

  resetSorting = () => {
    this.tableParams.sort = []
    this.formattedTableParams = {
      ...this.formattedTableParams,
      sorters: [],
    }
  }

  onLegendClick = (d) => {
    d?.label && this.handleLegendClick(d.label)

    if (!d) {
      // no-op when no legend item provided
      return
    }

    const columnIndex = d?.columnIndex
    const usePivotData = this.usePivotDataForChart()
    const newColumns = usePivotData ? _cloneDeep(this.pivotTableColumns) : _cloneDeep(this.state.columns)
    if (!newColumns?.length) {
      return
    }

    newColumns[columnIndex].isSeriesHidden = !newColumns[columnIndex].isSeriesHidden

    if (usePivotData) {
      this.pivotTableColumns = newColumns
      this.forceUpdate()
    } else {
      const formattedColumns = this.formatColumnsForTable(
        newColumns,
        this.getAdditionalSelectsFromResponse(this.queryResponse),
      )
      this.setState({ columns: formattedColumns })
    }
  }

  onChangeStringColumnIndex = (index) => {
    if (index < 0) {
      return
    }

    const cols = this.getColumns()
    const rowsExist = !!(this.tableData?.length || this.queryResponse?.data?.data?.rows?.length)
    if (!cols || !cols.length || !rowsExist) {
      return
    }

    if (this.tableConfig.legendColumnIndex === index) {
      let stringColumnIndex = this.tableConfig.stringColumnIndex
      this.tableConfig.stringColumnIndex = this.tableConfig.legendColumnIndex
      this.tableConfig.legendColumnIndex = stringColumnIndex
    } else {
      this.tableConfig.stringColumnIndex = index
    }

    if (this.tableConfig.numberColumnIndices.includes(index)) {
      const numberColumnIndices = this.getNumberColumnIndicesWithPreferred(
        this.getColumns(),
        this.usePivotDataForChart(),
        this.queryResponse?.data?.data?.default_amount_column,
        this.tableConfig?.numberColumnIndex2,
      )?.allNumberColumnIndices
      const newNumberColumnIndices = numberColumnIndices?.filter((i) => i !== index)
      this.tableConfig.numberColumnIndices = newNumberColumnIndices
      this.tableConfig.numberColumnIndex = newNumberColumnIndices[0]
    }

    if (this.tableConfig.numberColumnIndices2.includes(index)) {
      this.tableConfig.numberColumnIndices2 = this.tableConfig.numberColumnIndices2.filter((i) => i !== index)

      if (!this.tableConfig.numberColumnIndices2.length) {
        const preferred = this.tableConfig?.numberColumnIndex2
        this.findAndSetFallbackNumberColumnIndex2([index, this.tableConfig.numberColumnIndex], preferred)
      } else if (this.tableConfig.numberColumnIndex2 === index) {
        this.tableConfig.numberColumnIndex2 = this.tableConfig.numberColumnIndices2[0]
      }
    }

    if (this.usePivotDataForChart()) {
      this.generatePivotTableData()
    }

    this.onTableConfigChange()
    this.forceUpdate()
  }

  onChangeLegendColumnIndex = (index) => {
    const cols = this.getColumns()
    const rowsExist = !!(this.tableData?.length || this.queryResponse?.data?.data?.rows?.length)
    if (!cols || !cols.length || !rowsExist) {
      return
    }

    const currentLegendColumnIndex = this.tableConfig.legendColumnIndex

    this.tableConfig.legendColumnIndex = index

    if (this.tableConfig.stringColumnIndex === index) {
      this.tableConfig.stringColumnIndex = currentLegendColumnIndex
    } else if (this.tableConfig.numberColumnIndices.includes(index)) {
      if (this.tableConfig.numberColumnIndices.length > 1) {
        this.tableConfig.numberColumnIndices = this.tableConfig.numberColumnIndices.filter((i) => i !== index)
        this.tableConfig.numberColumnIndex = this.tableConfig.numberColumnIndices[0]
      } else {
        this.tableConfig.numberColumnIndex = this.state.columns.find(
          (col) =>
            col.is_visible &&
            col.index !== index &&
            col.index !== this.tableConfig.numberColumnIndex2 &&
            col.index !== this.tableConfig.stringColumnIndex,
        )?.index
        this.tableConfig.numberColumnIndices = [this.tableConfig.numberColumnIndex]
      }
    }

    // If legend was a selected second-axis column, remove it and attempt to preserve/derive a fallback
    if (this.tableConfig.numberColumnIndices2.includes(index)) {
      this.tableConfig.numberColumnIndices2 = this.tableConfig.numberColumnIndices2.filter((i) => i !== index)

      if (!this.tableConfig.numberColumnIndices2.length) {
        const preferred = this.tableConfig?.numberColumnIndex2
        this.findAndSetFallbackNumberColumnIndex2(
          [this.tableConfig.numberColumnIndex, this.tableConfig.stringColumnIndex],
          preferred,
        )
      } else if (this.tableConfig.numberColumnIndex2 === index) {
        this.tableConfig.numberColumnIndex2 = this.tableConfig.numberColumnIndices2[0]
      }
    }

    if (this.usePivotDataForChart()) {
      this.generatePivotTableData()
    }

    this.onTableConfigChange()
    this.forceUpdate()
  }

  onChangeNumberColumnIndices = (indices, indices2, newColumns) => {
    const cols = newColumns ?? this.getColumns()
    const rowsExist = !!(this.tableData?.length || this.queryResponse?.data?.data?.rows?.length)
    if (!cols || !cols.length || !rowsExist) {
      return
    }

    if (indices) {
      this.tableConfig.numberColumnIndices = indices
      this.tableConfig.numberColumnIndex = indices[0]
    }

    if (indices2) {
      this.tableConfig.numberColumnIndices2 = indices2
      this.tableConfig.numberColumnIndex2 = indices2[0]
    }

    const columns = newColumns ?? this.getColumns()
    this.updateColumns(columns)
  }

  resetPivotTableConfig = () => {
    this.pivotTableConfig = undefined
    this.setPivotTableConfig()
  }

  setPivotTableConfig = (isFirstGeneration) => {
    const columns = this.pivotTableColumns

    if (!columns) {
      return
    }

    const prevPivotTableConfig = _cloneDeep(this.pivotTableConfig)

    if (!this.pivotTableConfig) {
      this.pivotTableConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (
      isFirstGeneration ||
      !this.pivotTableConfig.stringColumnIndices ||
      !(this.pivotTableConfig.stringColumnIndex >= 0)
    ) {
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(
        columns,
        'supportsPivot',
        this.ALLOW_NUMERIC_STRING_COLUMNS,
      )
      this.pivotTableConfig.stringColumnIndices = stringColumnIndices
      this.pivotTableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (isFirstGeneration || !this.pivotTableConfig.numberColumnIndices) {
      const {
        numberColumnIndex,
        numberColumnIndices,
        numberColumnIndex2,
        numberColumnIndices2,
        currencyColumnIndices,
        quantityColumnIndices,
        ratioColumnIndices,
        allNumberColumnIndices,
      } = this.getNumberColumnIndicesWithPreferred(
        columns,
        this.usePivotDataForChart(),
        this.queryResponse?.data?.data?.default_amount_column,
        this.pivotTableConfig?.numberColumnIndex2,
      )

      this.pivotTableConfig.numberColumnIndices = numberColumnIndices
      this.pivotTableConfig.numberColumnIndex = numberColumnIndex
      this.pivotTableConfig.numberColumnIndices2 = numberColumnIndices2
      this.pivotTableConfig.numberColumnIndex2 = numberColumnIndex2
      this.pivotTableConfig.currencyColumnIndices = currencyColumnIndices
      this.pivotTableConfig.quantityColumnIndices = quantityColumnIndices
      this.pivotTableConfig.ratioColumnIndices = ratioColumnIndices
      this.pivotTableConfig.allNumberColumnIndices = allNumberColumnIndices
    }

    if (!_isEqual(prevPivotTableConfig, this.pivotTableConfig)) {
      this.onTableConfigChange()
    }
  }

  resetTableConfig = (newColumns) => {
    this.tableConfig = undefined
    this.setTableConfig(newColumns)
  }

  isColumnIndexValid = (index, columns) => {
    if (!columns?.length) {
      return false
    }

    return !!columns[index]
  }

  isColumnIndicesValid = (indices, columns) => {
    if (!indices?.length || !columns?.length) {
      return false
    }

    return indices.every((index) => this.isColumnIndexValid(index, columns))
  }

  hasIndex = (indices, index) => {
    return indices?.findIndex((i) => index === i) !== -1
  }

  setTableConfig = (newColumns) => {
    const columns = newColumns ?? this.getColumns()
    if (!columns) {
      return
    }

    const prevTableConfig = _cloneDeep(this.tableConfig)

    if (!this.tableConfig) {
      this.tableConfig = {}
    }

    const isPivot = false
    const defaultDateColumn = this.queryResponse?.data?.data?.default_date_column
    const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(
      columns,
      isPivot,
      this.ALLOW_NUMERIC_STRING_COLUMNS,
      defaultDateColumn,
    )
    // Prefer the chart's ordinal/axis column if set; otherwise pick a groupable, non-total/non-near-unique string column with the highest unique count.
    let chosenStringIndex =
      this.tableConfig?.stringColumnIndex >= 0 ? this.tableConfig.stringColumnIndex : stringColumnIndex
    try {
      const rows = this.tableData || this.queryResponse?.data?.data?.rows || []
      const rowCount = rows?.length || 0

      const candidates = (stringColumnIndices || [])
        .filter((idx) => idx !== undefined && idx !== null && columns[idx])
        .map((idx) => {
          const vals = rows
            .map((r) => r?.[idx])
            .filter((v) => v !== null && v !== undefined && `${v}`.toString().trim() !== '')
          const uniqueCount = new Set(vals).size
          const col = columns[idx]
          return { idx, uniqueCount, groupable: !!col?.groupable, display_name: col?.display_name, name: col?.name }
        })

      const looksLikeTotal = (s) => (s || '').toString().toLowerCase().includes('total')
      const isNearUnique = (c) => rowCount > 0 && c.uniqueCount >= Math.floor(rowCount * 0.9)

      const preferred = candidates.filter((c) => c.groupable)
      const pool = preferred.length ? preferred : candidates
      const filtered = pool.filter(
        (c) => !looksLikeTotal(c.display_name) && !looksLikeTotal(c.name) && !isNearUnique(c),
      )
      const finalPool = filtered.length ? filtered : pool

      if (finalPool.length) {
        finalPool.sort((a, b) => b.uniqueCount - a.uniqueCount)
        chosenStringIndex = finalPool[0].idx
      }
    } catch (e) {}

    this.tableConfig.stringColumnIndices = stringColumnIndices
    this.tableConfig.stringColumnIndex = chosenStringIndex

    const { amountOfNumberColumns } = getColumnTypeAmounts(columns) ?? {}

    const {
      allNumberColumnIndices,
      numberColumnIndex,
      numberColumnIndices,
      numberColumnIndex2,
      numberColumnIndices2,
      currencyColumnIndices,
      quantityColumnIndices,
      ratioColumnIndices,
    } = this.getNumberColumnIndicesWithPreferred(
      columns,
      this.usePivotDataForChart(),
      this.queryResponse?.data?.data?.default_amount_column,
      this.tableConfig?.numberColumnIndex2,
    )

    if (
      !this.tableConfig.numberColumnIndices?.length ||
      !(this.tableConfig.numberColumnIndex >= 0) ||
      !this.tableConfig.numberColumnIndices.includes(this.tableConfig.numberColumnIndex)
    ) {
      this.tableConfig.numberColumnIndices = numberColumnIndices
      this.tableConfig.numberColumnIndex = numberColumnIndex
      this.tableConfig.numberColumnIndices2 = numberColumnIndices2
      this.tableConfig.numberColumnIndex2 = numberColumnIndex2
      this.tableConfig.currencyColumnIndices = currencyColumnIndices
      this.tableConfig.quantityColumnIndices = quantityColumnIndices
      this.tableConfig.ratioColumnIndices = ratioColumnIndices
      this.tableConfig.allNumberColumnIndices = allNumberColumnIndices

      if (
        this.tableConfig.numberColumnIndex === this.tableConfig.stringColumnIndex &&
        this.tableConfig.numberColumnIndices.length > 1
      ) {
        this.tableConfig.numberColumnIndex = allNumberColumnIndices?.find(
          (index) => !this.tableConfig.stringColumnIndices?.includes(index),
        )
        this.tableConfig.numberColumnIndices = [this.tableConfig.numberColumnIndex]
      }

      if (
        this.tableConfig.numberColumnIndex2 === this.tableConfig.stringColumnIndex &&
        this.tableConfig.numberColumnIndices.length > 1
      ) {
        this.tableConfig.numberColumnIndex2 = allNumberColumnIndices.find(
          (index) =>
            !this.tableConfig.stringColumnIndices?.includes(index) &&
            !this.tableConfig.numberColumnIndices?.includes(index),
        )
        if (this.tableConfig.numberColumnIndex2) {
          this.tableConfig.numberColumnIndices2 = [this.tableConfig.numberColumnIndex2]
        } else {
          this.tableConfig.numberColumnIndices2 = []
        }
      }
    } else if (
      this.isColumnIndexValid(this.tableConfig.numberColumnIndex, columns) &&
      (!this.isColumnIndicesValid(this.tableConfig.numberColumnIndices2, columns) ||
        !this.isColumnIndexValid(this.tableConfig.numberColumnIndex2, columns))
    ) {
      // There are enough number column indices to have a second, but the second doesn't exist
      const foundNumberColumnIndex2 = columns.findIndex(
        (col, index) =>
          index !== this.tableConfig.numberColumnIndex &&
          index !== this.tableConfig.stringColumnIndex &&
          isColumnNumberType(col) &&
          col.is_visible,
      )
      this.tableConfig.numberColumnIndex2 = foundNumberColumnIndex2 >= 0 ? foundNumberColumnIndex2 : undefined
      this.tableConfig.numberColumnIndices2 =
        this.tableConfig.numberColumnIndex2 !== undefined ? [this.tableConfig.numberColumnIndex2] : []
    } else if (this.numberIndicesArraysOverlap(this.tableConfig)) {
      // If either array contains all of the number columns, remove one of them
      if (this.tableConfig.numberColumnIndices.length === amountOfNumberColumns) {
        const indexToRemove = this.tableConfig.numberColumnIndices.findIndex(
          (i) => i !== this.tableConfig.numberColumnIndex,
        )
        if (indexToRemove !== -1) {
          this.tableConfig.numberColumnIndices = removeElementAtIndex(
            this.tableConfig.numberColumnIndices,
            indexToRemove,
          )
        }
      } else if (this.tableConfig.numberColumnIndices2.length === amountOfNumberColumns) {
        const indexToRemove = this.tableConfig.numberColumnIndices2.findIndex(
          (i) => i !== this.tableConfig.numberColumnIndex2,
        )
        if (indexToRemove !== -1) {
          this.tableConfig.numberColumnIndices2 = removeElementAtIndex(
            this.tableConfig.numberColumnIndices2,
            indexToRemove,
          )
        }
      }

      // Selected index is the same for both axes. Remove the overlapping values from the first axis
      if (this.tableConfig.numberColumnIndex === this.tableConfig.numberColumnIndex2) {
        const foundAlternativeIndex = columns.findIndex(
          (col, i) => col.is_visible && isColumnNumberType(col) && i !== this.tableConfig.numberColumnIndex,
        )
        this.tableConfig.numberColumnIndex2 = foundAlternativeIndex >= 0 ? foundAlternativeIndex : undefined

        // If the new columnIndex2 is valid and not already in the indices array, add it
        if (
          this.tableConfig.numberColumnIndex2 !== undefined &&
          this.tableConfig.numberColumnIndices2.indexOf(this.tableConfig.numberColumnIndex2) === -1
        ) {
          this.tableConfig.numberColumnIndices2.push(this.tableConfig.numberColumnIndex2)
        }
        if (_isEqual(this.tableConfig.numberColumnIndices2, this.tableConfig.numberColumnIndices)) {
          this.tableConfig.numberColumnIndices2.shift()
        }
      }

      // Filter out any remaining duplicate column indices
      const filteredIndices = this.tableConfig.numberColumnIndices.filter(
        (i) => i !== this.tableConfig.numberColumnIndex2 && !this.hasIndex(this.tableConfig.numberColumnIndices2, i),
      )
      if (filteredIndices.length) {
        this.tableConfig.numberColumnIndices = filteredIndices
      }
      const filteredIndices2 = this.tableConfig.numberColumnIndices2.filter(
        (i) => i !== this.tableConfig.numberColumnIndex && !this.hasIndex(this.tableConfig.numberColumnIndices, i),
      )
      if (filteredIndices2.length) {
        this.tableConfig.numberColumnIndices2 = filteredIndices2
      }
    }

    //Second axis indices had hidden columns
    if (this.tableConfig.numberColumnIndices2.find((i) => !!columns[i] && !columns[i]?.is_visible)) {
      const foundVisibleIndex = columns.findIndex(
        (col, i) =>
          col.is_visible &&
          isColumnNumberType(col) &&
          i !== this.tableConfig.numberColumnIndex &&
          i !== this.tableConfig.numberColumnIndex2,
      )
      this.tableConfig.numberColumnIndex2 = foundVisibleIndex >= 0 ? foundVisibleIndex : undefined
      this.tableConfig.numberColumnIndices2 =
        this.tableConfig.numberColumnIndex2 !== undefined ? [this.tableConfig.numberColumnIndex2] : []
    }

    // Set legend index if there should be one
    const legendColumnIndex = columns.findIndex(
      (col, i) => col.is_visible && col.groupable && i !== this.tableConfig.stringColumnIndex,
    )
    if (legendColumnIndex >= 0) {
      this.tableConfig.legendColumnIndex = legendColumnIndex
    }

    if (!_isEqual(prevTableConfig, this.tableConfig)) {
      this.onTableConfigChange(this.hasCalledInitialTableConfigChange)
    }
  }

  getPotentialDisplayTypes = () => {
    return getSupportedDisplayTypes({
      response: this.queryResponse,
      columns: this.getColumns(),
      dataLength: this.getDataLength(),
      pivotDataLength: this.getPivotDataLength(),
      isDataLimited: isDataLimited(this.queryResponse),
      allowNumericStringColumns: this.ALLOW_NUMERIC_STRING_COLUMNS,
    })
  }

  isCurrentDisplayTypeValid = () => {
    return isDisplayTypeValid(
      this.queryResponse,
      this.state.displayType,
      this.getDataLength(),
      this.getPivotDataLength(),
      this.getColumns(),
      isDataLimited(this.queryResponse),
    )
  }

  getCurrentSupportedDisplayTypes = (newColumns) => {
    return getSupportedDisplayTypes({
      response: this.queryResponse,
      columns: newColumns ?? this.getColumns(),
      dataLength: this.getDataLength(),
      pivotDataLength: this.getPivotDataLength(),
      isDataLimited: isDataLimited(this.queryResponse),
      allowNumericStringColumns: this.ALLOW_NUMERIC_STRING_COLUMNS,
    })
  }

  setFilterFunction = (col) => {
    const self = this
    if (col.type === ColumnTypes.DATE) {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          if (!rowValue) {
            return false
          }

          const rowValueDayJS = getDayJSObj({ value: rowValue, column: col, config: this.props.dataFormatting })

          const dates = headerValue.split(' to ')
          const precision = getPrecisionForDayJS(getFilterPrecision(col.precision))
          const startDate = dayjs.utc(dates[0]).startOf(precision)
          const endDate = dayjs.utc(dates[1] ?? dates[0]).endOf(precision)

          const isAfterStartDate = startDate.isSameOrBefore(rowValueDayJS)
          const isBeforeEndDate = rowValueDayJS.isSameOrBefore(endDate)

          return isAfterStartDate && isBeforeEndDate
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
          return false
        }
      }
    } else if (col.type === 'DATE_STRING') {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          if (!rowValue) {
            return false
          }

          const formattedElement = formatElement({ element: rowValue, column: col, config: self.props.dataFormatting })
          return String(formattedElement ?? '')
            .toLowerCase()
            .includes(String(headerValue ?? '').toLowerCase())
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
          return false
        }
      }
    } else if (col.type === 'DOLLAR_AMT' || col.type === 'QUANTITY' || col.type === 'PERCENT' || col.type === 'RATIO') {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          if (!rowValue && rowValue !== 0) {
            return false
          }

          const trimmedValue = String(headerValue ?? '').trim()
          if (trimmedValue) {
            const match = trimmedValue.match(/^(>=|<=|!=|>|<|!|=)\s*(.*)$/)
            if (match) {
              const op = match[1]
              const num = Number((match[2] || '').replace(/[^0-9.]/g, ''))
              switch (op) {
                case '>=':
                  return rowValue >= num
                case '>':
                  return rowValue > num
                case '<=':
                  return rowValue <= num
                case '<':
                  return rowValue < num
                case '!=':
                case '!':
                  return rowValue !== num
                case '=':
                  return rowValue === num
                default:
                  break
              }
            }
          }

          // No logical operators detected, just compare numbers
          const filterNumber = headerValue?.toString()
          const formattedNumber = formatElement({
            element: rowValue,
            column: col,
            config: self.props.dataFormatting,
          })

          return !isNaN(formattedNumber) && parseFloat(formattedNumber) === parseFloat(filterNumber)
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
          return false
        }
      }
    }

    return undefined
  }

  setSorterFunction = (col) => {
    if (col.type === ColumnTypes.DATE || col.type === 'DATE_STRING') {
      return (a, b) => dateSortFn(a, b, col, 'isTable')
    } else if (col.type === 'STRING') {
      // There is some bug in tabulator where its not sorting
      // certain columns. This explicitly sets the sorter so
      // it works every time
      return 'alphanum'
    }

    return 'alphanum'
  }

  setHeaderFilterPlaceholder = (col) => {
    if (col.type === ColumnTypes.DATE && !col.pivot) {
      return 'Pick range'
    }

    return 'Filter'
  }

  getAggConfig = (columns) => {
    if (!columns) {
      return null
    }

    const aggConfig = {}
    columns.forEach((col) => {
      aggConfig[col.name] = col.aggType
    })

    return aggConfig
  }

  getDrilldownGroupby = (queryResponse, newCol) => {
    return queryResponse?.data?.data?.fe_req?.columns?.find((column) => newCol.name === column.name)
  }

  copyToClipboard(text, element) {
    const successTimeout = 1500
    const errorTimeout = 3000
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.className = 'hidden-clipboard-textarea'
    document.body.appendChild(textarea)
    try {
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      const successful = document.execCommand('copy')
      if (successful) {
        element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.COPIED)
        setTimeout(() => {
          element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.DEFAULT)
        }, successTimeout)
      } else {
        element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.ERROR)
        setTimeout(() => {
          element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.DEFAULT)
        }, errorTimeout)
      }
    } catch (err) {
      console.error('Failed to copy: ', err)
      element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.ERROR)
      setTimeout(() => {
        element.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.DEFAULT)
      }, errorTimeout)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  addCopyToClipboardListener = (cellElement, cellValue, newCol, dataFormatting, tooltipId) => {
    cellElement.setAttribute('data-tooltip-id', tooltipId)
    cellElement.setAttribute('data-tooltip-content', TOOLTIP_COPY_TEXTS.DEFAULT)

    cellElement.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const textToCopy = formatElement({
        element: cellValue,
        column: newCol,
        config: dataFormatting,
        forExport: true,
      })

      this.copyToClipboard(textToCopy, cellElement)
    })
  }

  formatColumnsForTable = (columns, additionalSelects = [], aggConfig = {}) => {
    // todo: do this inside of chatatable
    if (!columns) {
      return null
    }

    const formattedColumns = columns.map((col, i) => {
      const newCol = _cloneDeep(col)

      newCol.id = col.id ?? uuid()
      newCol.field = `${i}`
      newCol.title = col.display_name

      newCol.mutateLink = 'Custom'

      // Visibility flag: this can be changed through the column visibility editor modal
      newCol.visible = col.is_visible
      newCol.download = col.is_visible

      newCol.minWidth = '90px'
      if (newCol.type === ColumnTypes.DATE) {
        newCol.minWidth = '125px'
      }

      newCol.maxWidth = false

      if (isColumnNumberType(newCol)) {
        newCol.hozAlign = 'right'
      } else {
        newCol.hozAlign = 'center'
      }

      const drilldownGroupby = this.getDrilldownGroupby(this.queryResponse, newCol)

      newCol.cssClass = `${newCol.type}`
      if (drilldownGroupby) {
        newCol.cssClass = `${newCol.cssClass} DRILLDOWN`
      }

      // Cell formatting
      newCol.formatter = (cell, formatterParams, onRendered) => {
        const cellValue = cell.getValue()
        const wrapper = document.createElement('div')
        wrapper.className = 'react-autoql-cell-value-wrapper'
        const valueContainer = document.createElement('div')
        valueContainer.className = 'react-autoql-cell-value'
        const formattedValue = formatElement({
          element: cellValue,
          column: newCol,
          config: getDataFormatting(this.props.dataFormatting),
          htmlElement: cell.getElement(),
        })

        valueContainer.innerHTML = formattedValue ?? ''

        wrapper.appendChild(valueContainer)

        if (cellValue != null && cellValue !== '') {
          onRendered(() => {
            const cellElement = cell.getElement()
            this.addCopyToClipboardListener(
              cellElement,
              cellValue,
              newCol,
              getDataFormatting(this.props.dataFormatting),
              this.props.tooltipID ?? this.TOOLTIP_ID,
            )
          })
        }

        return wrapper
      }

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      newCol.headerFilter = col.headerFilter ?? 'input'
      newCol.headerFilterPlaceholder = this.setHeaderFilterPlaceholder(newCol)
      newCol.headerFilterLiveFilter = false

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      newCol.headerFilterFunc = this.setFilterFunction(newCol)

      // Allow proper chronological sorting for date strings
      newCol.sorter = this.setSorterFunction(newCol)
      newCol.headerSort = col.headerSort ?? !!this.props.enableTableSorting
      newCol.headerSortStartingDir = 'desc'
      newCol.headerClick = (e, col) => {
        // To allow tabulator to sort, we must first restore redrawing,
        // then the component will disable it again afterwards automatically
        if (this.state.displayType === 'table') {
          this.tableRef?.ref?.restoreRedraw()
        } else if (this.state.displayType === 'pivot_table') {
          this.pivotTableRef?.ref?.restoreRedraw()
        }
      }

      // Column header context menu
      // Keep for future use
      // newCol.headerContextMenu = [
      //   {
      //     label: 'Hide Column',
      //     action: function (e, column, a, b, c) {
      //       column.hide()
      //     },
      //   },
      // ]

      // Show drilldown filter value in column title so user knows they can't filter on this column
      if (drilldownGroupby) {
        newCol.isDrilldownColumn = true
        newCol.tooltipTitle = newCol.title
        newCol.title = `${newCol.title} <em>(Clicked: "${drilldownGroupby.value}")</em>`
      }

      // Set aggregate type is data is list query
      let aggType = col.aggType
      if (aggConfig?.[col?.name]) {
        aggType = aggConfig[col.name]
      }
      if (isListQuery(columns)) {
        if (isColumnNumberType(col)) {
          newCol.aggType = aggType || AggTypes.SUM
        } else {
          newCol.aggType = aggType || AggTypes.COUNT
        }
      }

      // Check if a date range is available
      const dateRange = this.columnDateRanges.find((rangeObj) => {
        return newCol.type === ColumnTypes.DATE && (rangeObj.columnName === newCol.display_name || !!newCol.groupable)
      })

      if (dateRange) {
        newCol.dateRange = dateRange
      }

      if (additionalSelects?.length > 0 && isColumnNumberType(newCol)) {
        const customSelect = additionalSelects.find((select) => {
          return (
            (select?.columns?.[0] ?? '').replace(/ /g, '').toLowerCase() ===
            (newCol?.name ?? '').replace(/ /g, '').toLowerCase()
          )
        })
        const cleanName = getCleanColumnName(newCol?.name)
        const availableSelect = this.queryResponse?.data?.data?.available_selects?.find((select) => {
          return select?.table_column?.trim() === cleanName
        })

        if (customSelect && !availableSelect) {
          newCol.custom = true
        }
      }

      return newCol
    })

    return formattedColumns
  }

  formatDatePivotYear = (data, dateColumnIndex) => {
    const columns = this.getColumns()
    if (columns[dateColumnIndex].type === ColumnTypes.DATE) {
      const dayJSObj = getDayJSObj({
        value: data[dateColumnIndex],
        column: columns[dateColumnIndex],
        config: this.props.dataFormatting,
      })
      return dayJSObj.year().toString()
    }
    return dayjs(data[dateColumnIndex]).format('YYYY')
  }

  formatDatePivotMonth = (data, dateColumnIndex) => {
    const columns = this.getColumns()
    if (columns[dateColumnIndex].type === ColumnTypes.DATE) {
      const dayJSObj = getDayJSObj({
        value: data[dateColumnIndex],
        column: columns[dateColumnIndex],
        config: this.props.dataFormatting,
      })
      return dayJSObj.format('MMMM')
    }
    return dayjs(data[dateColumnIndex]).format('MMMM')
  }

  generateDatePivotData = (newTableData) => {
    try {
      const columns = this.getColumns()
      const dateColumnIndex = getDateColumnIndex(columns)
      let numberColumnIndex = this.tableConfig.numberColumnIndex
      if (!(numberColumnIndex >= 0)) {
        numberColumnIndex = columns.findIndex(
          (col, index) => col.is_visible && index !== dateColumnIndex && isColumnNumberType(col),
        )
      }
      const tableData = newTableData || this.queryResponse?.data?.data?.rows

      const allYears = tableData.map((d) => {
        if (columns[dateColumnIndex].type === ColumnTypes.DATE) {
          const dayJSObj = getDayJSObj({
            value: d[dateColumnIndex],
            column: columns[dateColumnIndex],
            config: this.props.dataFormatting,
          })
          return dayJSObj.year()
        }
        return Number(dayjs(d[dateColumnIndex]).format('YYYY'))
      })

      const uniqueYears = [...allYears]
        .filter(onlyUnique)
        .sort()
        .reduce((map, title, i) => {
          map[title] = i + 1
          return map
        }, {})

      const origDateColumn = columns[dateColumnIndex]

      const pivotMonthColumn = {
        ...origDateColumn,
        title: 'Month',
        name: 'Month',
        field: '0',
        resizable: false,
        frozen: true,
        visible: true,
        is_visible: true,
        type: 'DATE_STRING',
        datePivot: true,
        origColumn: origDateColumn,
        pivot: true,
        cssClass: 'pivot-category',
        sorter: (a, b) => dateSortFn(a, b, origDateColumn, 'isTable'),
        headerFilter: false,
        headerFilterLiveFilter: false,
        headerFilterPlaceholder: 'filter...',
      }

      // Generate new column array
      const pivotTableColumns = [
        {
          ...pivotMonthColumn,
          formatter: (cell) =>
            formatElement({
              element: cell.getValue(),
              column: pivotMonthColumn,
              config: getDataFormatting(this.props.dataFormatting),
              htmlElement: cell.getElement(),
            }),
        },
      ]

      Object.keys(uniqueYears).forEach((year, i) => {
        pivotTableColumns.push({
          ...columns[numberColumnIndex],
          origColumn: columns[numberColumnIndex],
          origValues: {},
          name: year,
          title: year,
          display_name: year,
          field: `${i + 1}`,
          visible: true,
          is_visible: true,
          headerFilter: false,
          headerFilterLiveFilter: false,
        })
      })

      const pivotTableData = this.makeEmptyArrayShared(
        Object.keys(uniqueYears).length + 1,
        MONTH_NAMES.length,
        undefined,
      )
      const pivotOriginalColumnData = {}

      // Populate first column
      MONTH_NAMES.forEach((month, i) => {
        pivotTableData[i][0] = month
      })

      // Populate remaining columns
      tableData.forEach((row) => {
        const year = this.formatDatePivotYear(row, dateColumnIndex)
        const month = this.formatDatePivotMonth(row, dateColumnIndex)

        const yearNumber = uniqueYears[year]
        const monthNumber = MONTH_NAMES.findIndex((m) => month === m)

        const pivotColumnIndex = pivotTableColumns.findIndex((col) => col.name === year)

        if (monthNumber >= 0 && yearNumber) {
          const val = Number(row[numberColumnIndex])
          if (Number.isFinite(val)) {
            const existing = Number(pivotTableData[monthNumber][yearNumber]) || 0
            pivotTableData[monthNumber][yearNumber] = existing + val
            pivotOriginalColumnData[year] = {
              ...pivotOriginalColumnData[year],
              [month]: row[dateColumnIndex],
            }
            pivotTableColumns[pivotColumnIndex].origValues[month] = {
              name: columns[dateColumnIndex]?.name,
              drill_down: columns[dateColumnIndex]?.drill_down,
              value: row[dateColumnIndex] || '',
            }
          }
        }
      })

      this.pivotOriginalColumnData = pivotOriginalColumnData
      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = 12
      this.setPivotTableConfig()
    } catch (error) {
      console.error(error)
      const supportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
      this.setState({
        displayType: 'table',
        supportedDisplayTypes: supportedDisplayTypes.filter((displayType) => displayType !== 'pivot_table'),
      })
    }
  }

  generatePivotTableData = ({ isFirstGeneration } = {}) => {
    try {
      this.pivotTableColumnsLimited = false
      this.pivotTableRowsLimited = false
      this.pivotTableID = uuid()

      let tableData = _cloneDeep(this.queryResponse?.data?.data?.rows)
      tableData = tableData.filter((row) => row[0] !== null)

      const columns = this.getColumns()
      const { legendColumnIndex, stringColumnIndex, numberColumnIndex } = this.tableConfig

      tableData = tableData.filter((row) => {
        const stringVal = row?.[stringColumnIndex]
        const legendVal = row?.[legendColumnIndex]
        const numVal = row?.[numberColumnIndex]

        const isStringEmpty = stringVal === null || stringVal === undefined || `${stringVal}`.toString().trim() === ''
        const isLegendEmpty = legendVal === null || legendVal === undefined || `${legendVal}`.toString().trim() === ''
        const isNumEmpty = numVal === null || numVal === undefined || Number.isNaN(Number(numVal))

        return !isStringEmpty && !isLegendEmpty && !isNumEmpty
      })

      if (this.formattedTableParams?.filters?.length) {
        this.formattedTableParams.filters.forEach((filter) => {
          const filterColumnIndex = columns.find((col) => col.id === filter.id)?.index
          if (filterColumnIndex !== undefined) {
            tableData = filterDataByColumn(tableData, columns, filterColumnIndex, filter.value, filter.operator)
          }
        })
      }

      // Apply any active Tabulator header filters so the pivot reflects the filtered table view.
      try {
        const headerFilters = this.getTabulatorHeaderFilters?.()
        if (headerFilters) {
          if (Array.isArray(headerFilters)) {
            headerFilters.forEach((headFilter) => {
              if (!headFilter) return
              const field = headFilter.field ?? headFilter[0]
              const value = headFilter.value ?? headFilter[1]
              if (field === undefined || value === undefined) return
              let filterColumnIndex
              const parsed = parseInt(field, 10)
              if (!isNaN(parsed)) filterColumnIndex = parsed
              if (filterColumnIndex === undefined)
                filterColumnIndex = columns.find((col) => col.field === field || col.id === field)?.index
              if (filterColumnIndex !== undefined) {
                tableData = filterDataByColumn(
                  tableData,
                  columns,
                  filterColumnIndex,
                  value,
                  headFilter.type || headFilter.operator,
                )
              }
            })
          } else if (typeof headerFilters === 'object') {
            Object.entries(headerFilters).forEach(([field, value]) => {
              if (value === undefined || value === null || value === '') return
              let filterColumnIndex
              const parsed = parseInt(field, 10)
              if (!isNaN(parsed)) filterColumnIndex = parsed
              if (filterColumnIndex === undefined)
                filterColumnIndex = columns.find((col) => col.field === field || col.id === field)?.index
              if (filterColumnIndex !== undefined) {
                tableData = filterDataByColumn(tableData, columns, filterColumnIndex, value, undefined)
              }
            })
          }
        }
      } catch (err) {
        // ignore header filter parsing errors and continue
      }

      // Respect user sorters first, fall back to date sort if none provided
      const userSorters = this.formattedTableParams?.sorters || []
      let sortedData = null
      if (userSorters.length > 0) {
        const primary = userSorters[0]
        let sortColumnIndex = columns.find((col) => col.id === primary?.id)?.index
        if (sortColumnIndex === undefined && primary?.field !== undefined) {
          const parsed = parseInt(primary.field, 10)
          sortColumnIndex = !isNaN(parsed) ? parsed : columns.find((col) => col.field === primary.field)?.index
        }
        const sortDirection = (primary?.sort || primary?.dir)?.toString().toUpperCase() === 'DESC' ? 'desc' : 'asc'
        if (sortColumnIndex !== undefined)
          sortedData = sortDataByColumn(tableData, columns, sortColumnIndex, sortDirection)
      }
      if (!sortedData) sortedData = sortDataByDate(tableData, columns, 'desc', 'isTable')

      // Build unique header lists, stripping out null/undefined/empty-string values
      let uniqueRowHeaders = sortedData
        .map((d) => d[stringColumnIndex])
        .filter((v) => v !== null && v !== undefined && `${v}`.toString().trim() !== '')
        .filter(onlyUnique)

      let uniqueColumnHeaders = sortDataByDate(tableData, columns, 'desc', 'isTable')
        .map((d) => d[legendColumnIndex])
        .filter((v) => v !== null && v !== undefined && `${v}`.toString().trim() !== '')
        .filter(onlyUnique)

      let newStringColumnIndex = stringColumnIndex
      let newLegendColumnIndex = legendColumnIndex

      const hasSavedAxisConfig =
        this.tableConfig &&
        this.isColumnIndexValid(this.tableConfig.stringColumnIndex, columns) &&
        this.isColumnIndexValid(this.tableConfig.legendColumnIndex, columns)

      let didSwapAxes = false
      if (
        isFirstGeneration &&
        !hasSavedAxisConfig && // Skip switching if user has saved preferences
        // Only switch if legend is a date AND it would not shrink the number of row headers,
        // or if the legend has more unique headers than the rows (original behavior).
        ((isColumnDateType(columns[legendColumnIndex]) && uniqueColumnHeaders?.length >= uniqueRowHeaders?.length) ||
          (uniqueColumnHeaders?.length > uniqueRowHeaders?.length &&
            (!isColumnDateType(columns[stringColumnIndex]) || uniqueColumnHeaders.length > MAX_LEGEND_LABELS)))
      ) {
        newStringColumnIndex = legendColumnIndex
        newLegendColumnIndex = stringColumnIndex

        const tempValues = [...uniqueRowHeaders]
        uniqueRowHeaders = [...uniqueColumnHeaders]
        uniqueColumnHeaders = tempValues
        didSwapAxes = true
      }

      try {
        if (!columns[newStringColumnIndex]?.groupable) {
          const found = columns.findIndex((col, i) => col?.groupable && i !== newLegendColumnIndex)
          if (found >= 0) {
            newStringColumnIndex = found
          }
        }

        if (!columns[newLegendColumnIndex]?.groupable) {
          const found = columns.findIndex((col, i) => col?.groupable && i !== newStringColumnIndex)
          if (found >= 0) {
            newLegendColumnIndex = found
          }
        }
      } catch (e) {
        /* ignore */
      }

      if (isColumnStringType(columns[newLegendColumnIndex]) && !isColumnDateType(columns[stringColumnIndex])) {
        uniqueColumnHeaders.sort((a, b) => a?.localeCompare?.(b))
      }

      if (uniqueRowHeaders?.length > MAX_CHART_ELEMENTS) {
        this.pivotTableRowsLimited = true
        this.pivotTableTotalRows = uniqueRowHeaders.length
        uniqueRowHeaders = uniqueRowHeaders.slice(0, MAX_CHART_ELEMENTS)
      }

      const uniqueRowHeadersObj = uniqueRowHeaders.reduce((map, title, i) => {
        map[title] = i
        return map
      }, {})

      if (uniqueColumnHeaders?.length > this.MAX_PIVOT_TABLE_COLUMNS) {
        this.pivotTableColumnsLimited = true
        this.pivotTableTotalColumns = uniqueColumnHeaders.length
        uniqueColumnHeaders = uniqueColumnHeaders.slice(0, this.MAX_PIVOT_TABLE_COLUMNS)
      }

      const uniqueColumnHeadersObj = uniqueColumnHeaders.reduce((map, title, i) => {
        map[title] = i
        return map
      }, {})

      this.pivotColumnHeaders = uniqueColumnHeadersObj
      this.pivotRowHeaders = uniqueRowHeadersObj
      this.tableConfig.legendColumnIndex = newLegendColumnIndex
      this.tableConfig.stringColumnIndex = newStringColumnIndex
      this.tableConfig.stringColumnIndices = [newStringColumnIndex]

      // Generate new column array
      const pivotTableColumns = []

      // First column will be the row headers defined by the string column
      pivotTableColumns.push({
        ...columns[newStringColumnIndex],
        frozen: true,
        visible: true,
        is_visible: true,
        field: '0',
        resizable: false,
        cssClass: 'pivot-category',
        pivot: true,
        headerFilter: false,
        headerFilterLiveFilter: false,
      })

      uniqueColumnHeaders.forEach((columnName, i) => {
        const formattedColumnName = formatElement({
          element: columnName,
          column: columns[newLegendColumnIndex],
          config: getDataFormatting(this.props.dataFormatting),
        })

        pivotTableColumns.push({
          ...columns[numberColumnIndex],
          origColumn: columns[numberColumnIndex],
          origPivotColumn: columns[newLegendColumnIndex],
          origValues: {},
          name: columnName,
          title: formattedColumnName,
          display_name: formattedColumnName,
          field: `${i + 1}`,
          visible: true,
          is_visible: true,
          headerFilter: false,
          headerFilterLiveFilter: false,
        })
      })

      const pivotTableData = this.makeEmptyArrayShared(
        uniqueColumnHeaders.length + 1,
        uniqueRowHeaders.length,
        undefined,
      )

      let aggregatedRowCount = 0
      let skippedRowCount = 0
      const skippedRowExamples = []
      sortedData.forEach((row) => {
        const pivotRowIndex = uniqueRowHeadersObj[row[newStringColumnIndex]]
        const pivotRowHeaderValue = row[newStringColumnIndex]
        if (!pivotRowHeaderValue || pivotRowIndex === undefined || !pivotTableData[pivotRowIndex]) {
          skippedRowCount += 1
          if (skippedRowExamples.length < 20) {
            skippedRowExamples.push({
              rowPreview: row.slice ? row.slice(0, 6) : row,
              pivotRowHeaderValue,
              pivotRowIndex,
            })
          }
          return
        }

        // Populate first column
        pivotTableData[pivotRowIndex][0] = pivotRowHeaderValue

        // Populate remaining columns (accumulate numeric values)
        const pivotColumnIndex = uniqueColumnHeadersObj[row[newLegendColumnIndex]]
        if (pivotColumnIndex !== undefined) {
          const colIndex = pivotColumnIndex + 1
          const val = Number(row[numberColumnIndex])
          if (Number.isFinite(val)) {
            const existing = Number(pivotTableData[pivotRowIndex][colIndex]) || 0
            pivotTableData[pivotRowIndex][colIndex] = existing + val
            if (pivotTableColumns[colIndex]) {
              pivotTableColumns[colIndex].origValues[pivotRowHeaderValue] = {
                name: columns[newStringColumnIndex]?.name,
                drill_down: columns[newStringColumnIndex]?.drill_down,
                value: pivotRowHeaderValue,
              }
            }
            aggregatedRowCount += 1
          }
        }
      })

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = this.pivotTableData?.length ?? 0
      this.setPivotTableConfig(true)
      if (this._isMounted) {
        this.forceUpdate()
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback?.(error)
    }
  }

  onSuggestionClick = async ({ query, queryId, userSelection, isButtonClick, skipQueryValidation, source }) => {
    // Only call suggestion endpoint if clicked from suggestion list, not query validation
    if (!userSelection) {
      sendSuggestion({
        ...getAuthentication(this.props.authentication),
        queryId,
        suggestion: query,
      }).catch((error) => console.error(error))
    }

    if (query === 'None of these') {
      if (this.props.onNoneOfTheseClick) {
        this.props.onNoneOfTheseClick()
      }

      if (this.props.mutable) {
        this.setState({
          customResponse: (
            <div className='feedback-message'>
              Thank you for your feedback!
              <br />
              To continue, try asking another query.
            </div>
          ),
        })
      }
    } else {
      if (this.props.onSuggestionClick) {
        this.props.onSuggestionClick({
          query,
          userSelection,
          isButtonClick,
          skipQueryValidation,
          source,
          scope: this.props.scope,
        })
      }
      if (this.props.queryInputRef?._isMounted) {
        this.props.queryInputRef?.animateInputTextAndSubmit({
          queryText: query,
          userSelection,
          skipQueryValidation: true,
          source,
          scope: this.props.scope,
        })
      }
    }
  }

  replaceErrorTextWithLinks = (errorMessage) => {
    try {
      const splitErrorMessage = errorMessage.split('<report>')
      const newErrorMessage = (
        <div className='query-output-error-message'>
          {splitErrorMessage.map((str, index) => {
            return (
              <span key={`error-message-part-${this.COMPONENT_KEY}-${index}`}>
                <span>{str}</span>
                {index !== splitErrorMessage.length - 1 && (
                  <button className='report-like-text-button' onClick={this.props.reportProblemCallback}>
                    report
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )
      return newErrorMessage
    } catch (error) {
      return <span>{errorMessage}</span>
    }
  }

  renderAllColumnsHiddenMessage = () => {
    return (
      <div className='no-columns-error-message' data-test='columns-hidden-message'>
        <Icon className='warning-icon' type='warning-triangle' />
        <div>
          All columns in this table are currently hidden. You can adjust your column visibility preferences using the
          Column Visibility Manager (<Icon className='eye-icon' type='eye' />) in the Options Toolbar.
        </div>
      </div>
    )
  }

  getDefaultQueryPageSize = () => {
    return this.props.dataPageSize ?? DEFAULT_DATA_PAGE_SIZE
  }

  getQueryPageSize = () => {
    return this.props.dataPageSize ?? this.queryResponse?.data?.data?.fe_req?.page_size ?? DEFAULT_DATA_PAGE_SIZE
  }

  onAddColumnClick = (column, sqlFn, isHiddenColumn) => {
    if (isHiddenColumn) {
      this.setState({ isAddingColumn: true })
      this.tableRef?.setPageLoading(true)

      const newColumns = this.state.columns.map((col) => {
        if (col.name === column.name) {
          return {
            ...col,
            is_visible: true,
          }
        }

        return col
      })

      setColumnVisibility({ ...this.props.authentication, columns: newColumns })
        .then(() => this.updateColumns(newColumns))
        .catch((error) => {
          console.error(error)
          this.props.onErrorCallback(error)
        })
        .finally(() => {
          this.tableRef?.setPageLoading(false)
          this.setState({ isAddingColumn: false })
        })
    } else if (!column) {
      // Add a custom column
      this.tableRef?.addCustomColumn()
    } else {
      this.setState({ isAddingColumn: true })
      this.tableRef?.setPageLoading(true)

      let currentAdditionalSelectColumns = this.getAdditionalSelectsFromResponse(this.queryResponse) ?? []
      const existingCustomSelectForColumn = this.state.customColumnSelects.find((col) => col.id === column.id)
      if (existingCustomSelectForColumn) {
        currentAdditionalSelectColumns = currentAdditionalSelectColumns?.filter((select) => {
          return select.columns[0]?.replace(/ /g, '') !== existingCustomSelectForColumn.columns[0]?.replace(/ /g, '')
        })
      }

      let currentDisplayOverrides = this.getDisplayOverridesFromResponse(this.queryResponse) ?? []
      currentDisplayOverrides = currentDisplayOverrides?.filter((override) => {
        return override.table_column?.trim() !== column.table_column?.trim()
      })
      if (column?.custom_column_display_name) {
        currentDisplayOverrides = [
          ...currentDisplayOverrides,
          { english: column?.custom_column_display_name, table_column: column?.table_column },
        ]
      }

      this.queryFn({
        newColumns: [...currentAdditionalSelectColumns, formatAdditionalSelectColumn(column, sqlFn)],
        displayOverrides: currentDisplayOverrides,
      })
        .then((response) => {
          if (response?.data?.data?.rows) {
            this.updateColumnsAndData(response)
          } else {
            throw new Error('New column addition failed')
          }
        })
        .catch((error) => {
          console.error(error)
          this.tableRef?.setPageLoading(false)
        })
        .finally(() => {
          this.setState({ isAddingColumn: false })
        })
    }
  }

  onCustomColumnChange = (newColumn) => {
    if (newColumn?.table_column) {
      this.onAddColumnClick(newColumn)
    } else {
      console.error('Unknown column type')
    }
  }

  renderAddColumnBtn = () => {
    const isSingleValue = isSingleValueResponse(this.queryResponse)
    const allColumnsHidden = areAllColumnsHidden(this.getColumns())

    if (!allColumnsHidden && this.props.allowColumnAddition && (this.state.displayType === 'table' || isSingleValue)) {
      return (
        <AddColumnBtn
          queryResponse={this.queryResponse}
          columns={this.state.columns}
          tooltipID={this.props.tooltipID}
          onAddColumnClick={this.onAddColumnClick}
          onCustomClick={this.onAddColumnClick}
          disableAddCustomColumnOption={!this.props.enableCustomColumns || isDrilldown(this.queryResponse)}
          className={isSingleValue ? 'single-value-add-col-btn' : 'table-add-col-btn'}
          isAddingColumn={this.state.isAddingColumn}
        />
      )
    }
  }

  renderTable = () => {
    if (areAllColumnsHidden(this.getColumns())) {
      return this.renderAllColumnsHiddenMessage()
    }

    if (!this.tableData) {
      return this.renderMessage('Error: There was no data supplied for this table')
    }

    if (!this.tableParams.filter && this.props?.initialFormattedTableParams?.filters) {
      this.tableParams.filter = formatFiltersForTabulator(
        this.props?.initialFormattedTableParams?.filters,
        this.state.columns,
      )
    }

    if (!this.tableParams.sort && this.props?.initialFormattedTableParams?.sorters) {
      this.tableParams.sort = formatSortersForTabulator(
        this.props?.initialFormattedTableParams?.sorters,
        this.state.columns,
      )
    }

    return (
      <ErrorBoundary>
        <ChataTable
          key={this.tableID}
          ref={(ref) => (this.tableRef = ref)}
          autoHeight={this.props.autoHeight}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          dataFormatting={this.props.dataFormatting}
          columns={this.state.columns}
          response={this.queryResponse}
          updateColumns={this.updateColumns}
          columnDateRanges={this.columnDateRanges}
          onCellClick={this.onTableCellClick}
          queryID={this.queryID}
          useInfiniteScroll={this.props.useInfiniteScroll}
          onTableParamsChange={this.onTableParamsChange}
          onNewData={this.onNewData}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing || this.state.isResizing}
          queryRequestData={this.queryResponse?.data?.data?.fe_req}
          queryText={this.queryResponse?.data?.data?.text}
          originalQueryID={this.props.originalQueryID}
          isDrilldown={isDrilldown(this.queryResponse)}
          isQueryOutputMounted={this._isMounted}
          popoverParentElement={this.props.popoverParentElement}
          hidden={this.state.displayType !== 'table'}
          supportsDrilldowns={
            isAggregation(this.state.columns) && getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns
          }
          tooltipID={this.props.tooltipID}
          queryFn={this.queryFn}
          source={this.props.source}
          scope={this.props.scope}
          tableConfig={this.tableConfig}
          aggConfig={this.state.aggConfig}
          onCustomColumnChange={this.onCustomColumnChange}
          enableContextMenu={this.props.enableTableContextMenu}
          initialTableParams={this.tableParams}
          updateColumnsAndData={this.updateColumnsAndData}
          onUpdateFilterResponse={this.props.onUpdateFilterResponse}
          isLoadingLocal={this.props.isLoadingLocal}
        />
      </ErrorBoundary>
    )
  }

  renderPivotTable = () => {
    if (areAllColumnsHidden(this.getColumns())) {
      return this.renderAllColumnsHiddenMessage()
    }

    if (this.state.displayType === 'pivot_table' && !this.pivotTableData) {
      return this.renderMessage('Error: There was no data supplied for this table')
    }

    return (
      <ErrorBoundary>
        <ChataTable
          key={this.pivotTableID}
          ref={(ref) => (this.pivotTableRef = ref)}
          autoHeight={this.props.autoHeight}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          dataFormatting={this.props.dataFormatting}
          columns={this.pivotTableColumns}
          data={this.pivotTableData}
          onCellClick={this.onTableCellClick}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing || this.state.isResizing}
          hidden={this.state.displayType !== 'pivot_table'}
          useInfiniteScroll={this.props.useInfiniteScroll}
          supportsDrilldowns={true}
          source={this.props.source}
          scope={this.props.scope}
          tooltipID={this.props.tooltipID}
          response={this.queryResponse}
          pivotTableRowsLimited={this.pivotTableRowsLimited}
          pivotTableColumnsLimited={this.pivotTableColumnsLimited}
          totalRows={this.pivotTableTotalRows}
          totalColumns={this.pivotTableTotalColumns}
          maxColumns={this.MAX_PIVOT_TABLE_COLUMNS}
          initialTableParams={this.tableParams}
          updateColumnsAndData={this.updateColumnsAndData}
          pivotGroups={true}
          pivot
          queryText={this.queryResponse?.data?.data?.text}
          isLoadingLocal={this.props.isLoadingLocal}
        />
      </ErrorBoundary>
    )
  }

  renderChart = () => {
    if (!this.tableData || !this.state.columns || !this.tableConfig) {
      console.error('Required table data was missing for chart')
      return this.renderMessage('Error: There was no data supplied for this chart')
    }

    const usePivotData = this.usePivotDataForChart()
    if (usePivotData && (!this.pivotTableData || !this.pivotTableColumns || !this.pivotTableConfig)) {
      return this.renderMessage('Error: There was no data supplied for this chart')
    }

    const tableConfig = usePivotData ? this.pivotTableConfig : this.tableConfig

    let isChartDataAggregated = false
    const numberOfGroupbys = getNumberOfGroupables(this.state.columns)
    if (numberOfGroupbys === 1 || (numberOfGroupbys >= 2 && usePivotData)) {
      isChartDataAggregated = true
    }

    const data = usePivotData ? this.state.visiblePivotRows || this.pivotTableData : this.tableData
    const columns = usePivotData ? this.pivotTableColumns : this.state.columns

    const isPivotDataLimited =
      this.usePivotDataForChart() && (this.pivotTableRowsLimited || this.pivotTableColumnsLimited)

    return (
      <ErrorBoundary>
        <ChataChart
          key={this.state.chartID}
          isResizable={this.state.isResizable}
          {...tableConfig}
          tableConfig={this.tableConfig}
          originalColumns={this.getColumns()}
          data={data}
          hidden={!isChartType(this.state.displayType)}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          ref={(ref) => (this.chartRef = ref)}
          type={this.state.displayType}
          isDataAggregated={isChartDataAggregated}
          popoverParentElement={this.props.popoverParentElement}
          columns={columns}
          isAggregated={usePivotData}
          dataFormatting={this.props.dataFormatting}
          activeChartElementKey={this.props.activeChartElementKey}
          onLegendClick={this.onLegendClick}
          currentLegendState={this.state.hiddenLegendLabels}
          legendColumn={this.state.columns[this.tableConfig?.legendColumnIndex]}
          changeStringColumnIndex={this.onChangeStringColumnIndex}
          changeLegendColumnIndex={this.onChangeLegendColumnIndex}
          changeNumberColumnIndices={this.onChangeNumberColumnIndices}
          onChartClick={this.onChartClick}
          isResizing={this.props.isResizing || this.state.isResizing}
          isAnimating={this.props.isAnimating}
          isDrilldownChartHidden={this.props.isDrilldownChartHidden}
          enableDynamicCharting={this.props.enableDynamicCharting}
          tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
          chartTooltipID={this.props.chartTooltipID ?? this.CHART_TOOLTIP_ID}
          height={this.props.height}
          width={this.props.width}
          onNewData={this.onNewData}
          isDrilldown={isDrilldown(this.queryResponse)}
          updateColumns={this.updateColumns}
          isDataLimited={isDataLimited(this.queryResponse) || isPivotDataLimited}
          source={this.props.source}
          scope={this.props.scope}
          queryFn={this.queryFn}
          onBucketSizeChange={this.props.onBucketSizeChange}
          bucketSize={this.props.bucketSize}
          queryID={this.queryResponse?.data?.data?.query_id}
          isEditing={this.props.isEditing}
          hiddenLegendLabels={this.state.hiddenLegendLabels}
          onLegendVisibilityChange={this.handleLegendVisibilityChange}
          enableChartControls={this.props.enableChartControls}
          initialChartControls={this.props.initialChartControls}
          onChartControlsChange={this.props.onChartControlsChange}
        />
      </ErrorBoundary>
    )
  }

  renderHelpResponse = () => {
    const url = this.queryResponse?.data?.data?.rows?.[0]
    if (!url) {
      return null
    }

    const hasHashTag = url.includes('#')
    let linkText = url
    if (hasHashTag) {
      const endOfUrl = url.split('#')[1].replace(/-/g, ' ')
      linkText = endOfUrl.charAt(0).toUpperCase() + endOfUrl.substr(1)
    }

    return (
      <>
        Great news, I can help with that:
        <br />
        {
          <button className='react-autoql-help-link-btn' target='_blank' onClick={() => window.open(url, '_blank')}>
            <Icon type='globe' className='react-autoql-help-link-icon' />
            {linkText}
          </button>
        }
      </>
    )
  }

  renderError = (queryResponse) => {
    // No response prop was provided to <QueryOutput />
    if (!queryResponse) {
      console.warn('Warning: No response object supplied')
      return this.renderMessage('No response supplied')
    }

    if (queryResponse?.data?.message) {
      // Response is not a suggestion list, but no query data object was provided
      // There is no valid query data. This is an error. Return message from UMS
      return this.renderMessage(queryResponse.data)
    }

    // There is no error message in the response, display default error message
    return this.renderMessage()
  }

  noDataFound = () => {
    return this.queryResponse?.data?.data?.rows?.length === 0 && this.isOriginalData
  }

  renderMessage = (error) => {
    try {
      if (typeof error === 'object') {
        let errorMessage = GENERAL_QUERY_ERROR

        if (error?.message === REQUEST_CANCELLED_ERROR) {
          errorMessage = (
            <span>
              Query cancelled{' '}
              <Icon
                tooltip='Pressing the ESC key will cancel the current query request. If you wish to re-run your last query, simply press the UP arrow in the input bar then hit ENTER.'
                tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
                type='question'
              />
            </span>
          )
        } else if (error?.message) {
          // Replace the "<report>" text with link
          errorMessage = error.message
          if (this.props.reportProblemCallback) {
            errorMessage = this.replaceErrorTextWithLinks(error.message)
          } else {
            errorMessage = errorMessage.replace('<report>', 'report')
          }
        }

        return (
          <div className='query-output-error-message'>
            <div>{errorMessage}</div>
            {error.reference_id && (
              <>
                <br />
                <div>Error ID: {error.reference_id}</div>
              </>
            )}
          </div>
        )
      }

      const errorMessage = error || GENERAL_QUERY_ERROR
      return <div className='query-output-error-message'>{errorMessage}</div>
    } catch (error) {
      console.warn(error)
      return <div className='query-output-error-message'>{GENERAL_QUERY_ERROR}</div>
    }
  }

  renderTextResponse = (text) => {
    if (areAllColumnsHidden(this.getColumns())) {
      return this.renderAllColumnsHiddenMessage()
    }

    return text ?? null
  }

  renderResponse = () => {
    const { displayType } = this.state
    if (this.hasError(this.queryResponse)) {
      return this.renderError(this.queryResponse)
    }

    if (this.state.customResponse) {
      return this.state.customResponse
    }

    // If "items" are returned in response it is a list of suggestions
    const isSuggestionList = !!this.queryResponse?.data?.data?.items
    if (isSuggestionList) {
      return this.renderSuggestionMessage(this.queryResponse.data.data.items, this.queryResponse.data.data.query_id)
    }

    // Query validation was triggered, display query validation message
    if (this.queryResponse?.data?.data?.replacements) {
      return (
        <QueryValidationMessage
          key={this.QUERY_VALIDATION_KEY}
          response={this.queryResponse}
          onSuggestionClick={({ query, userSelection }) =>
            this.onSuggestionClick({
              query,
              userSelection,
              isButtonClick: true,
              skipQueryValidation: true,
              source: ['validation'],
              scope: this.props.scope,
            })
          }
          onQueryValidationSelectOption={this.props.onQueryValidationSelectOption}
          initialSelections={this.props.queryValidationSelections}
          autoSelectSuggestion={this.props.autoSelectQueryValidationSuggestion}
          scope={this.props.scope}
        />
      )
    }

    // This is not technically an error. There is just no data in the DB
    // Keep this in case we want to revert back to this error message
    // if (this.noDataFound()) {
    //   return this.replaceErrorTextWithLinks(this.queryResponse.data.message)
    // }

    if (displayType && !!this.queryResponse?.data?.data?.rows) {
      if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (displayType === 'text') {
        return this.renderTextResponse()
      } else if (isSingleValueResponse(this.queryResponse)) {
        return this.renderSingleValueResponse()
      } else if (!isTableType(displayType) && !isChartType(displayType)) {
        console.warn(`display type not recognized: ${this.state.displayType} - rendering as plain text`)
        return this.renderMessage(`display type not recognized: ${this.state.displayType}`)
      }
    }

    const displayTypeIsChart = isChartType(this.state.displayType)
    const displayTypeIsTable = isTableType(this.state.displayType)
    const displayTypeIsPivotTable = this.state.displayType === 'pivot_table'
    const allowsDisplayTypeChange = this.props.allowDisplayTypeChange

    const supportsCharts = this.currentlySupportsCharts()
    const supportsPivotTable = this.currentlySupportsPivot()
    const usePivotData = this.usePivotDataForChart()

    const columns = usePivotData ? this.pivotTableColumns : this.getColumns()
    const tableConfig = usePivotData ? this.pivotTableConfig : this.tableConfig
    const tableConfigIsValid = this.isTableConfigValid(tableConfig, columns, this.state.displayType)

    const shouldRenderChart = (allowsDisplayTypeChange || displayTypeIsChart) && supportsCharts && tableConfigIsValid
    const shouldRenderTable = allowsDisplayTypeChange || displayTypeIsTable
    const shouldRenderPivotTable = (allowsDisplayTypeChange || displayTypeIsPivotTable) && supportsPivotTable

    return (
      <>
        {shouldRenderTable && this.renderTable()}
        {shouldRenderChart && this.renderChart()}
        {shouldRenderPivotTable && this.renderPivotTable()}
      </>
    )
  }

  shouldRenderReverseTranslation = () => {
    return (
      getAutoQLConfig(this.props.autoQLConfig).enableQueryInterpretation &&
      this.props.showQueryInterpretation &&
      (this.queryResponse?.data?.data?.parsed_interpretation || this.queryResponse?.data?.data?.interpretation)
    )
  }

  getFilters = () => {
    const persistentFilters = this.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const sessionFilters = this.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
    return lockedFilters
  }

  renderReverseTranslation = () => {
    if (!this.shouldRenderReverseTranslation()) {
      return null
    }

    return (
      <ReverseTranslation
        authentication={this.props.authentication}
        onValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={this.getFilters() || []}
        isResizing={this.props.isResizing}
        queryResponse={this.queryResponse}
        tooltipID={this.props.tooltipID}
        subjects={this.props.subjects || []}
        queryOutputRef={this.responseContainerRef}
        allowColumnAddition={this.props.allowColumnAddition && this.state.displayType === 'table'}
        enableEditReverseTranslation={
          this.props.autoQLConfig?.enableEditReverseTranslation && !isDrilldown(this.queryResponse)
        }
        localRTFilterResponse={this.props.localRTFilterResponse}
      />
    )
  }

  renderFooter = () => {
    const shouldRenderRT = this.shouldRenderReverseTranslation()
    const footerClassName = `query-output-footer ${!shouldRenderRT ? 'no-margin' : ''} ${
      this.props.reverseTranslationPlacement
    }`

    return <div className={footerClassName}>{shouldRenderRT && this.renderReverseTranslation()}</div>
  }
  renderResizeHandle = () => {
    const self = this
    return (
      <div
        className='react-autoql-query-output-resize-handle bottom'
        onMouseDown={(e) => {
          e.preventDefault()

          this.setState({
            isResizing: true,
            resizeStartY: e.pageY,
            resizeStartHeight: this.responseContainerRef?.getBoundingClientRect()?.height || this.minHeight,
          })

          document.body.style.userSelect = 'none'
          document.body.style.webkitUserSelect = 'none'
          document.body.style.mozUserSelect = 'none'
          document.body.style.msUserSelect = 'none'

          document.addEventListener('mousemove', self.handleMouseMove)
          document.addEventListener('mouseup', self.handleMouseUp)
          document.addEventListener('mouseleave', self.handleMouseUp)
        }}
      />
    )
  }

  render = () => {
    const containerStyle = this.shouldEnableResize
      ? {
          height: this.state.height,
          position: 'relative',
        }
      : {}

    return (
      <ErrorBoundary>
        <div
          key={this.COMPONENT_KEY}
          ref={(r) => (this.responseContainerRef = r)}
          id={`react-autoql-response-content-container-${this.COMPONENT_KEY}`}
          data-test='query-response-wrapper'
          style={containerStyle}
          className={`react-autoql-response-content-container
        ${isTableType(this.state.displayType) ? 'table' : ''}
        ${isChartType(this.state.displayType) ? 'chart' : ''} 
        ${!isChartType(this.state.displayType) && !isTableType(this.state.displayType) ? 'non-table-non-chart' : ''}
        ${this.shouldEnableResize ? 'resizable' : ''}
        ${this.state.isResizing ? 'resizing' : ''}`}
        >
          {this.props.reverseTranslationPlacement === 'top' && this.renderFooter()}
          {this.renderResponse()}
          {this.props.reverseTranslationPlacement !== 'top' && this.renderFooter()}
        </div>
        {!this.props.tooltipID && !this.props.isResizing && !this.props.isUserResizing && (
          <Tooltip tooltipId={this.TOOLTIP_ID} />
        )}
        {!this.props.chartTooltipID && !this.props.isResizing && !this.props.isUserResizing && (
          <Tooltip tooltipId={this.CHART_TOOLTIP_ID} className='react-autoql-chart-tooltip' delayShow={0} />
        )}
        {this.renderAddColumnBtn()}
        {this.shouldEnableResize && this.renderResizeHandle()}
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryOutput)
