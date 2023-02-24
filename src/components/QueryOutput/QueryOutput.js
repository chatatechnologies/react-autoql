import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _isEmpty from 'lodash.isempty'
import _cloneDeep from 'lodash.clonedeep'
import dayjs from '../../js/dayjsWithPlugins'
import parse from 'html-react-parser'
import axios from 'axios'

import { dataFormattingType, autoQLConfigType, authenticationType } from '../../props/types'
import {
  dataFormattingDefault,
  autoQLConfigDefault,
  authenticationDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
} from '../../props/defaults'

import { ChataTable } from '../ChataTable'
import { ChataChart } from '../Charts/ChataChart'
import { QueryValidationMessage } from '../QueryValidationMessage'
import { Icon } from '../Icon'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import errorMessages, { responseErrors } from '../../js/errorMessages'

import {
  onlyUnique,
  formatElement,
  makeEmptyArray,
  getSupportedDisplayTypes,
  getDefaultDisplayType,
  isDisplayTypeValid,
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
} from '../../js/Util.js'

import {
  isColumnNumberType,
  isColumnStringType,
  getNumberColumnIndices,
  getDateColumnIndex,
  getStringColumnIndices,
  isAggregation,
  isColumnDateType,
} from './columnHelpers.js'

import { sendSuggestion, runDrilldown, runQueryOnly } from '../../js/queryService'
import { MONTH_NAMES, DEFAULT_DATA_PAGE_SIZE, CHART_TYPES, MAX_DATA_PAGE_SIZE } from '../../js/Constants'
import { ReverseTranslation } from '../ReverseTranslation'
import { getColumnDateRanges, getFilterPrecision, getPrecisionForDayJS } from '../../js/dateUtils'
import { withTheme } from '../../theme'

import './QueryOutput.scss'

