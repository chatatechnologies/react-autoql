import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _isEmpty from 'lodash.isempty'
import _cloneDeep from 'lodash.clonedeep'
import dayjs from '../../js/dayjsWithPlugins'

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
  formatTableParams,
  getColumnDateRanges,
  getFilterPrecision,
  getPrecisionForDayJS,
  dataFormattingDefault,
  autoQLConfigDefault,
  authenticationDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  getVisibleColumns,
  isDataLimited,
  MAX_CHART_ELEMENTS,
  formatAdditionalSelectColumn,
  setColumnVisibility,
  ColumnTypes,
  isColumnIndexConfigValid,
  getCleanColumnName,
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

    this.COMPONENT_KEY = uuid()
    this.QUERY_VALIDATION_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-query-output-chart-tooltip-${this.COMPONENT_KEY}`
    this.ALLOW_NUMERIC_STRING_COLUMNS = true
    this.MAX_PIVOT_TABLE_COLUMNS = 20

    let response = props.queryResponse

    this.queryResponse = response
    this.columnDateRanges = getColumnDateRanges(response)
    this.queryID = this.queryResponse?.data?.data?.query_id
    this.interpretation = this.queryResponse?.data?.data?.parsed_interpretation
    this.tableParams = {}
    this.tableID = uuid()
    this.pivotTableID = uuid()
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    this.isOriginalData = true
    this.renderComplete = false
    this.hasCalledInitialTableConfigChange = false

    // --------- generate data before mount --------
    this.generateAllData()
    // -------------------------------------------

    const additionalSelects = this.getAdditionalSelectsFromResponse(this.queryResponse)
    const columns = this.formatColumnsForTable(
      this.queryResponse?.data?.data?.columns,
      additionalSelects,
      props.initialAggConfig,
    )
    const customColumnSelects = this.getUpdatedCustomColumnSelects(additionalSelects, columns)

    // Supported display types may have changed after initial data generation
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()

    const displayType = this.getDisplayTypeFromInitial(props)
    if (props.onDisplayTypeChange) {
      props.onDisplayTypeChange(displayType)
    }

    // Set initial config if needed
    // If this config causes errors, it will be reset when the error occurs
    if (
      props.initialTableConfigs?.tableConfig &&
      this.isTableConfigValid(props.initialTableConfigs?.tableConfig, columns, displayType)
    ) {
      const { tableConfig } = props.initialTableConfigs
      this.tableConfig = _cloneDeep(tableConfig)
    }

    if (
      props.initialTableConfigs?.pivotTableConfig &&
      this.isTableConfigValid(props.initialTableConfigs?.pivotTableConfig, this.pivotTableColumns, displayType)
    ) {
      const { pivotTableConfig } = props.initialTableConfigs
      this.pivotTableConfig = _cloneDeep(pivotTableConfig)
    }

    // Set initial table params to be any filters or sorters that
    // are already present in the current query
    this.formattedTableParams = {
      filters: this.queryResponse?.data?.data?.fe_req?.filters || [],
      sorters: this.queryResponse?.data?.data?.fe_req?.sorters || [],
    }

    this.DEFAULT_TABLE_PAGE_SIZE = 100

    this.state = {
      displayType,
      aggConfig: props.initialAggConfig,
      supportedDisplayTypes: this.initialSupportedDisplayTypes,
      columns,
      selectedSuggestion: props.defaultSelectedSuggestion,
      columnChangeCount: 0,
      chartID: uuid(),
      customColumnSelects: customColumnSelects || [],
    }
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
    useInfiniteScroll: true,
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
    onTableConfigChange: () => { },
    onAggConfigChange: () => { },
    onQueryValidationSelectOption: () => { },
    onErrorCallback: () => { },
    onDrilldownStart: () => { },
    onDrilldownEnd: () => { },
    onColumnChange: () => { },
    onPageSizeChange: () => { },
    onMount: () => { },
    onBucketSizeChange: () => { },
    onNewData: () => { },
    onCustomColumnUpdate: () => { },
  }

  componentDidMount = () => {
    try {
      this._isMounted = true
      this.updateToolbars()
      this.props.onMount()
      this.forceUpdate()
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
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

      if (this.props.onDisplayTypeChange && this.state.displayType !== prevState.displayType) {
        this.props.onDisplayTypeChange(this.state.displayType)

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
        this.props.onColumnChange(
          this.queryResponse?.data?.data?.fe_req?.display_overrides,
          this.state.columns,
          this.queryResponse?.data?.data?.fe_req?.additional_selects,
          this.queryResponse,
          {
            tableConfig: this.tableConfig,
            pivotTableConfig: this.pivotTableConfig,
          },
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

      this.updateToolbars()

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
    try {
      this._isMounted = false
    } catch (error) {
      console.error(error)
    }
  }

  refreshLayout = () => {
    if (this.chartRef) {
      this.chartRef?.adjustChartPosition()
    }
  }

  onTableConfigChange = () => {
    this.props.onTableConfigChange({
      tableConfig: this.tableConfig,
      pivotTableConfig: this.pivotTableConfig,
    })
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
      if (typeof callback === 'function') {
        callback()
      }
    })
  }

  displayTypeInvalidWarning = (displayType) => {
    console.warn(
      `Initial display type "${this.props.initialDisplayType}" provided is not valid for this dataset. Using ${displayType || this.state.displayType
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
      const referenceIdNumber = Number(response.data.reference_id.split('.')[2])
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

  updateColumnsAndData = (response) => {
    if (response && this._isMounted) {
      this.pivotTableID = uuid()
      this.isOriginalData = false
      this.queryResponse = response
      this.tableData = response?.data?.data?.rows || []

      const additionalSelects = this.getAdditionalSelectsFromResponse(response)
      const newColumns = this.formatColumnsForTable(response?.data?.data?.columns, additionalSelects)
      const customColumnSelects = this.getUpdatedCustomColumnSelects(additionalSelects, newColumns)
      this.resetTableConfig(newColumns)

      const aggConfig = this.getAggConfig(newColumns)

      this.setState({
        columns: newColumns,
        columnChangeCount: this.state.columnChangeCount + 1,
        chartID: uuid(),
        aggConfig,
        customColumnSelects,
      })
    }
  }

  updateColumns = (columns, feReq) => {
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
          this.queryResponse.data.data.columns = newColumns
        }
        this.resetTableConfig(newColumns)
      }

      this.setState({
        columns: newColumns,
        aggConfig: this.getAggConfig(newColumns),
        columnChangeCount: this.state.columnChangeCount + 1,
        chartID: visibleColumnsChanged ? uuid() : this.state.chartID,
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

      this.setTableConfig()
      if (this._isMounted) {
        this.setState({ columns })
      }
    }
  }

  generatePivotData = ({ isFirstGeneration, dataChanged } = {}) => {
    try {
      this.pivotTableID = uuid()
      const columns = this.getColumns()
      if (getNumberOfGroupables(columns) === 1) {
        this.generateDatePivotData(this.tableData)
      } else {
        this.generatePivotTableData({ isFirstGeneration })
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
      this.pivotTableData = undefined
    }

    if (this.props.allowDisplayTypeChange) {
      this.pivotTableRef?.updateData(this.pivotTableData)
    }

    if (dataChanged && this._isMounted) {
      this.setState({ visiblePivotRowChangeCount: this.state.visiblePivotRowChangeCount + 1 })
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
    return (
      <div className='single-value-response-flex-container'>
        <div className='single-value-response-container'>
          <a
            className={`single-value-response ${getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? ' with-drilldown' : ''
              }`}
            onClick={() => {
              this.processDrilldown({ groupBys: [], supportedByAPI: true })
            }}
          >
            {this.props.showSingleValueResponseTitle && (
              <span>
                <strong>{this.state.columns?.[0]?.display_name}: </strong>
              </span>
            )}
            {formatElement({
              element: this.queryResponse.data.data.rows[0]?.[0] ?? 0,
              column: this.state.columns?.[0],
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
    const allFilters = this.getCombinedFilters()

    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    this.setState({ isLoadingData: true })

    let response

    if (this.isDrilldown()) {
      try {
        response = await runDrilldown({
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          source: this.props.source,
          scope: this.props.scope,
          debug: queryRequestData?.translation === 'include',
          filters: queryRequestData?.session_filter_locks,
          pageSize: queryRequestData?.page_size,
          test: queryRequestData?.test,
          groupBys: queryRequestData?.columns,
          queryID: this.props.originalQueryID,
          orders: this.formattedTableParams?.sorters,
          tableFilters: allFilters,
          cancelToken: this.axiosSource.token,
          ...args,
        })
      } catch (error) {
        response = this.handleQueryFnError(error)
      }
    } else {
      try {
        response = await runQueryOnly({
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          query: queryRequestData?.text,
          debug: queryRequestData?.translation === 'include',
          userSelection: queryRequestData?.disambiguation,
          filters: queryRequestData?.session_filter_locks,
          test: queryRequestData?.test,
          pageSize: queryRequestData?.page_size,
          orders: this.formattedTableParams?.sorters,
          tableFilters: allFilters,
          source: this.props.source,
          scope: this.props.scope,
          cancelToken: this.axiosSource.token,
          newColumns: queryRequestData?.additional_selects,
          displayOverrides: queryRequestData?.display_overrides,
          ...args,
        })
      } catch (error) {
        response = this.handleQueryFnError(error)
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

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  processDrilldown = async ({ groupBys, supportedByAPI, row, activeKey, stringColumnIndex, filter }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      try {
        // This will be a new query so we want to reset the page size back to default
        const pageSize = this.getDefaultQueryPageSize()

        if (supportedByAPI) {
          this.props.onDrilldownStart(activeKey)
          try {
            const response = await runDrilldown({
              ...getAuthentication(this.props.authentication),
              ...getAutoQLConfig(this.props.autoQLConfig),
              queryID: this.queryID,
              source: this.props.source,
              groupBys,
              pageSize,
            })
            this.props.onDrilldownEnd({
              response,
              originalQueryID: this.queryID,
            })
          } catch (error) {
            this.props.onDrilldownEnd({ response: error })
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

          const allFilters = this.getCombinedFilters(clickedFilter)
          let response
          try {
            response = await this.queryFn({ tableFilters: allFilters, pageSize })
          } catch (error) {
            response = error
          }

          this.props.onDrilldownEnd({ response, originalQueryID: this.queryID })
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
    } else if (column.type === 'DATE') {
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
  getCombinedFilters = (newFilter) => {
    const queryRequestData = this.queryResponse?.data?.data?.fe_req
    const queryFilters = queryRequestData?.filters || []
    const tableFilters = this.formattedTableParams?.filters || []

    const allFilters = []

    tableFilters.forEach((tableFilter) => {
      let filter = tableFilter

      const foundQueryFilter = queryFilters.find((filter) => filter.name === tableFilter.name)
      if (foundQueryFilter) {
        filter = {
          ...tableFilter,
          ...foundQueryFilter,
        }
      }

      allFilters.push(filter)
    })

    queryFilters.forEach((queryFilter) => {
      if (!allFilters.find((filter) => filter.name === queryFilter.name)) {
        allFilters.push(queryFilter)
      }
    })

    if (newFilter) {
      const existingClickedFilterIndex = allFilters.findIndex((filter) => filter.name === newFilter.name)
      if (existingClickedFilterIndex >= 0) {
        // Filter already exists, overwrite existing filter with clicked value
        allFilters[existingClickedFilterIndex] = newFilter
      } else {
        // Filter didn't exist yet, add it to the list
        allFilters.push(newFilter)
      }
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

    this.processDrilldown({ groupBys: groupBys ?? [], supportedByAPI: true })
  }

  onChartClick = ({ row, columnIndex, columns, stringColumnIndex, legendColumn, activeKey, filter }) => {
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
  }

  onNewData = (response) => {
    this.isOriginalData = false
    this.queryResponse = response
    this.tableData = response?.data?.data?.rows || []

    if (this.shouldGeneratePivotData()) {
      this.generatePivotData()
    }

    this.props.onNewData()

    this.setState({ chartID: uuid() })
  }

  onTableFilter = async (filters, rows) => {
    if (!filters || _isEqual(filters, this.tableParams?.filter)) {
      return
    }

    this.tableParams.filter = _cloneDeep(filters)
    this.formattedTableParams = formatTableParams(this.tableParams, this.getColumns())
  }

  onTableSort = (sorters) => {
    this.tableParams.sort = _cloneDeep(sorters)
  }

  onLegendClick = (d) => {
    if (!d) {
      console.debug('no legend item was provided on click event')
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

    if (this.tableConfig.legendColumnIndex === index) {
      let stringColumnIndex = this.tableConfig.stringColumnIndex
      this.tableConfig.stringColumnIndex = this.tableConfig.legendColumnIndex
      this.tableConfig.legendColumnIndex = stringColumnIndex
    } else {
      this.tableConfig.stringColumnIndex = index
    }

    if (this.tableConfig.numberColumnIndices.includes(index)) {
      const numberColumnIndices = getNumberColumnIndices(this.getColumns())?.allNumberColumnIndices
      const newNumberColumnIndices = numberColumnIndices?.filter((i) => i !== index)
      this.tableConfig.numberColumnIndices = newNumberColumnIndices
      this.tableConfig.numberColumnIndex = newNumberColumnIndices[0]
    }

    if (this.tableConfig.numberColumnIndices2.includes(index)) {
      this.tableConfig.numberColumnIndices2 = this.tableConfig.numberColumnIndices2.filter((i) => i !== index)

      if (!this.tableConfig.numberColumnIndices2.length) {
        const numberColumnIndex2 = this.getColumns().find(
          (col) =>
            col.is_visible &&
            col.index !== index && // Must not be the same as the string index
            !this.tableConfig.numberColumnIndices.includes(col.index) && // Must not already be in the first number column index array
            isColumnNumberType(col), // Must be number type
        )?.index

        if (numberColumnIndex2 >= 0) {
          this.tableConfig.numberColumnIndex2 = numberColumnIndex2
          this.tableConfig.numberColumnIndices2 = [numberColumnIndex2]
        }
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

    if (this.usePivotDataForChart()) {
      this.generatePivotTableData()
    }

    this.onTableConfigChange()
    this.forceUpdate()
  }

  onChangeNumberColumnIndices = (indices, indices2, newColumns) => {
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
      } = getNumberColumnIndices(columns, this.usePivotDataForChart())

      this.pivotTableConfig.numberColumnIndices = numberColumnIndices
      this.pivotTableConfig.numberColumnIndex = numberColumnIndex
      this.pivotTableConfig.numberColumnIndices2 = numberColumnIndices2
      this.pivotTableConfig.numberColumnIndex2 = numberColumnIndex2
      this.pivotTableConfig.currencyColumnIndices = currencyColumnIndices
      this.pivotTableConfig.quantityColumnIndices = quantityColumnIndices
      this.pivotTableConfig.ratioColumnIndices = ratioColumnIndices
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

    // Set string type columns (ordinal axis)
    if (
      !this.tableConfig.stringColumnIndices ||
      !this.isColumnIndexValid(this.tableConfig.stringColumnIndex, columns)
    ) {
      const isPivot = false
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(
        columns,
        isPivot,
        this.ALLOW_NUMERIC_STRING_COLUMNS,
      )

      this.tableConfig.stringColumnIndices = stringColumnIndices
      this.tableConfig.stringColumnIndex = stringColumnIndex

      // If it set all of the columns to string column indices, remove one so it can be set as the number column index
      if (stringColumnIndices.length === getVisibleColumns(columns).length) {
        const indexToRemove = stringColumnIndices.findIndex((i) => i !== stringColumnIndex)
        if (indexToRemove > -1) {
          this.tableConfig.stringColumnIndices.splice(indexToRemove, 1)
        }
      }
    }

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
    } = getNumberColumnIndices(columns, this.usePivotDataForChart())

    // Set number type columns and number series columns (linear axis)
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

      if (this.tableConfig.numberColumnIndex === this.tableConfig.stringColumnIndex) {
        this.tableConfig.numberColumnIndex = allNumberColumnIndices.find(
          (index) => !this.tableConfig.stringColumnIndices.includes(index),
        )
        this.tableConfig.numberColumnIndices = [this.tableConfig.numberColumnIndex]
      }

      if (this.tableConfig.numberColumnIndex2 === this.tableConfig.stringColumnIndex) {
        this.tableConfig.numberColumnIndex2 = allNumberColumnIndices.find(
          (index) =>
            !this.tableConfig.stringColumnIndices.includes(index) &&
            !this.tableConfig.numberColumnIndices.includes(index),
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
      this.tableConfig.numberColumnIndex2 = columns.findIndex(
        (col, index) =>
          index !== this.tableConfig.numberColumnIndex &&
          index !== this.tableConfig.stringColumnIndex &&
          isColumnNumberType(col) &&
          col.is_visible,
      )
      this.tableConfig.numberColumnIndices2 = [this.tableConfig.numberColumnIndex2]
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
        this.tableConfig.numberColumnIndex2 = columns.findIndex(
          (col, i) => col.is_visible && isColumnNumberType(col) && i !== this.tableConfig.numberColumnIndex,
        )
        // If the new columnIndex2 is not already in the indices array, add it
        if (this.tableConfig.numberColumnIndices2.indexOf(this.tableConfig.numberColumnIndex2) === -1) {
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
      this.tableConfig.numberColumnIndex2 = columns.findIndex(
        (col, i) =>
          col.is_visible &&
          isColumnNumberType(col) &&
          i !== this.tableConfig.numberColumnIndex &&
          i !== this.tableConfig.numberColumnIndex2,
      )
      this.tableConfig.numberColumnIndices2 = [this.tableConfig.numberColumnIndex2]
    }

    // Set legend index if there should be one
    const legendColumnIndex = columns.findIndex(
      (col, i) => col.is_visible && col.groupable && i !== this.tableConfig.stringColumnIndex,
    )
    if (legendColumnIndex >= 0) {
      this.tableConfig.legendColumnIndex = legendColumnIndex
    }

    if (!_isEqual(prevTableConfig, this.tableConfig)) {
      this.onTableConfigChange()
    }
  }

  getPotentialDisplayTypes = () => {
    return getSupportedDisplayTypes({
      response: this.queryResponse,
      columns: this.getColumns(),
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
    if (col.type === 'DATE') {
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

          const formattedElement = formatElement({
            element: rowValue,
            column: col,
            config: self.props.dataFormatting,
          })

          const shouldFilter = `${formattedElement}`.toLowerCase().includes(`${headerValue}`.toLowerCase())

          return shouldFilter
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
          return false
        }
      }
    } else if (col.type === 'DOLLAR_AMT' || col.type === 'QUANTITY' || col.type === 'PERCENT' || col.type === 'RATIO') {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          if (!rowValue) {
            return false
          }

          const trimmedValue = headerValue.trim()
          if (trimmedValue.length >= 2) {
            const number = Number(trimmedValue.substr(1).replace(/[^0-9.]/g, ''))
            if (trimmedValue[0] === '>' && trimmedValue[1] === '=') {
              return rowValue >= number
            } else if (trimmedValue[0] === '>') {
              return rowValue > number
            } else if (trimmedValue[0] === '<' && trimmedValue[1] === '=') {
              return rowValue <= number
            } else if (trimmedValue[0] === '<') {
              return rowValue < number
            } else if (trimmedValue[0] === '!' && trimmedValue[1] === '=') {
              return rowValue !== number
            } else if (trimmedValue[0] === '=') {
              return rowValue === number
            }
          }

          // No logical operators detected, just compare numbers
          const number = parseFloat(rowValue?.replace(/[^0-9.]/g, ''))
          const filterNumber = parseFloat(headerValue?.replace(/[^0-9.]/g, ''))
          return !isNaN(number) && number === filterNumber
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
    if (col.type === 'DATE' || col.type === 'DATE_STRING') {
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
    if (col.type === 'DATE' && !col.pivot) {
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
      if (newCol.type === 'DATE') {
        newCol.minWidth = '125px'
      }

      newCol.maxWidth = '300px'

      // Cell alignment
      if (
        newCol.type === ColumnTypes.DOLLAR_AMT ||
        newCol.type === ColumnTypes.QUANTITY ||
        newCol.type === ColumnTypes.RATIO ||
        newCol.type === ColumnTypes.PERCENT
      ) {
        newCol.hozAlign = 'right'
      } else {
        newCol.hozAlign = 'center'
      }

      const drilldownGroupby = this.getDrilldownGroupby(this.queryResponse, newCol)

      newCol.cssClass = `${newCol.type}`
      if (drilldownGroupby) {
        newCol.cssClass = `${newCol.cssClass} DRILLDOWN`
      }

      // Cell formattingg
      newCol.formatter = (cell, formatterParams, onRendered) => {
        return formatElement({
          element: cell.getValue(),
          column: newCol,
          config: getDataFormatting(this.props.dataFormatting),
          htmlElement: cell.getElement(),
        })
      }

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      newCol.headerFilter = col.headerFilter ?? 'input'
      newCol.headerFilterPlaceholder = this.setHeaderFilterPlaceholder(newCol)

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
      if (aggConfig) {
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
        return newCol.type === 'DATE' && (rangeObj.columnName === newCol.display_name || !!newCol.groupable)
      })

      if (dateRange) {
        newCol.dateRange = dateRange
      }

      if (additionalSelects?.length > 0 && isColumnNumberType(newCol)) {
        const customSelect = additionalSelects.find((select) => {
          return select?.columns?.[0]?.replace(/ /g, '') === newCol?.name?.replace(/ /g, '')
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
    if (columns[dateColumnIndex].type === 'DATE') {
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
    if (columns[dateColumnIndex].type === 'DATE') {
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
        if (columns[dateColumnIndex].type === 'DATE') {
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
        })
      })

      const pivotTableData = makeEmptyArray(Object.keys(uniqueYears).length, 12)
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
          pivotTableData[monthNumber][yearNumber] = row[numberColumnIndex]
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

      let uniqueRowHeaders = sortDataByDate(tableData, columns, 'desc', 'isTable')
        .map((d) => d[stringColumnIndex])
        .filter(onlyUnique)

      let uniqueColumnHeaders = sortDataByDate(tableData, columns, 'desc', 'isTable')
        .map((d) => d[legendColumnIndex])
        .filter(onlyUnique)

      let newStringColumnIndex = stringColumnIndex
      let newLegendColumnIndex = legendColumnIndex

      // Make sure the longer list is in the legend, UNLESS its a date type
      // DATE types should always go in the axis if possible
      if (
        isFirstGeneration &&
        (isColumnDateType(columns[legendColumnIndex]) ||
          (uniqueColumnHeaders?.length > uniqueRowHeaders?.length &&
            (!isColumnDateType(columns[stringColumnIndex]) || uniqueColumnHeaders.length > MAX_LEGEND_LABELS)))
      ) {
        newStringColumnIndex = legendColumnIndex
        newLegendColumnIndex = stringColumnIndex

        const tempValues = [...uniqueRowHeaders]
        uniqueRowHeaders = [...uniqueColumnHeaders]
        uniqueColumnHeaders = tempValues
      }

      if (isColumnStringType(columns[newLegendColumnIndex]) && !isColumnDateType(columns[stringColumnIndex])) {
        uniqueColumnHeaders.sort((a, b) => a.localeCompare?.(b))
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
        cssClass: 'pivot-category',
        pivot: true,
        headerFilter: false,
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
        })
      })

      const pivotTableData = makeEmptyArray(
        uniqueColumnHeaders.length + 1, // Add one for the frozen first column
        uniqueRowHeaders.length,
      )

      tableData.forEach((row) => {
        const pivotRowIndex = uniqueRowHeadersObj[row[newStringColumnIndex]]
        const pivotRowHeaderValue = row[newStringColumnIndex]
        if (!pivotRowHeaderValue || !pivotTableData[pivotRowIndex]) {
          return
        }

        // Populate first column
        pivotTableData[pivotRowIndex][0] = pivotRowHeaderValue

        // Populate remaining columns
        const pivotValue = Number(row[numberColumnIndex])
        const pivotColumnIndex = uniqueColumnHeadersObj[row[newLegendColumnIndex]] + 1
        pivotTableData[pivotRowIndex][pivotColumnIndex] = pivotValue
        if (pivotTableColumns[pivotColumnIndex]) {
          pivotTableColumns[pivotColumnIndex].origValues[pivotRowHeaderValue] = {
            name: columns[newStringColumnIndex]?.name,
            drill_down: columns[newStringColumnIndex]?.drill_down,
            value: pivotRowHeaderValue,
          }
        }
      })

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = this.pivotTableData?.length ?? 0
      this.setPivotTableConfig(true)
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
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

  isDrilldown = () => {
    try {
      const queryText = this.queryResponse?.data?.data?.text || ''
      const isDrilldown = queryText.split(':')[0] === 'Drilldown'
      return isDrilldown
    } catch (error) {
      return false
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
        })
    } else if (!column) {
      // Add a custom column
      this.tableRef?.addCustomColumn()
    } else {
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

      this.queryFn({
        newColumns: [...currentAdditionalSelectColumns, formatAdditionalSelectColumn(column, sqlFn)],
        displayOverrides: [...currentDisplayOverrides, { english: column?.custom_column_display_name, table_column: column?.table_column }],
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
    if (this.props.allowColumnAddition && this.state.displayType === 'table') {
      return (
        <AddColumnBtn
          queryResponse={this.queryResponse}
          columns={this.state.columns}
          tooltipID={this.props.tooltipID}
          onAddColumnClick={this.onAddColumnClick}
          onCustomClick={this.onAddColumnClick}
          disableAddCustomColumnOption={this.isDrilldown()}
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

    return (
      <ErrorBoundary>
        <ChataTable
          key={this.tableID}
          autoHeight={this.props.autoHeight}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          dataFormatting={this.props.dataFormatting}
          ref={(ref) => (this.tableRef = ref)}
          columns={this.state.columns}
          response={this.queryResponse}
          updateColumns={this.updateColumns}
          columnDateRanges={this.columnDateRanges}
          onCellClick={this.onTableCellClick}
          queryID={this.queryID}
          useInfiniteScroll={this.props.useInfiniteScroll}
          onFilterCallback={this.onTableFilter}
          onSorterCallback={this.onTableSort}
          onTableParamsChange={this.onTableParamsChange}
          onNewData={this.onNewData}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing}
          queryRequestData={this.queryResponse?.data?.data?.fe_req}
          queryText={this.queryResponse?.data?.data?.text}
          originalQueryID={this.props.originalQueryID}
          isDrilldown={this.isDrilldown()}
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
          autoQLConfig={this.props.autoQLConfig}
          dataFormatting={this.props.dataFormatting}
          columns={this.pivotTableColumns}
          data={this.pivotTableData}
          onCellClick={this.onTableCellClick}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing}
          hidden={this.state.displayType !== 'pivot_table'}
          useInfiniteScroll={false}
          supportsDrilldowns={true}
          autoHeight={this.props.autoHeight}
          source={this.props.source}
          scope={this.props.scope}
          tooltipID={this.props.tooltipID}
          response={this.queryResponse}
          pivotTableRowsLimited={this.pivotTableRowsLimited}
          pivotTableColumnsLimited={this.pivotTableColumnsLimited}
          totalRows={this.pivotTableTotalRows}
          totalColumns={this.pivotTableTotalColumns}
          maxColumns={this.MAX_PIVOT_TABLE_COLUMNS}
          pivotGroups={true}
          pivot
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
          legendColumn={this.state.columns[this.tableConfig?.legendColumnIndex]}
          changeStringColumnIndex={this.onChangeStringColumnIndex}
          changeLegendColumnIndex={this.onChangeLegendColumnIndex}
          changeNumberColumnIndices={this.onChangeNumberColumnIndices}
          onChartClick={this.onChartClick}
          isResizing={this.props.isResizing}
          isAnimating={this.props.isAnimating}
          isDrilldownChartHidden={this.props.isDrilldownChartHidden}
          enableDynamicCharting={this.props.enableDynamicCharting}
          tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
          chartTooltipID={this.props.chartTooltipID ?? this.CHART_TOOLTIP_ID}
          height={this.props.height}
          width={this.props.width}
          onNewData={this.onNewData}
          isDrilldown={this.isDrilldown()}
          updateColumns={this.updateColumns}
          isDataLimited={isDataLimited(this.queryResponse) || isPivotDataLimited}
          source={this.props.source}
          scope={this.props.scope}
          queryFn={this.queryFn}
          onBucketSizeChange={this.props.onBucketSizeChange}
          bucketSize={this.props.bucketSize}
          queryID={this.queryResponse?.data?.data?.query_id}
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
                data-tooltip-content='Pressing the ESC key will cancel the current query request. If you wish to re-run your last query, simply press the UP arrow in the input bar then hit ENTER.'
                data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
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
      this.queryResponse?.data?.data?.parsed_interpretation
    )
  }

  getFilters = () => {
    const persistentFilters = this.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const sessionFilters = this.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
    return lockedFilters
  }

  renderReverseTranslation = () => {
    return (
      <ReverseTranslation
        authentication={this.props.authentication}
        onValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={this.getFilters()}
        isResizing={this.props.isResizing}
        queryResponse={this.queryResponse}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  renderFooter = () => {
    const shouldRenderRT = this.shouldRenderReverseTranslation()
    const footerClassName = `query-output-footer ${!shouldRenderRT ? 'no-margin' : ''} ${this.props.reverseTranslationPlacement
      }`

    return <div className={footerClassName}>{shouldRenderRT && this.renderReverseTranslation()}</div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          key={this.COMPONENT_KEY}
          ref={(r) => (this.responseContainerRef = r)}
          id={`react-autoql-response-content-container-${this.COMPONENT_KEY}`}
          data-test='query-response-wrapper'
          className={`react-autoql-response-content-container
          ${isTableType(this.state.displayType) ? 'table' : ''}
          ${isChartType(this.state.displayType) ? 'chart' : ''} 
		      ${!isChartType(this.state.displayType) && !isTableType(this.state.displayType) ? 'non-table-non-chart' : ''}`}
        >
          {this.props.reverseTranslationPlacement === 'top' && this.renderFooter()}
          {this.renderResponse()}
          {this.props.reverseTranslationPlacement !== 'top' && this.renderFooter()}
        </div>
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} />}
        {!this.props.chartTooltipID && <Tooltip tooltipId={this.CHART_TOOLTIP_ID} />}
        {this.renderAddColumnBtn()}
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryOutput)