String.prototype.isUpperCase = function () {
  return this.valueOf().toUpperCase() === this.valueOf()
}

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, (txt) => {
    if (txt.isUpperCase()) {
      return txt
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}

export class QueryOutput extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.QUERY_VALIDATION_KEY = uuid()

    this.queryResponse = _cloneDeep(props.queryResponse)
    this.columnDateRanges = getColumnDateRanges(props.queryResponse)
    this.queryID = _get(this.queryResponse, 'data.data.query_id')
    this.interpretation = _get(this.queryResponse, 'data.data.parsed_interpretation')
    this.tableParams = {}
    this.tableID = uuid()
    this.pivotTableID = uuid()
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    this.isOriginalData = true

    // Set initial columns if needed
    let columns = this.formatColumnsForTable(this.queryResponse?.data?.data?.columns)
    if (props.initialColumns && this.areColumnsValid(props.initialColumns)) {
      columns = props.initialColumns
    }

    // Set initial config if needed
    // If this config causes errors, it will be reset when the error occurs
    if (
      props.initialTableConfigs?.tableConfig &&
      this.isTableConfigValid(props.initialTableConfigs?.tableConfig, columns)
    ) {
      const { tableConfig, pivotTableConfig } = props.initialTableConfigs
      this.tableConfig = _cloneDeep(tableConfig)
      this.pivotTableConfig = _cloneDeep(pivotTableConfig)
    }

    // --------- generate data before mount --------
    this.generateAllData()
    // -------------------------------------------

    // Supported display types may have changed after initial data generation
    this.initialSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()

    const displayType = this.getDisplayTypeFromInitial(props)
    if (props.onDisplayTypeChange) {
      props.onDisplayTypeChange(displayType)
    }

    // Set initial table params to be any filters or sorters that
    // are already present in the current query
    this.formattedTableParams = {
      filters: this.queryResponse?.data?.data?.fe_req?.filters || [],
      sorters: this.queryResponse?.data?.data?.fe_req?.sorters || [],
    }

    this.state = {
      displayType,
      supportedDisplayTypes: this.initialSupportedDisplayTypes,
      columns,
      selectedSuggestion: props.defaultSelectedSuggestion,
      visiblerows: this.queryResponse?.data?.data?.rows,
      visibleRowChangeCount: 0,
      visiblePivotRowChangeCount: 0,
      columnChangeCount: 0,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    initialTableConfigs: PropTypes.shape({}),

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
    onNoneOfTheseClick: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onRTValueLabelClick: PropTypes.func,
    isTaskModule: PropTypes.bool,
    onDrilldownStart: PropTypes.func,
    onDrilldownEnd: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
    enableTableSorting: PropTypes.bool,
    rebuildTooltips: PropTypes.func,
    onRowChange: PropTypes.func,
    mutable: PropTypes.bool,
    showSuggestionPrefix: PropTypes.bool,
    onDisplayTypeChange: PropTypes.func,
    onColumnChange: PropTypes.func,
    shouldRender: PropTypes.bool,
    dataPageSize: PropTypes.number,
    onPageSizeChange: PropTypes.func,
    allowDisplayTypeChange: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    initialTableConfigs: undefined,

    queryResponse: undefined,
    initialDisplayType: null,
    onSuggestionClick: undefined,
    autoSelectQueryValidationSuggestion: true,
    queryValidationSelections: undefined,
    renderSuggestionsAsDropdown: false,
    defaultSelectedSuggestion: undefined,
    reverseTranslationPlacement: 'bottom',
    activeChartElementKey: undefined,
    isResizing: false,
    enableDynamicCharting: true,
    onNoneOfTheseClick: undefined,
    autoChartAggregations: true,
    enableFilterLocking: false,
    showQueryInterpretation: false,
    isTaskModule: false,
    enableAjaxTableData: false,
    enableTableSorting: true,
    preferredDisplayType: undefined,
    onRTValueLabelClick: undefined,
    mutable: true,
    showSuggestionPrefix: true,
    shouldRender: true,
    dataPageSize: undefined,
    allowDisplayTypeChange: true,
    onRowChange: () => {},
    onTableConfigChange: () => {},
    onQueryValidationSelectOption: () => {},
    onErrorCallback: () => {},
    onDrilldownStart: () => {},
    onDrilldownEnd: () => {},
    onColumnChange: () => {},
    onPageSizeChange: () => {},
  }

  componentDidMount = () => {
    try {
      this._isMounted = true
      this.updateToolbars()
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!nextProps.shouldRender) {
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

      // If data config was changed here, tell the parent
      if (
        !_isEqual(this.props.initialTableConfigs, {
          tableConfig: this.tableConfig,
          pivotTableConfig: this.pivotTableConfig,
        }) &&
        this.props.onTableConfigChange
      ) {
        this.onTableConfigChange()
      }

      if (prevState.displayType !== this.state.displayType) {
        this.rebuildTooltips()
      }

      if (
        this.state.visibleRows?.length !== prevState.visibleRows?.length ||
        (this.state.displayType === 'table' && prevState.displayType === 'text')
      ) {
        // Wait for tabulator to finish rendering in DOM
        setTimeout(() => {
          this.props.onRowChange()
        }, 0)
      }

      // If columns changed, regenerate data if necessary
      // If table filtered or columns changed, regenerate pivot data and supported display types
      // Using a count variable so it doesn't have to deep compare on every udpate
      const columnsChanged = this.state.columnChangeCount !== prevState.columnChangeCount
      const rowsChanged = this.state.visibleRowChangeCount !== prevState.visibleRowChangeCount
      if (columnsChanged || rowsChanged) {
        if (columnsChanged) {
          this.setTableConfig()
          this.props.onColumnChange(this.state.columns)
        }

        if (this.shouldGeneratePivotData()) {
          this.generatePivotData({
            isFirstGeneration: true,
            newTableData: this.state.visibleRows,
          })
          shouldForceUpdate = true
        }

        const newSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
        if (!_isEqual(newSupportedDisplayTypes, this.state.supportedDisplayTypes)) {
          newState.supportedDisplayTypes = newSupportedDisplayTypes
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
      ReactTooltip.hide()
      clearTimeout(this.rebuildTooltipsTimer)
    } catch (error) {
      console.error(error)
    }
  }

  refreshLayout = () => {
    if (this.chartRef) {
      this.chartRef?.adjustChartPosition()
    }
  }

  rebuildTooltips = (delay = 500) => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips(delay)
    } else {
      clearTimeout(this.rebuildTooltipsTimer)
      this.rebuildTooltipsTimer = setTimeout(() => {
        ReactTooltip.rebuild()
      }, delay)
    }
    return
  }

  onTableConfigChange = () => {
    this.props.onTableConfigChange({
      tableConfig: this.tableConfig,
      pivotTableConfig: this.pivotTableConfig,
    })
  }

  changeDisplayType = (displayType) => {
    if (this.props.onDisplayTypeChange) {
      this.props.onDisplayTypeChange(displayType)
    }

    this.setState({ displayType })
  }

  displayTypeInvalidWarning = (displayType) => {
    console.warn(
      `Initial display type "${this.props.initialDisplayType}" provided is not valid for this dataset. Using ${
        displayType || this.state.displayType
      } instead.`,
    )
  }

  getDataLength = () => {
    return this.state?.visibleRows ? this.state?.visibleRows?.length : this.tableData?.length
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
      this.isDataLimited(),
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
        this.isDataLimited(),
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
      console.warn('Invalid reference ID provided for error')
    }
    return true
  }

  getColumns = () => {
    if (this._isMounted) {
      return this.state.columns
    }

    return this.formatColumnsForTable(this.queryResponse?.data?.data?.columns)
  }

  supportsPivot = () => {
    const potentialDisplayTypes = this.getPotentialDisplayTypes()
    return potentialDisplayTypes?.includes('pivot_table')
  }

  supportsDatePivot = () => {
    const columns = this.getColumns()
    return this.supportsPivot() && columns?.length === 2
  }

  usePivotDataForChart = () => {
    return this.supportsPivot() && !this.supportsDatePivot()
  }

  areColumnsValid = (columns) => {
    /* Each provided column must exist in the original
       query response columns for it to be valid */
    const origColumns = this.queryResponse?.data?.data?.columns

    if (!columns?.length || !origColumns?.length) {
      return false
    }

    return columns.every((column) =>
      origColumns.find((origColumn) => {
        column.name === origColumn.name
      }),
    )
  }

  isTableConfigValid = (tableConfig, columns) => {
    try {
      if (
        !tableConfig ||
        !tableConfig.numberColumnIndices ||
        !tableConfig.stringColumnIndices ||
        isNaN(Number(tableConfig.numberColumnIndex)) ||
        isNaN(Number(tableConfig.stringColumnIndex))
      ) {
        console.debug('Table config provided was incomplete')
        return false
      }

      if (!Array.isArray(tableConfig.numberColumnIndices)) {
        console.debug('Number column indices array not valid in table config')
        return false
      }

      if (!Array.isArray(tableConfig.stringColumnIndices)) {
        console.debug('String column indices array not valid in table config')
        return false
      }

      if (
        !isNaN(tableConfig.numberColumnIndex) &&
        !isNaN(tableConfig.numberColumnIndex2) &&
        tableConfig.numberColumnIndex === tableConfig.numberColumnIndex2
      ) {
        console.debug('Both axes reference the same number column index')
        return false
      }

      if (
        tableConfig.numberColumnIndices.length &&
        tableConfig.numberColumnIndices2.length &&
        tableConfig.numberColumnIndices.filter((index) => tableConfig.numberColumnIndices2.includes(index)).length
      ) {
        console.debug('Both axes reference one or more of the same number column index')
        return false
      }

      const areNumberColumnsValid = tableConfig.numberColumnIndices.every((index) => {
        return columns[index] && isColumnNumberType(columns[index])
      })

      if (!areNumberColumnsValid) {
        console.debug('Saved number indices are not number columns')
        return false
      }

      const areStringColumnsValid = tableConfig.stringColumnIndices.every((index) => {
        return columns[index] && isColumnStringType(columns[index])
      })
      if (!areStringColumnsValid) {
        console.debug('Saved string indices are not string columns')
        return false
      }

      // To keep dashboards backwards compatible, we need to add
      // numberColumnIndices2 array to the tableConfig
      if (!tableConfig.numberColumnIndices2) {
        const { numberColumnIndices2, numberColumnIndex2 } = getNumberColumnIndices(
          columns,
          this.usePivotDataForChart(),
        )
        tableConfig.numberColumnIndices2 = numberColumnIndices2
        tableConfig.numberColumnIndex2 = numberColumnIndex2
      }

      return true
    } catch (error) {
      console.debug('Saved table config was not valid for dashboard tile response:', error?.message)
      return false
    }
  }

  updateColumns = (columns) => {
    if (columns && this._isMounted) {
      // Change table ID so a new ChataTable mounts after column change
      // An alternative would be to manually set the new columns in tabulator:
      // this.tableRef.ref.table.setColumns(columns)
      // this.tableID = uuid()
      this.setState({
        columns: this.formatColumnsForTable(columns),
        columnChangeCount: this.state.columnChangeCount + 1,
      })
    }
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
    return (this.state?.visibleRows || this.tableData) && this.supportsPivot()
  }

  shouldGenerateTableData = () => {
    return !!this.queryResponse?.data?.data?.rows
  }

  generateTableData = (cols, newTableData) => {
    if (newTableData) {
      this.tableData = newTableData
    } else {
      const columns = cols || this.getColumns()

      if (!this.isDataLimited()) {
        this.tableData = sortDataByDate(this.queryResponse?.data?.data?.rows, columns, 'desc', 'isTable')
      } else {
        this.tableData = this.queryResponse?.data?.data?.rows
      }

      this.setTableConfig()
      if (this._isMounted) {
        this.setState({ columns })
      }
    }
  }

  generatePivotData = ({ isFirstGeneration } = {}) => {
    try {
      this.pivotTableID = uuid()
      const tableData = this.state?.visibleRows || this.tableData
      const columns = this.getColumns()
      if (columns.length === 2) {
        this.generateDatePivotData(tableData)
      } else {
        this.generatePivotTableData({
          isFirstGeneration,
        })
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
      this.pivotTableData = undefined
    }

    this.pivotTableRef?.updateData(this.pivotTableData)
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
            className={`single-value-response ${
              getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns ? ' with-drilldown' : ''
            }`}
            onClick={() => {
              this.processDrilldown({ groupBys: [], supportedByAPI: true })
            }}
          >
            {formatElement({
              element: _get(this.queryResponse, 'data.data.rows[0][0]'),
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

  queryFn = (args = {}) => {
    const queryRequestData = this.queryResponse?.data?.data?.fe_req
    const allFilters = this.getCombinedFilters()

    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()

    if (this.isDrilldown()) {
      return runDrilldown({
        ...getAuthentication(this.props.authentication),
        ...getAutoQLConfig(this.props.autoQLConfig),
        source: queryRequestData?.source,
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
    }
    return runQueryOnly({
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      query: queryRequestData?.text,
      source: queryRequestData?.source,
      debug: queryRequestData?.translation === 'include',
      userSelection: queryRequestData?.disambiguation,
      filters: queryRequestData?.session_filter_locks,
      test: queryRequestData?.test,
      pageSize: queryRequestData?.page_size,
      orders: this.formattedTableParams?.sorters,
      tableFilters: allFilters,
      cancelToken: this.axiosSource.token,
      ...args,
    })
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
    this.axiosSource?.cancel(responseErrors.CANCELLED)
  }

  processDrilldown = async ({ groupBys, supportedByAPI, row, activeKey, stringColumnIndex }) => {
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
        } else if (!isNaN(stringColumnIndex) && !!row?.length) {
          this.props.onDrilldownStart(activeKey)

          if (!this.isDataLimited()) {
            // ------------ 1. Use FE for filter drilldown -----------
            const response = this.getFilterDrilldown({ stringColumnIndex, row })
            setTimeout(() => {
              this.props.onDrilldownEnd({ response })
            }, 1500)
            // -------------------------------------------------------
          } else {
            // --------- 2. Use subquery for filter drilldown --------
            const clickedFilter = this.constructFilter({
              column: this.state.columns[stringColumnIndex],
              value: row[stringColumnIndex],
            })

            const allFilters = this.getCombinedFilters(clickedFilter)
            let response
            try {
              response = await this.queryFn({ tableFilters: allFilters, pageSize })
            } catch (error) {
              response = error
            }

            this.props.onDrilldownEnd({ response, originalQueryID: this.queryID })
            // -------------------------------------------------------
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
    }

    return {
      name: column.name,
      operator,
      value: formattedValue,
    }
  }

  // Function to combine original query filters and current table filters
  getCombinedFilters = (newFilter) => {
    const queryRequestData = this.queryResponse?.data?.data?.fe_req
    const queryFilters = queryRequestData?.filters || []
    const tableFilters = this.formattedTableParams?.filters || []

    const allFilters = []

    tableFilters.forEach((tableFilter) => {
      const foundQueryFilter = queryFilters.find((filter) => filter.name === tableFilter.name)
      allFilters.push(foundQueryFilter ?? tableFilter)
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

    return allFilters
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
      if (this.supportsDatePivot()) {
        // Date pivot table
        const dateColumnIndex = getDateColumnIndex(columns)
        const year = cell.getColumn()?.getDefinition()?.title
        const month = cell.getData()?.[0]
        const value = this.pivotOriginalColumnData?.[year]?.[month]

        groupBys = [
          {
            name: columns[dateColumnIndex]?.name,
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

    this.processDrilldown({ groupBys, supportedByAPI: !!groupBys })
  }

  onChartClick = ({ row, columnIndex, columns, stringColumnIndex, legendColumn, activeKey }) => {
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
        value,
      })
    } else if (stringColumn?.groupable) {
      groupBys.push({
        name: stringColumn.name,
        value: `${row?.[stringColumnIndex]}`,
      })
    }

    if (legendColumn?.groupable) {
      if (column.origColumn) {
        // It is pivot data, add extra groupby
        groupBys.push({
          name: legendColumn.name,
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
      this.props.vizToolbarRef.forceUpdate()
    }
  }

  updateOptionsToolbar = () => {
    if (this.props.optionsToolbarRef?._isMounted) {
      this.props.optionsToolbarRef.forceUpdate()
    }
  }

  toggleTableFilter = () => {
    if (this.state.displayType === 'table') {
      return this.tableRef?._isMounted && this.tableRef.toggleIsFiltering()
    }

    if (this.state.displayType === 'pivot_table') {
      return this.pivotTableRef?._isMounted && this.pivotTableRef.toggleIsFiltering()
    }
  }

  onNewPage = (rows) => {
    if (!rows?.length) {
      return
    }

    try {
      this.tableData = [...this.tableData, ...rows]

      this.setState({
        visibleRowChangeCount: this.state.visibleRowChangeCount + 1,
        visibleRows: this.tableData,
      })
    } catch (error) {
      console.error(error)
    }
  }

  onTableParamsChange = (params, formattedTableParams = {}) => {
    this.tableParams = _cloneDeep(params)
    this.formattedTableParams = formattedTableParams
  }

  onNewData = (response, pageSize) => {
    this.isOriginalData = false
    this.queryResponse = response
    const responseData = response?.data?.data
    this.tableData = responseData?.rows || []

    if (this.state.displayType !== 'table') {
      if (this.tableData.length >= responseData?.count_rows) {
        // The rows were changed from a chart - If it is the maximum page size, we dont want
        // infinite scroll anymore - mount a new table with the new data
        this.tableID = uuid()
      } else {
        this.tableRef?.updateData(this.tableData)
      }
    }

    this.setState({
      visibleRows: response.data.data.rows,
      visibleRowChangeCount: this.state.visibleRowChangeCount + 1,
    })

    const dataPageSize = pageSize ?? response?.data?.data?.fe_req?.page_size
    this.props.onPageSizeChange(dataPageSize)
  }

  onTableFilter = async (filters, rows) => {
    if (!filters || _isEqual(filters, this.tableParams?.filters)) {
      return
    }

    this.tableParams.filters = _cloneDeep(filters)

    const newTableData = []
    rows.forEach((row) => {
      newTableData.push(row.getData())
    })

    this.setState({
      visibleRows: newTableData,
      visibleRowChangeCount: this.state.visibleRowChangeCount + 1,
    })
  }

  onTableSort = (sorters) => {
    this.tableParams.sorters = _cloneDeep(sorters)
  }

  onLegendClick = (d) => {
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
      const formattedColumns = this.formatColumnsForTable(newColumns)
      this.setState({ columns: formattedColumns })
    }
  }

  onChangeStringColumnIndex = (index) => {
    if (this.usePivotDataForChart()) {
      if (this.pivotTableConfig.legendColumnIndex === index) {
        this.pivotTableConfig.legendColumnIndex = undefined
      }
      this.pivotTableConfig.stringColumnIndex = index
      this.generatePivotTableData()
    } else {
      if (this.tableConfig.legendColumnIndex === index) {
        this.tableConfig.legendColumnIndex = undefined
      }
      this.tableConfig.stringColumnIndex = index
    }

    this.forceUpdate()
  }

  onChangeLegendColumnIndex = (index) => {
    if (this.usePivotDataForChart()) {
      if (this.pivotTableConfig.stringColumnIndex === index) {
        this.pivotTableConfig.stringColumnIndex = undefined
      }
      this.pivotTableConfig.legendColumnIndex = index

      this.generatePivotTableData()
    } else {
      if (this.tableConfig.stringColumnIndex === index) {
        this.tableConfig.stringColumnIndex = undefined
      }
      this.tableConfig.legendColumnIndex = index
    }
    this.forceUpdate()
  }

  onChangeNumberColumnIndices = (indices, indices2, newColumns) => {
    if (!indices) {
      return
    }

    if (this.usePivotDataForChart()) {
      this.pivotTableConfig.numberColumnIndices = indices
      this.pivotTableConfig.numberColumnIndex = indices[0]
      if (indices2) {
        this.pivotTableConfig.numberColumnIndices2 = indices2
        this.pivotTableConfig.numberColumnIndex2 = indices2[0]
      }

      // Todo: pivot columns should live in state
      if (newColumns) {
        this.pivotTableColumns = newColumns
      }

      this.forceUpdate()
    } else {
      this.tableConfig.numberColumnIndices = indices
      this.tableConfig.numberColumnIndex = indices[0]
      if (indices2) {
        this.tableConfig.numberColumnIndices2 = indices2
        this.tableConfig.numberColumnIndex2 = indices2[0]
      }

      const columns = newColumns ?? this.state.columns
      this.updateColumns(columns)
    }
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
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(columns, 'supportsPivot')
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

  setTableConfig = () => {
    const columns = this.getColumns()
    if (!columns) {
      return
    }

    const prevTableConfig = _cloneDeep(this.tableConfig)

    if (!this.tableConfig) {
      this.tableConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (!this.tableConfig.stringColumnIndices || !(this.tableConfig.stringColumnIndex >= 0)) {
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(columns)
      this.tableConfig.stringColumnIndices = stringColumnIndices
      this.tableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (!this.tableConfig.numberColumnIndices || !(this.tableConfig.numberColumnIndex >= 0)) {
      const {
        numberColumnIndex,
        numberColumnIndices,
        numberColumnIndex2,
        numberColumnIndices2,
        currencyColumnIndices,
        quantityColumnIndices,
        ratioColumnIndices,
      } = getNumberColumnIndices(columns, this.usePivotDataForChart())
      this.tableConfig.numberColumnIndices = numberColumnIndices
      this.tableConfig.numberColumnIndex = numberColumnIndex
      this.tableConfig.numberColumnIndices2 = numberColumnIndices2
      this.tableConfig.numberColumnIndex2 = numberColumnIndex2
      this.tableConfig.currencyColumnIndices = currencyColumnIndices
      this.tableConfig.quantityColumnIndices = quantityColumnIndices
      this.tableConfig.ratioColumnIndices = ratioColumnIndices
    }

    // Set legend index if there should be one
    const legendColumnIndex = columns.findIndex((col, i) => col.groupable && i !== this.tableConfig.stringColumnIndex)
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
      columns: this.queryResponse?.data?.data?.columns?.map((col) => ({
        ...col,
      })),
    })
  }

  isCurrentDisplayTypeValid = () => {
    return isDisplayTypeValid(
      this.queryResponse,
      this.state.displayType,
      this.getDataLength(),
      this.getPivotDataLength(),
      this.getColumns(),
      this.isDataLimited(),
    )
  }

  getCurrentSupportedDisplayTypes = () => {
    return getSupportedDisplayTypes({
      response: this.queryResponse,
      columns: this.getColumns(),
      dataLength: this.getDataLength(),
      pivotDataLength: this.getPivotDataLength(),
      isDataLimited: this.isDataLimited(),
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

  formatColumnsForTable = (columns) => {
    // todo: do this inside of chatatable
    if (!columns) {
      return null
    }

    const isListQuery = getNumberOfGroupables(columns) === 0

    const formattedColumns = columns.map((col, i) => {
      const newCol = _cloneDeep(col)

      newCol.id = uuid()
      newCol.field = `${i}`
      newCol.title = col.display_name

      // Visibility flag: this can be changed through the column visibility editor modal
      newCol.visible = col.is_visible
      newCol.download = col.is_visible

      newCol.minWidth = '90px'
      if (newCol.type === 'DATE') {
        newCol.minWidth = '125px'
      }

      // Cell alignment
      if (newCol.type === 'DOLLAR_AMT' || newCol.type === 'RATIO' || newCol.type === 'NUMBER') {
        newCol.hozAlign = 'right'
      } else {
        newCol.hozAlign = 'center'
      }

      newCol.cssClass = `${newCol.type} ${drilldownGroupby ? 'DRILLDOWN' : null}`

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
      newCol.headerFilter = 'input'
      newCol.headerFilterPlaceholder = this.setHeaderFilterPlaceholder(newCol)

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      newCol.headerFilterFunc = this.setFilterFunction(newCol)

      // Allow proper chronological sorting for date strings
      newCol.sorter = this.setSorterFunction(newCol)
      newCol.headerSort = !!this.props.enableTableSorting
      newCol.headerSortStartingDir = 'desc'
      newCol.headerClick = () => {
        // To allow tabulator to sort, we must first restore redrawing,
        // then the component will disable it again afterwards automatically
        this.tableRef?.ref?.restoreRedraw()
      }

      // Show drilldown filter value in column title so user knows they can't filter on this column
      const drilldownGroupby = this.queryResponse?.data?.data?.fe_req?.columns?.find(
        (column) => newCol.name === column.name,
      )
      if (drilldownGroupby) {
        newCol.isDrilldownColumn = true
        newCol.tooltipTitle = newCol.title
        newCol.title = `${newCol.title} <em>(Clicked: "${drilldownGroupby.value}")</em>`
      }

      // Set aggregate type is data is list query
      if (isListQuery && isColumnNumberType(col)) {
        newCol.aggType = col.aggType || 'sum'
      }

      // Check if a date range is available
      const dateRange = this.columnDateRanges.find((rangeObj) => {
        return newCol.type === 'DATE' && (rangeObj.columnName === newCol.display_name || !!newCol.groupable)
      })

      if (dateRange) {
        newCol.dateRange = dateRange
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
        numberColumnIndex = columns.findIndex((col, index) => index !== dateColumnIndex && isColumnNumberType(col))
      }
      const tableData = newTableData || _get(this.queryResponse, 'data.data.rows')

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
      let tableData = this.state?.visibleRows || this.tableData || _get(this.queryResponse, 'data.data.rows')
      tableData = tableData.filter((row) => row[0] !== null)

      const columns = this.getColumns()

      const { legendColumnIndex, stringColumnIndex, numberColumnIndex } = this.tableConfig

      let uniqueValues0 = sortDataByDate(tableData, columns, 'desc', 'isTable')
        .map((d) => d[stringColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let uniqueValues1 = sortDataByDate(tableData, columns, 'desc', 'isTable')
        .map((d) => d[legendColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let newStringColumnIndex = stringColumnIndex
      let newLegendColumnIndex = legendColumnIndex
      // Make sure the longer list is in the legend, UNLESS its a date type
      // DATE types should always go in the axis if possible
      if (
        isFirstGeneration &&
        Object.keys(uniqueValues1).length > Object.keys(uniqueValues0).length &&
        !isColumnDateType(columns[stringColumnIndex])
      ) {
        newStringColumnIndex = legendColumnIndex
        newLegendColumnIndex = stringColumnIndex

        const tempValues = _cloneDeep(uniqueValues0)
        uniqueValues0 = _cloneDeep(uniqueValues1)
        uniqueValues1 = _cloneDeep(tempValues)
      }

      this.pivotColumnHeaders = uniqueValues1
      this.pivotRowHeaders = uniqueValues0
      this.tableConfig.legendColumnIndex = newLegendColumnIndex
      this.tableConfig.stringColumnIndex = newStringColumnIndex

      // Generate new column array
      const pivotTableColumns = [
        {
          ...columns[newStringColumnIndex],
          frozen: true,
          visible: true,
          is_visible: true,
          field: '0',
          cssClass: 'pivot-category',
          pivot: true,
          headerFilter: false,
        },
      ]

      Object.keys(uniqueValues1).forEach((columnName, i) => {
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
          field: `${i + 1}`,
          visible: true,
          is_visible: true,
          headerFilter: false,
        })
      })

      const pivotTableData = makeEmptyArray(
        Object.keys(uniqueValues1).length + 1, // Add one for the frozen first column
        Object.keys(uniqueValues0).length,
      )

      tableData.forEach((row) => {
        // Populate first column
        const pivotCategoryIndex = uniqueValues0[row[newStringColumnIndex]]
        const pivotCategoryValue = row[newStringColumnIndex]
        pivotTableData[pivotCategoryIndex][0] = pivotCategoryValue

        // Populate remaining columns
        const pivotColumnIndex = uniqueValues1[row[newLegendColumnIndex]] + 1
        const pivotValue = Number(row[numberColumnIndex])
        pivotTableData[pivotCategoryIndex][pivotColumnIndex] = pivotValue

        pivotTableColumns[pivotColumnIndex].origValues[pivotCategoryValue] = {
          name: columns[newStringColumnIndex]?.name,
          value: pivotCategoryValue,
        }
      })

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = _get(this.pivotTableData, 'length', 0)
      this.setPivotTableConfig(isFirstGeneration)
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  onSuggestionClick = ({ query, queryId, userSelection, isButtonClick, skipQueryValidation, source }) => {
    // Only call suggestion endpoint if clicked from suggestion list, not query validation
    if (!userSelection) {
      sendSuggestion({
        ...getAuthentication(this.props.authentication),
        queryId,
        suggestion: query,
      })
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
        })
      }
      if (this.props.queryInputRef?._isMounted) {
        this.props.queryInputRef?.animateInputTextAndSubmit({
          queryText: query,
          userSelection,
          skipQueryValidation: true,
          source,
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
        <div>
          <Icon className='warning-icon' type='warning-triangle' />
          <br /> All columns in this table are currently hidden. You can adjust your column visibility preferences using
          the Column Visibility Manager (<Icon className='eye-icon' type='eye' />) in the Options Toolbar.
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
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          rowChangeCount={this.state.visibleRowChangeCount}
          ref={(ref) => (this.tableRef = ref)}
          columns={this.state.columns}
          response={this.queryResponse}
          data={this.tableData}
          columnDateRanges={this.columnDateRanges}
          onCellClick={this.onTableCellClick}
          queryID={this.queryID}
          initialParams={this.tableParams}
          onFilterCallback={this.onTableFilter}
          onSorterCallback={this.onTableSort}
          onTableParamsChange={this.onTableParamsChange}
          onNewPage={this.onNewPage}
          onNewData={this.onNewData}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing}
          pageSize={this.getQueryPageSize()}
          useInfiniteScroll={this.props.enableAjaxTableData && this.isDataLimited()}
          enableAjaxTableData={this.props.enableAjaxTableData}
          queryRequestData={this.queryResponse?.data?.data?.fe_req}
          queryText={this.queryResponse?.data?.data?.text}
          originalQueryID={this.props.originalQueryID}
          isDrilldown={this.isDrilldown()}
          isQueryOutputMounted={this._isMounted}
          popoverParentElement={this.props.popoverParentElement}
          hidden={this.state.displayType !== 'table'}
          totalRows={this.queryResponse?.data?.data?.count_rows}
          supportsDrilldowns={
            isAggregation(this.state.columns) && getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns
          }
          queryFn={this.queryFn}
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
          ref={(ref) => (this.pivotTableRef = ref)}
          columns={this.pivotTableColumns}
          rowChangeCount={this.state.visibleRowChangeCount}
          data={this.pivotTableData}
          onCellClick={this.onTableCellClick}
          isAnimating={this.props.isAnimating}
          isResizing={this.props.isResizing}
          hidden={this.state.displayType !== 'pivot_table'}
          useInfiniteScroll={false}
          supportsDrilldowns={true}
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
    const combinedFilters = this.getCombinedFilters()
    const formattedTableParams = {
      ...this.formattedTableParams,
      filters: combinedFilters,
    }

    let isChartDataAggregated = false
    const numberOfGroupbys = getNumberOfGroupables(this.state.columns)
    if (numberOfGroupbys === 1 || (numberOfGroupbys >= 2 && usePivotData)) {
      isChartDataAggregated = true
    }

    return (
      <ErrorBoundary>
        <ChataChart
          hidden={!isChartType(this.state.displayType)}
          formattedTableParams={formattedTableParams}
          authentication={this.props.authentication}
          queryRequestData={this.queryResponse?.data?.data?.fe_req}
          pageSize={_get(this.queryResponse, 'data.data.row_limit')}
          dataLength={this.tableData.length}
          ref={(ref) => (this.chartRef = ref)}
          type={this.state.displayType}
          isDataAggregated={isChartDataAggregated}
          popoverParentElement={this.props.popoverParentElement}
          {...tableConfig}
          data={
            usePivotData ? this.state.visiblePivotRows || this.pivotTableData : this.state.visibleRows || this.tableData
          }
          columns={usePivotData ? this.pivotTableColumns : this.state.columns}
          isPivot={usePivotData}
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
          enableAjaxTableData={this.props.enableAjaxTableData}
          tooltipID={this.props.tooltipID ?? `react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
          chartTooltipID={this.props.chartTooltipID ?? `react-autoql-chart-tooltip-${this.COMPONENT_KEY}`}
          rebuildTooltips={this.rebuildTooltips}
          height={this.props.height}
          width={this.props.width}
          onNewData={this.onNewData}
          isDrilldown={this.isDrilldown()}
          totalRowCount={this.queryResponse?.data?.data?.count_rows}
          updateColumns={this.updateColumns}
          columnChangeCount={this.state.columnChangeCount}
        />
      </ErrorBoundary>
    )
  }

  renderHelpResponse = () => {
    const url = _get(this.queryResponse, 'data.data.rows[0]')
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
      <Fragment>
        Great news, I can help with that:
        <br />
        {
          <button className='react-autoql-help-link-btn' target='_blank' onClick={() => window.open(url, '_blank')}>
            <Icon type='globe' className='react-autoql-help-link-icon' />
            {linkText}
          </button>
        }
      </Fragment>
    )
  }

  renderError = (queryResponse) => {
    // No response prop was provided to <QueryOutput />
    if (!queryResponse) {
      console.warn('Warning: No response object supplied')
      return this.renderMessage('No response supplied')
    }

    if (_get(queryResponse, 'data.message')) {
      // Response is not a suggestion list, but no query data object was provided
      // There is no valid query data. This is an error. Return message from UMS
      return this.renderMessage(queryResponse.data)
    }

    // There is no error message in the response, display default error message
    return this.renderMessage()
  }

  isDataLimited = () => {
    const numRows = this.tableData?.length ?? this.queryResponse?.data?.data?.rows?.length
    const totalRows = this.queryResponse?.data?.data?.count_rows

    if (!numRows || !totalRows) {
      return false
    }

    return numRows < totalRows
  }

  noDataFound = () => {
    return this.queryResponse?.data?.data?.rows?.length === 0 && this.isOriginalData
  }

  renderMessage = (error) => {
    try {
      if (typeof error === 'object') {
        let errorMessage = errorMessages.GENERAL_QUERY

        if (error?.message === responseErrors?.CANCELLED) {
          errorMessage = (
            <span>
              Query cancelled{' '}
              <Icon
                data-tip='Pressing the ESC key will cancel the current query request. If you wish to re-run your last query, simply press the UP arrow in the input bar then hit ENTER.'
                data-for={this.props.tooltipID ?? `react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
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
              <Fragment>
                <br />
                <div>Error ID: {error.reference_id}</div>
              </Fragment>
            )}
          </div>
        )
      }

      const errorMessage = error || errorMessages.GENERAL_QUERY
      return <div className='query-output-error-message'>{errorMessage}</div>
    } catch (error) {
      console.warn(error)
      return <div className='query-output-error-message'>{errorMessages.GENERAL_QUERY}</div>
    }
  }

  renderHTMLMessage = () => {
    const answer = this.queryResponse?.data?.data?.answer
    if (answer) {
      return parse(answer, {
        // Use this if we need to add "target blank" to <a>
        // replace: (domNode) => {
        //   if (domNode.name === 'a') {
        //     const props = domNode.attribs || {}
        //     return (
        //       <a {...props} target="_blank">
        //         {domNode.children}
        //       </a>
        //     )
        //   }
        // },
      })
    } else {
      return <span>I'm not sure I understood your question. Please try asking again in a different way.</span>
    }
  }

  renderTextResponse = () => {
    if (areAllColumnsHidden(this.getColumns())) {
      return this.renderAllColumnsHiddenMessage()
    }

    return null
  }

  renderResponse = () => {
    const { displayType } = this.state

    if (this.hasError(this.queryResponse)) {
      return this.renderError(this.queryResponse)
    }

    if (displayType === 'html') {
      return this.renderHTMLMessage()
    }

    if (this.state.customResponse) {
      return this.state.customResponse
    }

    // If "items" are returned in response it is a list of suggestions
    const isSuggestionList = !!_get(this.queryResponse, 'data.data.items')
    if (isSuggestionList) {
      return this.renderSuggestionMessage(this.queryResponse.data.data.items, this.queryResponse.data.data.query_id)
    }

    // Query validation was triggered, display query validation message
    if (_get(this.queryResponse, 'data.data.replacements')) {
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
            })
          }
          onQueryValidationSelectOption={this.props.onQueryValidationSelectOption}
          initialSelections={this.props.queryValidationSelections}
          autoSelectSuggestion={this.props.autoSelectQueryValidationSuggestion}
        />
      )
    }

    // This is not technically an error. There is just no data in the DB
    // Keep this in case we want to revert back to this error message
    // if (this.noDataFound()) {
    //   return this.replaceErrorTextWithLinks(this.queryResponse.data.message)
    // }

    if (displayType && !!_get(this.queryResponse, 'data.data.rows')) {
      if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (displayType === 'text') {
        return this.renderTextResponse()
      } else if (displayType === 'single-value') {
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

    const chartDisplayTypes = this.getPotentialDisplayTypes().filter((displayType) => CHART_TYPES.includes(displayType))
    const supportsChart = !!chartDisplayTypes?.length
    const supportsPivotTable = this.getCurrentSupportedDisplayTypes().includes('pivot_table')

    const shouldRenderChart = (allowsDisplayTypeChange || displayTypeIsChart) && supportsChart
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

  renderReverseTranslation = () => {
    return (
      <ReverseTranslation
        authentication={this.props.authentication}
        onValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={this.props.appliedFilters}
        isResizing={this.props.isResizing}
        reverseTranslation={_get(this.queryResponse, 'data.data.parsed_interpretation')}
      />
    )
  }

  shouldRenderDataLimitWarning = () => {
    const isTableAndNotAjax = !this.props.enableAjaxTableData && this.state.displayType === 'table'
    const isChartAndNotAjax = !this.props.enableAjaxTableData && isChartType(this.state.displayType)
    return this.isDataLimited() && !areAllColumnsHidden(this.getColumns()) && (isTableAndNotAjax || isChartAndNotAjax)
  }

  renderDataLimitWarning = () => {
    const isReverseTranslationRendered =
      getAutoQLConfig(this.props.autoQLConfig).enableQueryInterpretation && this.props.showQueryInterpretation

    return (
      <div className='dashboard-data-limit-warning-icon'>
        <Icon
          type='warning'
          data-tip={`The display limit of ${this.queryResponse?.data?.data?.row_limit} rows has been reached. Try querying a smaller time-frame to ensure all your data is displayed.`}
          data-for={this.props.tooltipID ?? `react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
          data-place={isReverseTranslationRendered ? 'left' : 'right'}
        />
      </div>
    )
  }

  renderFooter = () => {
    const shouldRenderRT = this.shouldRenderReverseTranslation()
    const shouldRenderDLW = this.shouldRenderDataLimitWarning()
    const footerClassName = `query-output-footer ${!shouldRenderRT ? 'no-margin' : ''} ${
      this.props.reverseTranslationPlacement
    }`

    return (
      <div className={footerClassName}>
        {shouldRenderRT && this.renderReverseTranslation()}
        {shouldRenderDLW && this.renderDataLimitWarning()}
      </div>
    )
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
          ${isChartType(this.state.displayType) ? 'chart' : ''}`}
        >
          {this.props.reverseTranslationPlacement === 'top' && this.renderFooter()}
          {this.renderResponse()}
          {this.props.reverseTranslationPlacement !== 'top' && this.renderFooter()}
        </div>
        {!this.props.tooltipID && (
          <ReactTooltip
            className='react-autoql-tooltip'
            id={`react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
            effect='solid'
            place='top'
            html
          />
        )}
        {!this.props.chartTooltipID && (
          <ReactTooltip
            className='react-autoql-chart-tooltip'
            id={`react-autoql-chart-tooltip-${this.COMPONENT_KEY}`}
            effect='solid'
            html
          />
        )}
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryOutput)
