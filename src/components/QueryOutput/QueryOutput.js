import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import ReactTooltip from 'react-tooltip'
import disableScroll from 'disable-scroll'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import dayjs from '../../js/dayjsWithPlugins'
import parse from 'html-react-parser'

import { scaleOrdinal } from 'd3-scale'

import {
  dataFormattingType,
  themeConfigType,
  autoQLConfigType,
  authenticationType,
} from '../../props/types'
import {
  dataFormattingDefault,
  themeConfigDefault,
  autoQLConfigDefault,
  authenticationDefault,
  getAuthentication,
  getDataFormatting,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import { ChataTable } from '../ChataTable'
import { ChataChart } from '../Charts/ChataChart'
import { QueryInput } from '../QueryInput'
import { QueryValidationMessage } from '../QueryValidationMessage'
import { Icon } from '../Icon'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import errorMessages from '../../js/errorMessages'

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
  setCSSVars,
  getNumberOfGroupables,
  areAllColumnsHidden,
  sortDataByDate,
  dateSortFn,
} from '../../js/Util.js'

import {
  isColumnNumberType,
  isColumnStringType,
  getNumberColumnIndices,
  getMultiSeriesColumnIndex,
  getDateColumnIndex,
  getStringColumnIndices,
  isColumnDateType,
  isAggregation,
} from './columnHelpers.js'

import { sendSuggestion, runDrilldown } from '../../js/queryService'

import './QueryOutput.scss'
import { MONTH_NAMES } from '../../js/Constants'
import { ReverseTranslation } from '../ReverseTranslation'

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

export default class QueryOutput extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.QUERY_VALIDATION_KEY = uuid()

    this.queryResponse = _cloneDeep(props.queryResponse)
    this.supportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    this.queryID = _get(this.queryResponse, 'data.data.query_id')
    this.interpretation = _get(this.queryResponse, 'data.data.interpretation')
    this.tableID = uuid()
    this.pivotTableID = uuid()

    // Set initial config if needed
    // If this config causes errors, it will be reset when the error occurs
    if (
      props.tableConfigs?.tableConfig &&
      this.isTableConfigValid(props.tableConfigs?.tableConfig)
    ) {
      const { tableConfig, pivotTableConfig } = props.tableConfigs
      this.tableConfig = _cloneDeep(tableConfig)
      this.pivotTableConfig = _cloneDeep(pivotTableConfig)
    }

    const isProvidedDisplayTypeValid = this.isCurrentDisplayTypeValid(props)

    // Set the initial display type based on prop value, response, and supported display types
    let displayType = props.displayType
    if (!isProvidedDisplayTypeValid) {
      displayType = getDefaultDisplayType(
        this.queryResponse,
        props.autoChartAggregations,
        this.props.preferredDisplayType
      )
      this.onRecommendedDisplayType(displayType)
    }

    // Set theme colors
    const { chartColors } = getThemeConfig(props.themeConfig)
    this.colorScale = scaleOrdinal().range(chartColors)
    setCSSVars(props.themeConfig)

    // --------- generate data before mount --------
    this.generateAllData(this.queryResponse, displayType)
    // -------------------------------------------

    this.state = {
      displayType,
      tableFilters: [],
      selectedSuggestion: props.selectedSuggestion,
    }
  }

  static propTypes = {
    queryResponse: PropTypes.shape({}),
    queryInputRef: PropTypes.instanceOf(QueryInput),
    authentication: authenticationType,
    themeConfig: themeConfigType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    tableConfig: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    displayType: PropTypes.string,
    onQueryValidationSelectOption: PropTypes.func,
    autoSelectQueryValidationSuggestion: PropTypes.bool,
    queryValidationSelections: PropTypes.arrayOf(PropTypes.shape({})),
    renderSuggestionsAsDropdown: PropTypes.bool,
    selectedSuggestion: PropTypes.string,
    activeChartElementKey: PropTypes.string,
    preferredDisplayType: PropTypes.string,
    isResizing: PropTypes.bool,
    enableDynamicCharting: PropTypes.bool,
    onTableConfigChange: PropTypes.func,
    onNoneOfTheseClick: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    onSupportedDisplayTypesChange: PropTypes.func,
    onRTValueLabelClick: PropTypes.func,
    isTaskModule: PropTypes.bool,
    onUpdate: PropTypes.func,
    onDrilldownStart: PropTypes.func,
    onDrilldownEnd: PropTypes.func,
    enableAjaxTableData: PropTypes.bool,
    enableTableSorting: PropTypes.bool,
    rebuildTooltips: PropTypes.func,
    onRowChange: PropTypes.func,
    mutable: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    tableConfig: undefined,

    queryResponse: undefined,
    displayType: undefined,
    queryInputRef: undefined,
    onSuggestionClick: undefined,
    autoSelectQueryValidationSuggestion: true,
    queryValidationSelections: undefined,
    renderSuggestionsAsDropdown: false,
    selectedSuggestion: undefined,
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
    onRowChange: () => {},
    onTableConfigChange: () => {},
    onQueryValidationSelectOption: () => {},
    onSupportedDisplayTypesChange: () => {},
    onErrorCallback: () => {},
    onRecommendedDisplayType: () => {},
    onUpdate: () => {},
    onDrilldownStart: () => {},
    onDrilldownEnd: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.props.onUpdate()
    try {
      if (this.props.optionsToolbarRef?._isMounted) {
        this.props.optionsToolbarRef.forceUpdate()
      }

      if (!this.isCurrentDisplayTypeValid(this.props)) {
        this.onRecommendedDisplayType(
          getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations,
            this.props.preferredDisplayType
          )
        )
      }

      this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  shouldComponentUpdate = (nextProps) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      // If data config was changed here, tell the parent
      if (
        !_isEqual(this.props.tableConfigs, {
          tableConfig: this.tableConfig,
          pivotTableConfig: this.pivotTableConfig,
        }) &&
        this.props.onTableConfigChange
      ) {
        this.props.onTableConfigChange({
          tableConfig: this.tableConfig,
          pivotTableConfig: this.pivotTableConfig,
        })
      }

      if (
        prevProps.themeConfig &&
        this.props.themeConfig &&
        !_isEqual(
          getThemeConfig(this.props.themeConfig),
          getThemeConfig(prevProps.themeConfig)
        )
      ) {
        setCSSVars(this.props.themeConfig)
      }

      if (this.props.queryResponse && !this.queryResponse) {
        this.queryResponse = _cloneDeep(this.props.queryResponse)
        if (!this.isCurrentDisplayTypeValid(this.props)) {
          const recommendedDisplayType = getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations,
            this.props.preferredDisplayType
          )
          this.onRecommendedDisplayType(recommendedDisplayType)
        } else {
          this.setResponseData()
          this.forceUpdate()
        }
      }

      // Initial display type has been determined, set the table and chart data now
      if (!prevProps.displayType && this.props.displayType) {
        ReactTooltip.hide()

        if (!this.isCurrentDisplayTypeValid(this.props)) {
          const recommendedDisplayType = getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations,
            this.props.preferredDisplayType
          )
          this.onRecommendedDisplayType(recommendedDisplayType)
        } else if (!this.tableData) {
          this.setResponseData()
          this.forceUpdate()
        }
      }

      // Detected a display type change from props. We must make sure
      // the display type is valid before updating the state
      if (
        this.props.displayType !== prevProps.displayType &&
        !this.isCurrentDisplayTypeValid(this.props)
      ) {
        const recommendedDisplayType = getDefaultDisplayType(
          this.queryResponse,
          this.props.autoChartAggregations,
          this.props.preferredDisplayType
        )
        this.onRecommendedDisplayType(recommendedDisplayType)
      }

      // Do not allow scrolling while the context menu is open
      if (!prevState.isContextMenuOpen && this.state.isContextMenuOpen) {
        disableScroll.on()
      } else if (prevState.isContextMenuOpen && !this.state.isContextMenuOpen) {
        disableScroll.off()
      }

      if (this.state.visibleRows?.length !== prevState.visibleRows?.length) {
        this.props.onRowChange()
      }

      if (!_isEqual(this.state.visibleRows, prevState.visibleRows)) {
        if (this.shouldGeneratePivotData(this.state.visibleRows)) {
          this.generatePivotData({
            isFirstGeneration: true,
            newTableData: this.state.visibleRows,
          })
        }

        this.setSupportedDisplayTypes(this.getCurrentSupportedDisplayTypes())
      } else if (
        this.usePivotDataForChart() &&
        this.state.visiblePivotRows !== prevState.visiblePivotRows
      ) {
        this.setSupportedDisplayTypes(this.getCurrentSupportedDisplayTypes())
      }

      if (this.props.optionsToolbarRef?._isMounted) {
        this.props.optionsToolbarRef.forceUpdate()
      }

      this.props.onUpdate()
    } catch (error) {
      console.error(error)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    ReactTooltip.hide()
    clearTimeout(this.rebuildTooltipsTimer)
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

  supportsPivot = () => {
    return this.supportedDisplayTypes.includes('pivot_table')
  }

  supportsDatePivot = () => {
    return this.supportsPivot() && this.tableColumns.length === 2
  }

  usePivotDataForChart = () => {
    return this.supportsPivot() && !this.supportsDatePivot()
  }

  onRecommendedDisplayType = (recommendedDisplayType) => {
    this.props.onRecommendedDisplayType(
      recommendedDisplayType,
      this.supportedDisplayTypes
    )
  }

  isTableConfigValid = (tableConfig) => {
    try {
      if (
        !tableConfig ||
        !tableConfig.numberColumnIndices ||
        !tableConfig.stringColumnIndices ||
        Number.isNaN(Number(tableConfig.numberColumnIndex)) ||
        Number.isNaN(Number(tableConfig.stringColumnIndex))
      ) {
        return false
      }

      if (
        !Array.isArray(tableConfig.numberColumnIndices) ||
        !Array.isArray(tableConfig.stringColumnIndices)
      ) {
        return false
      }

      const columns = _get(this.queryResponse, 'data.data.columns')

      const areNumberColumnsValid = tableConfig.numberColumnIndices.every(
        (index) => {
          return columns[index] && isColumnNumberType(columns[index])
        }
      )
      if (!areNumberColumnsValid) {
        return false
      }

      const areStringColumnsValid = tableConfig.stringColumnIndices.every(
        (index) => {
          return columns[index] && isColumnStringType(columns[index])
        }
      )
      if (!areStringColumnsValid) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  updateColumns = (columns) => {
    // Update columns in query response
    if (_get(this.queryResponse, 'data.data.columns')) {
      this.queryResponse.data.data.columns = columns
    }

    this.tableID = uuid()

    // Get new supported display types after column change
    const newSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    this.setSupportedDisplayTypes(newSupportedDisplayTypes, undefined, 'table')

    // Reset persisted column config data
    this.tableConfig = undefined
    // Generate new table data from new columns
    if (this.shouldGenerateTableData()) {
      this.generateTableData(columns)
      if (this.shouldGeneratePivotData()) {
        this.generatePivotTableData({ isFirstGeneration: true })
      }
    }

    // If tabulator is mounted, update columns in there
    if (_get(this.tableRef, 'ref.table')) {
      this.tableRef.ref.table.setColumns(this.tableColumns)
    }

    // Call update on options toolbar to show appropriate tools
    if (this.props.optionsToolbarRef?._isMounted) {
      this.props.optionsToolbarRef.forceUpdate()
    }

    if (this.props.displayType === 'text') {
      this.onRecommendedDisplayType('table')
    } else {
      this.forceUpdate()
    }
  }

  generateAllData = (queryResponse, displayType) => {
    if (_get(queryResponse, 'data.data') && displayType) {
      if (this.shouldGenerateTableData()) {
        this.generateTableData()

        if (this.shouldGeneratePivotData()) {
          this.generatePivotData({ isFirstGeneration: true })
        }
      }
    }
  }

  setResponseData = () => {
    this.queryID = _get(this.queryResponse, 'data.data.query_id')
    this.interpretation = _get(this.queryResponse, 'data.data.interpretation')
    this.generateAllData(this.queryResponse, this.props.displayType)
  }

  shouldGeneratePivotData = (newTableData) => {
    return (newTableData || this.tableData) && this.supportsPivot()
  }

  shouldGenerateTableData = () => {
    return _get(this.queryResponse, 'data.data.rows.length')
  }

  generateTableData = (columns, newTableData) => {
    if (newTableData) {
      this.tableData = newTableData
    } else {
      this.tableID = uuid()
      this.tableColumns = this.formatColumnsForTable(columns)
      this.tableData = sortDataByDate(
        this.queryResponse?.data?.data?.rows,
        this.tableColumns
      )

      this.setTableConfig()
    }
  }

  generatePivotData = ({ isFirstGeneration, newTableData } = {}) => {
    try {
      this.pivotTableID = uuid()
      const tableData = newTableData || this.tableData
      if (this.tableColumns.length === 2) {
        this.generateDatePivotData(tableData)
      } else {
        this.generatePivotTableData({ isFirstGeneration, newTableData })
      }
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
      this.pivotTableData = undefined
    }
  }

  renderSuggestionMessage = (suggestions, queryId) => {
    let suggestionListMessage

    try {
      suggestionListMessage = (
        <div
          className="react-autoql-suggestion-message"
          data-test="suggestion-message-container"
        >
          <div className="react-autoql-suggestions-container">
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
                className="react-autoql-suggestions-select"
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
                  <div key={uuid()} data-test="suggestion-list-button">
                    <button
                      onClick={() =>
                        this.onSuggestionClick({
                          query: suggestion,
                          isButtonClick: true,
                          source: ['suggestion'],
                          queryId,
                        })
                      }
                      className="react-autoql-suggestion-btn"
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
        <div className="react-autoql-suggestion-message">
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
      <div className="single-value-response-container">
        <a
          className={`single-value-response ${
            getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns
              ? ' with-drilldown'
              : ''
          }`}
          onClick={() =>
            this.processDrilldown({ groupBys: [], supportedByAPI: true })
          }
        >
          {formatElement({
            element: _get(this.queryResponse, 'data.data.rows[0][0]'),
            column: _get(this.queryResponse, 'data.data.columns[0]'),
            config: getDataFormatting(this.props.dataFormatting),
          })}
        </a>
      </div>
    )
  }

  copyTableToClipboard = () => {
    if (this.props.displayType === 'table' && this.tableRef?._isMounted) {
      this.tableRef.copyToClipboard()
    } else if (
      this.props.displayType === 'pivot_table' &&
      this.pivotTableRef?._isMounted
    ) {
      this.pivotTableRef.copyToClipboard()
    }
  }

  getBase64Data = () => {
    if (this.chartRef && isChartType(this.props.displayType)) {
      return this.chartRef.getBase64Data().then((data) => {
        const trimmedData = data.split(',')[1]
        return Promise.resolve(trimmedData)
      })
    } else if (
      this.tableRef?._isMounted &&
      this.props.displayType === 'table'
    ) {
      const data = this.tableRef.getBase64Data()
      return Promise.resolve(data)
    } else if (
      this.pivotTableRef?._isMounted &&
      this.props.displayType === 'pivot_table'
    ) {
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

  getFilterDrilldown = ({ stringColumnIndex, row }) => {
    try {
      const filteredRows = this.tableData?.filter((origRow) => {
        return `${origRow[stringColumnIndex]}` === `${row[stringColumnIndex]}`
      })

      const drilldownResponse = _cloneDeep(this.queryResponse)
      drilldownResponse.data.data.rows = filteredRows
      return drilldownResponse
    } catch (error) {
      console.error(error)
    }
  }

  processDrilldown = async ({
    groupBys,
    supportedByAPI,
    row,
    activeKey,
    stringColumnIndex,
  }) => {
    if (getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns) {
      try {
        if (supportedByAPI) {
          this.props.onDrilldownStart(activeKey)
          try {
            const response = await runDrilldown({
              ...getAuthentication(this.props.authentication),
              ...getAutoQLConfig(this.props.autoQLConfig),
              queryID: this.queryID,
              groupBys,
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
          const response = this.getFilterDrilldown({ stringColumnIndex, row })
          setTimeout(() => {
            this.props.onDrilldownEnd({ response })
          }, 1500)
        }
      } catch (error) {
        console.error(error)
        this.props.onDrilldownEnd({ error: 'Error processing drilldown' })
      }
    }
  }

  onTableCellClick = (cell) => {
    if (cell?.getColumn()?.getDefinition()?.pivot) {
      return
    }

    let groupBys = {}
    if (this.pivotTableColumns && this.props.displayType === 'pivot_table') {
      groupBys = getGroupBysFromPivotTable(cell)
    } else {
      groupBys = getGroupBysFromTable(cell, this.tableColumns)
    }

    this.processDrilldown({ groupBys, supportedByAPI: !!groupBys })
  }

  onChartClick = ({
    row,
    columnIndex,
    columns,
    stringColumnIndex,
    legendColumn,
    activeKey,
  }) => {
    // todo: do we need to provide all those params or can we grab them from this component?
    const drilldownData = {}
    const groupBys = []

    const column = columns[columnIndex]

    const stringColumn =
      columns?.[stringColumnIndex]?.origColumn || columns?.[stringColumnIndex]

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

  toggleTableFilter = ({ isFilteringTable }) => {
    if (this.props.displayType === 'table') {
      this.tableRef?._isMounted &&
        this.tableRef.toggleTableFilter({ isFilteringTable })
    }

    if (this.props.displayType === 'pivot_table') {
      this.pivotTableRef?._isMounted &&
        this.pivotTableRef.toggleTableFilter({ isFilteringTable })
    }
  }

  onNewPage = (rows) => {
    try {
      this.tableData = [...this.tableData, ...rows]
    } catch (error) {
      console.error(error)
    }
  }

  onNewData = (rows) => {
    this.tableData = rows
  }

  onTableFilter = async (filters, rows) => {
    if (!filters?.length && !rows?.length) {
      return
    }

    const { displayType } = this.props
    if (displayType === 'table' || displayType === 'pivot_table') {
      const newTableData = []
      rows.forEach((row) => {
        newTableData.push(row.getData())
      })

      if (displayType === 'table') {
        this.headerFilters = filters
        this.setState({ visibleRows: newTableData })
      } else if (displayType === 'pivot_table') {
        this.pivotHeaderFilters = filters
        this.setState({ visiblePivotRows: newTableData })
      }
    }
  }

  onLegendClick = (d) => {
    const columnIndex = d?.columnIndex
    if (this.props.displayType === 'pie') {
      this.onPieChartLegendClick(d)
    } else {
      const newColumns = this.supportsPivot()
        ? [...this.pivotTableColumns]
        : [...this.tableColumns]
      newColumns[columnIndex].isSeriesHidden =
        !newColumns[columnIndex].isSeriesHidden

      if (this.supportsPivot()) {
        this.pivotTableColumns = newColumns
      } else {
        this.tableColumns = newColumns
      }
    }

    this.forceUpdate()
  }

  onPieChartLegendClick = (d) => {
    // const newChartData = this.chartData.map((data) => {
    //   if (data.label === d.label) {
    //     return {
    //       ...data,
    //       hidden: !_get(data, 'hidden', false),
    //     }
    //   }
    //   return data
    // })
    // this.chartData = newChartData
  }

  onChangeStringColumnIndex = (index) => {
    if (this.supportsPivot() && !this.supportsDatePivot()) {
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
    if (this.supportsPivot() && !this.supportsDatePivot()) {
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

  onChangeNumberColumnIndices = (indices) => {
    if (!indices) {
      return
    }

    if (this.supportsPivot() && !this.supportsDatePivot()) {
      this.pivotTableConfig.numberColumnIndices = indices
      this.pivotTableConfig.numberColumnIndex = indices[0]
    } else {
      this.tableConfig.numberColumnIndices = indices
      this.tableConfig.numberColumnIndex = indices[0]
    }

    this.forceUpdate()
  }

  setPivotTableConfig = (isFirstGeneration) => {
    const columns = this.pivotTableColumns

    if (!columns) {
      return
    }

    if (!this.pivotTableConfig) {
      this.pivotTableConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (
      isFirstGeneration ||
      !this.pivotTableConfig.stringColumnIndices ||
      !(this.pivotTableConfig.stringColumnIndex >= 0)
    ) {
      const { stringColumnIndices, stringColumnIndex } =
        getStringColumnIndices(columns)
      this.pivotTableConfig.stringColumnIndices = stringColumnIndices
      this.pivotTableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (isFirstGeneration || !this.pivotTableConfig.numberColumnIndices) {
      const { numberColumnIndex, numberColumnIndices } =
        getNumberColumnIndices(columns)

      this.pivotTableConfig.numberColumnIndices = numberColumnIndices
      this.pivotTableConfig.numberColumnIndex = numberColumnIndex
    }
  }

  setTableConfig = () => {
    const columns = this.tableColumns

    if (!columns) {
      return
    }

    if (!this.tableConfig) {
      this.tableConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (
      !this.tableConfig.stringColumnIndices ||
      !(this.tableConfig.stringColumnIndex >= 0)
    ) {
      const { stringColumnIndices, stringColumnIndex } =
        getStringColumnIndices(columns)
      this.tableConfig.stringColumnIndices = stringColumnIndices
      this.tableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (
      !this.tableConfig.numberColumnIndices ||
      !(this.tableConfig.numberColumnIndex >= 0)
    ) {
      const { numberColumnIndex, numberColumnIndices } =
        getNumberColumnIndices(columns)
      this.tableConfig.numberColumnIndices = numberColumnIndices
      this.tableConfig.numberColumnIndex = numberColumnIndex
    }

    // Set legend index if there should be one
    let legendColumnIndex = this.tableColumns.findIndex(
      (col, i) => col.groupable && i !== this.tableConfig.stringColumnIndex
    )
    if (legendColumnIndex >= 0)
      this.tableConfig.legendColumnIndex = legendColumnIndex

    this.props.onTableConfigChange({
      tableConfig: this.tableConfig,
      pivotTableConfig: this.pivotTableConfig,
    })
  }

  isCurrentDisplayTypeValid = (props, displayType) => {
    const dataLength = this.state?.visibleRows
      ? this.state?.visibleRows?.length
      : this.tableData?.length

    const pivotDataLength = this.state?.visiblePivotRows
      ? this.state?.visiblePivotRows?.length
      : this.pivotTableData?.length

    return isDisplayTypeValid(
      this.queryResponse,
      props.displayType,
      dataLength,
      pivotDataLength
    )
  }

  getCurrentSupportedDisplayTypes = () => {
    const dataLength = this.state?.visibleRows
      ? this.state?.visibleRows?.length
      : this.tableData?.length

    const pivotDataLength = this.state?.visiblePivotRows
      ? this.state?.visiblePivotRows?.length
      : this.pivotTableData?.length

    return getSupportedDisplayTypes({
      response: this.queryResponse,
      dataLength,
      pivotDataLength,
    })
  }

  setSupportedDisplayTypes = (
    supportedDisplayTypes,
    justMounted,
    preferredDisplayType
  ) => {
    if (
      supportedDisplayTypes &&
      (justMounted ||
        !_isEqual(supportedDisplayTypes, this.supportedDisplayTypes))
    ) {
      this.supportedDisplayTypes = supportedDisplayTypes
      if (
        preferredDisplayType &&
        preferredDisplayType !== this.props.displayType &&
        this.supportedDisplayTypes.includes(preferredDisplayType)
      ) {
        this.onRecommendedDisplayType(preferredDisplayType)
      } else if (!this.supportedDisplayTypes.includes(this.props.displayType)) {
        this.onRecommendedDisplayType(
          getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations,
            this.props.preferredDisplayType
          )
        )
      }

      this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)
    }
  }

  getTooltipDataForCell = (row, columnIndex, numberValue) => {
    let tooltipElement = null
    try {
      if (this.supportsPivot()) {
        const stringColumn =
          this.tableColumns[this.tableConfig.stringColumnIndex]
        const numberColumn =
          this.tableColumns[this.tableConfig.numberColumnIndex]
        const legendColumn =
          this.tableColumns[this.tableConfig.legendColumnIndex]

        const tooltipLine1 = `<div>
          <strong>${this.pivotTableColumns[0].title}:</strong>${formatElement({
          element: row[0],
          column: this.pivotTableColumns[0],
          config: getDataFormatting(this.props.dataFormatting),
        })}
        </div>`

        let tooltipLine2 = `<span></span>`
        if (legendColumn) {
          tooltipLine2 = `<div><strong>${legendColumn.title}:</strong> ${this.pivotTableColumns[columnIndex].title}</div>`
        } else if (stringColumn) {
          tooltipLine2 = `<div><strong>${stringColumn.title}:</strong> ${this.pivotTableColumns[columnIndex].title}</div>`
        }

        const tooltipLine3 = `<div>
          <strong>${numberColumn.title}:</strong> ${formatElement({
          element: row[columnIndex] || 0,
          column: numberColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })}
        </div>`

        tooltipElement = `<div>
          ${tooltipLine1}
          ${tooltipLine2}
          ${tooltipLine3}
        </div>`
      } else {
        const stringColumn =
          this.tableColumns[this.tableConfig.stringColumnIndex]
        const numberColumn = this.tableColumns[columnIndex]

        tooltipElement = `<div>
            <div>
              <strong>${stringColumn.title}:</strong> ${formatElement({
          element: row[this.tableConfig.stringColumnIndex],
          column: stringColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })}
            </div>
            <div>
            <div>
              <strong>${numberColumn.title}:</strong> ${formatElement({
          element: numberValue || row[columnIndex] || 0,
          column: numberColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })}
            </div>
          </div>`
      }
      return tooltipElement
    } catch (error) {
      console.error(error)
      return null
    }
  }

  getDrilldownDataForCell = (row, columnIndex) => {
    const supportedByAPI = getNumberOfGroupables(this.tableColumns) > 0

    if (this.supportsPivot()) {
      return {
        supportedByAPI,
        data: [
          {
            name: _get(this.pivotTableColumns, '[0].name'),
            value: `${row[0]}`,
          },
          {
            name: _get(
              this.tableColumns,
              `[${this.tableConfig.legendColumnIndex}].name`
            ),
            value: `${_get(this.pivotTableColumns, `[${columnIndex}].name`)}`,
          },
        ],
      }
    } else {
      return {
        supportedByAPI,
        data: [
          {
            name: _get(
              this.tableColumns,
              `[${this.tableConfig.stringColumnIndex}].name`
            ),
            value: `${_get(row, `[${this.tableConfig.stringColumnIndex}]`)}`,
          },
        ],
      }
    }
  }

  isStringColumnDateType = () => {
    const stringColumn = this.tableColumns[this.tableConfig.stringColumnIndex]
    return isColumnDateType(stringColumn)
  }

  getMultiSeriesData = (columns, tableData) => {
    const { stringColumnIndex } = getStringColumnIndices(columns)
    const multiSeriesIndex = getMultiSeriesColumnIndex(columns)
    const { numberColumnIndex } = getNumberColumnIndices(columns)

    // Sort data so like values are grouped together
    const sortedData = _cloneDeep(tableData).sort((a, b) => {
      const aVal = a[stringColumnIndex]
      const bVal = b[stringColumnIndex]

      if (!aVal || !bVal) {
        return b - a
      }
      return bVal - aVal
    })

    // make column index map for adding new data in next step
    const addedColumnIndexes = {}
    this.tableColumns.forEach((col, index) => {
      if (col.seriesCategory) {
        addedColumnIndexes[col.seriesCategory] = index
      }
    })

    let prevRow
    const newTableData = []
    sortedData.forEach((row, index) => {
      const category = row[stringColumnIndex]
      const prevCategory = _get(prevRow, `[${stringColumnIndex}]`)
      const seriesValue = row[multiSeriesIndex]

      if (prevCategory !== category) {
        // make new row with original values
        const cells = makeEmptyArray(this.tableColumns.length, 1, 0)
        cells[0] = category
        newTableData.push(cells)
      }

      // add (or aggregate) the number column for this category
      const currentNumberColumnValue =
        newTableData[newTableData.length - 1][
          addedColumnIndexes[seriesValue]
        ] || 0
      newTableData[newTableData.length - 1][addedColumnIndexes[seriesValue]] =
        row[numberColumnIndex] + currentNumberColumnValue
      prevRow = row
    })

    return newTableData
  }

  setFilterFunction = (col) => {
    const self = this
    if (col.type === 'DATE' || col.type === 'DATE_STRING') {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          const formattedElement = formatElement({
            element: rowValue,
            column: col,
            config: self.props.dataFormatting,
          })

          const shouldFilter = `${formattedElement}`
            .toLowerCase()
            .includes(`${headerValue}`.toLowerCase())

          return shouldFilter
        } catch (error) {
          console.error(error)
          this.props.onErrorCallback(error)
          return false
        }
      }
    } else if (
      col.type === 'DOLLAR_AMT' ||
      col.type === 'QUANTITY' ||
      col.type === 'PERCENT' ||
      col.type === 'RATIO'
    ) {
      return (headerValue, rowValue, rowData, filterParams) => {
        try {
          const trimmedValue = headerValue.trim()
          if (trimmedValue.length >= 2) {
            const number = Number(
              trimmedValue.substr(1).replace(/[^0-9.]/g, '')
            )
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

          // No logical operators detected, just compare strings
          const strippedHeader = headerValue.replace(/[^0-9.]/g, '')
          return rowValue.toString().includes(strippedHeader)
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
      return (a, b) => dateSortFn(b, a)
    } else if (col.type === 'STRING') {
      // There is some bug in tabulator where its not sorting
      // certain columns. This explicitly sets the sorter so
      // it works every time
      return 'string'
    }

    return undefined
  }

  formatColumnsForTable = (cols) => {
    const columns = cols || this.queryResponse?.data?.data?.columns
    if (!columns) {
      return null
    }
    const formattedColumns = columns.map((col, i) => {
      /**
       * EDIT:
       * We no longer want to default to one over the other. Howeever,
       * I would like to hang onto this code for now incase we do want to
       * include either/or in some cases in the future
       */
      // Regardless of the BE response, we want to default to percent
      // if (
      //   (col.type === 'RATIO' || col.type === 'NUMBER') &&
      //   _get(
      //     getDataFormatting(this.props.dataFormatting),
      //     'comparisonDisplay'
      //   ) === 'PERCENT'
      // ) {
      //   col.type = 'PERCENT'
      // }

      const newCol = _cloneDeep(col)

      newCol.field = `${i}`
      newCol.title = col.display_name
      newCol.id = uuid()

      // Visibility flag: this can be changed through the column visibility editor modal
      newCol.visible = col.is_visible

      // Cell alignment
      if (
        newCol.type === 'DOLLAR_AMT' ||
        newCol.type === 'RATIO' ||
        newCol.type === 'NUMBER'
      ) {
        newCol.hozAlign = 'right'
      } else {
        newCol.hozAlign = 'center'
      }

      newCol.cssClass = newCol.type

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

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      newCol.headerFilterFunc = this.setFilterFunction(newCol)

      // Allow proper chronological sorting for date strings
      newCol.sorter = this.setSorterFunction(newCol)
      newCol.headerSort = !!this.props.enableTableSorting

      return newCol
    })

    return formattedColumns
  }

  formatDatePivotYear = (data, dateColumnIndex) => {
    if (this.tableColumns[dateColumnIndex].type === 'DATE') {
      return dayjs.unix(data[dateColumnIndex]).utc().format('YYYY')
    }
    return dayjs(data[dateColumnIndex]).format('YYYY')
  }

  formatDatePivotMonth = (data, dateColumnIndex) => {
    if (this.tableColumns[dateColumnIndex].type === 'DATE') {
      return dayjs.unix(data[dateColumnIndex]).format('MMMM')
    }
    return dayjs(data[dateColumnIndex]).format('MMMM')
  }

  generateDatePivotData = (newTableData) => {
    try {
      const dateColumnIndex = getDateColumnIndex(this.tableColumns)
      let numberColumnIndex = this.tableConfig.numberColumnIndex
      if (!(numberColumnIndex >= 0)) {
        numberColumnIndex = this.tableColumns.findIndex(
          (col, index) => index !== dateColumnIndex && isColumnNumberType(col)
        )
      }
      const tableData =
        newTableData || _get(this.queryResponse, 'data.data.rows')

      const allYears = tableData.map((d) => {
        if (this.tableColumns[dateColumnIndex].type === 'DATE') {
          return Number(dayjs.unix(d[dateColumnIndex]).utc().format('YYYY'))
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

      // Generate new column array
      const pivotTableColumns = [
        {
          ...this.tableColumns[dateColumnIndex],
          origColumn: this.tableColumns[dateColumnIndex],
          title: 'Month',
          name: 'Month',
          field: '0',
          frozen: true,
          visible: true,
          is_visible: true,
          type: 'DATE_STRING',
          datePivot: true,
          pivot: true,
          cssClass: 'pivot-category',
          sorter: dateSortFn,
          headerFilter: false,
        },
      ]

      Object.keys(uniqueYears).forEach((year, i) => {
        pivotTableColumns.push({
          ...this.tableColumns[numberColumnIndex],
          origColumn: this.tableColumns[numberColumnIndex],
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

        const pivotColumnIndex = pivotTableColumns.findIndex(
          (col) => col.name === year
        )

        if (monthNumber >= 0 && yearNumber) {
          pivotTableData[monthNumber][yearNumber] = row[numberColumnIndex]
          pivotOriginalColumnData[year] = {
            ...pivotOriginalColumnData[year],
            [month]: row[dateColumnIndex],
          }
          pivotTableColumns[pivotColumnIndex].origValues[month] = {
            name: this.tableColumns[dateColumnIndex]?.name,
            value: row[dateColumnIndex],
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
      this.setSupportedDisplayTypes(
        this.supportedDisplayTypes.filter(
          (displayType) => displayType !== 'pivot_table'
        )
      )

      this.onRecommendedDisplayType('table')
    }
  }

  getColumnFromIndexString = (colIndexString) => {
    return _get(
      this.tableColumns,
      `[${_get(this.tableConfig, `[${colIndexString}]`)}]`
    )
  }

  generatePivotTableData = ({ isFirstGeneration, newTableData } = {}) => {
    try {
      let tableData =
        newTableData ||
        this.tableData ||
        _get(this.queryResponse, 'data.data.rows')
      tableData = tableData.filter((row) => row[0] !== null)

      const { legendColumnIndex, stringColumnIndex, numberColumnIndex } =
        this.tableConfig

      let uniqueValues0 = sortDataByDate(tableData, this.tableColumns)
        .map((d) => d[stringColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let uniqueValues1 = sortDataByDate(tableData, this.tableColumns)
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
        !isColumnDateType(this.getColumnFromIndexString('stringColumnIndex'))
      ) {
        newStringColumnIndex = legendColumnIndex
        newLegendColumnIndex = stringColumnIndex

        const tempValues = _cloneDeep(uniqueValues0)
        uniqueValues0 = _cloneDeep(uniqueValues1)
        uniqueValues1 = _cloneDeep(tempValues)
      }

      this.tableConfig.legendColumnIndex = newLegendColumnIndex
      this.tableConfig.stringColumnIndex = newStringColumnIndex

      // Generate new column array
      const pivotTableColumns = [
        {
          ...this.tableColumns[newStringColumnIndex],
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
          column: this.tableColumns[newLegendColumnIndex],
          config: getDataFormatting(this.props.dataFormatting),
        })
        pivotTableColumns.push({
          ...this.tableColumns[numberColumnIndex],
          origColumn: this.tableColumns[numberColumnIndex],
          origPivotColumn: this.tableColumns[newLegendColumnIndex],
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
        Object.keys(uniqueValues0).length
      )

      tableData.forEach((row) => {
        // Populate first column
        const pivotCategoryIndex = uniqueValues0[row[newStringColumnIndex]]
        const pivotCategoryValue = row[newStringColumnIndex]
        pivotTableData[pivotCategoryIndex][0] = pivotCategoryValue

        // Populate remaining columns
        const pivotColumnIndex = uniqueValues1[row[newLegendColumnIndex]] + 1
        const pivotValue = row[numberColumnIndex]
        pivotTableData[pivotCategoryIndex][pivotColumnIndex] = pivotValue

        pivotTableColumns[pivotColumnIndex].origValues[pivotCategoryValue] = {
          name: this.tableColumns[newStringColumnIndex]?.name,
          value: pivotCategoryValue,
        }
      })

      // Pie charts might be available if dataset is small enough
      const newSupportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
      if (!_isEqual(newSupportedDisplayTypes, this.supportedDisplayTypes)) {
        this.setSupportedDisplayTypes(newSupportedDisplayTypes)
      }

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = _get(this.pivotTableData, 'length', 0)
      this.setPivotTableConfig(isFirstGeneration)
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  onSuggestionClick = ({
    query,
    queryId,
    userSelection,
    isButtonClick,
    skipQueryValidation,
    source,
  }) => {
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
            <div className="feedback-message">
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
      if (this.props.queryInputRef) {
        this.props.queryInputRef.submitQuery({
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
        <div className="query-output-error-message">
          {splitErrorMessage.map((str, index) => {
            return (
              <span key={`error-message-part-${this.COMPONENT_KEY}-${index}`}>
                <span>{str}</span>
                {index !== splitErrorMessage.length - 1 && (
                  <button
                    className="report-like-text-button"
                    onClick={this.props.reportProblemCallback}
                  >
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
      <div
        className="no-columns-error-message"
        data-test="columns-hidden-message"
      >
        <div>
          <Icon className="warning-icon" type="warning-triangle" />
          <br /> All columns in this table are currently hidden. You can adjust
          your column visibility preferences using the Column Visibility Manager
          (<Icon className="eye-icon" type="eye" />) in the Options Toolbar.
        </div>
      </div>
    )
  }

  renderTable = () => {
    if (areAllColumnsHidden(this.queryResponse)) {
      return this.renderAllColumnsHiddenMessage()
    }

    if (
      !this.tableData ||
      (this.props.displayType === 'pivot_table' && !this.pivotTableData)
    ) {
      return this.renderMessage(
        'Error: There was no data supplied for this table'
      )
    }

    if (this.props.displayType === 'pivot_table') {
      return (
        <ErrorBoundary>
          <ChataTable
            themeConfig={this.props.themeConfig}
            key={this.pivotTableID}
            ref={(ref) => (this.pivotTableRef = ref)}
            columns={this.pivotTableColumns}
            data={this.pivotTableData}
            onCellClick={this.onTableCellClick}
            headerFilters={this.pivotHeaderFilters}
            onFilterCallback={this.onTableFilter}
            isResizing={this.props.isResizing}
            useInfiniteScroll={false}
            supportsDrilldowns={true}
            pivot
          />
        </ErrorBoundary>
      )
    }

    const useInfiniteScroll =
      this.props.enableAjaxTableData && this.isDataLimited()

    return (
      <ChataTable
        authentication={this.props.authentication}
        themeConfig={this.props.themeConfig}
        key={this.tableID}
        ref={(ref) => (this.tableRef = ref)}
        columns={this.tableColumns}
        data={this.tableData}
        onCellClick={this.onTableCellClick}
        queryID={this.queryID}
        headerFilters={this.headerFilters}
        onFilterCallback={this.onTableFilter}
        onNewPage={this.onNewPage}
        onNewData={this.onNewData}
        isResizing={this.props.isResizing}
        pageSize={_get(this.queryResponse, 'data.data.row_limit')}
        useInfiniteScroll={useInfiniteScroll}
        queryRequestData={this.queryResponse?.data?.data?.fe_req}
        queryText={this.queryResponse?.data?.data?.text}
        originalQueryID={this.props.originalQueryID}
        isDrilldown={this.isDrilldown()}
        supportsDrilldowns={
          isAggregation(this.tableColumns) &&
          getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns
        }
      />
    )
  }

  renderChart = (displayType) => {
    if (!this.tableData || !this.tableColumns || !this.tableConfig) {
      console.error('Required table data was missing')
      return this.renderMessage(
        'Error: There was no data supplied for this chart'
      )
    }

    const usePivotData = this.usePivotDataForChart()
    if (
      usePivotData &&
      (!this.pivotTableData ||
        !this.pivotTableColumns ||
        !this.pivotTableConfig)
    ) {
      console.error('Required pivot table data was missing')
      return this.renderMessage(
        'Error: There was no data supplied for this chart'
      )
    }

    const tableConfig = usePivotData ? this.pivotTableConfig : this.tableConfig
    return (
      <ErrorBoundary>
        <ChataChart
          themeConfig={this.props.themeConfig}
          dataLength={this.tableData.length}
          ref={(ref) => (this.chartRef = ref)}
          type={displayType || this.props.displayType}
          popoverParentElement={this.props.popoverParentElement}
          {...tableConfig}
          data={
            usePivotData
              ? this.state.visiblePivotRows || this.pivotTableData
              : this.state.visibleRows || this.tableData
          }
          columns={usePivotData ? this.pivotTableColumns : this.tableColumns}
          isPivot={usePivotData}
          dataFormatting={getDataFormatting(this.props.dataFormatting)}
          backgroundColor={this.props.backgroundColor}
          activeChartElementKey={this.props.activeChartElementKey}
          onLegendClick={this.onLegendClick}
          legendColumn={this.tableColumns[this.tableConfig?.legendColumnIndex]}
          changeStringColumnIndex={this.onChangeStringColumnIndex}
          changeLegendColumnIndex={this.onChangeLegendColumnIndex}
          changeNumberColumnIndices={this.onChangeNumberColumnIndices}
          onChartClick={this.onChartClick}
          isResizing={this.props.isResizing}
          enableDynamicCharting={this.props.enableDynamicCharting}
          tooltipID={`react-autoql-chart-tooltip-${this.COMPONENT_KEY}`}
          rebuildTooltips={this.rebuildTooltips}
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
          <button
            className="react-autoql-help-link-btn"
            target="_blank"
            onClick={() => window.open(url, '_blank')}
          >
            <Icon type="globe" className="react-autoql-help-link-icon" />
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
    const numRows = this.queryResponse?.data?.data?.rows?.length
    const maxRowLimit = this.queryResponse?.data?.data?.row_limit

    if (!numRows || !maxRowLimit) {
      return false
    }

    return numRows === maxRowLimit
  }

  noDataFound = () => {
    return this.queryResponse?.data?.data?.rows?.length === 0
  }

  renderMessage = (error) => {
    try {
      if (typeof error === 'object') {
        let errorMessage = errorMessages.GENERAL_QUERY

        if (error.message) {
          // Replace the "<report>" text with link
          errorMessage = error.message
          if (this.props.reportProblemCallback) {
            errorMessage = this.replaceErrorTextWithLinks(error.message)
          } else {
            errorMessage = errorMessage.replace('<report>', 'report')
          }
        }

        return (
          <div className="query-output-error-message">
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
      return <div className="query-output-error-message">{errorMessage}</div>
    } catch (error) {
      console.warn(error)
      return (
        <div className="query-output-error-message">
          {errorMessages.GENERAL_QUERY}
        </div>
      )
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
      return (
        <span>
          I'm not sure I understood your question. Please try asking again in a
          different way.
        </span>
      )
    }
  }

  renderTextResponse = () => {
    if (areAllColumnsHidden(this.queryResponse)) {
      return this.renderAllColumnsHiddenMessage()
    }

    return null
  }

  renderResponse = () => {
    const { displayType } = this.props

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
      return this.renderSuggestionMessage(
        this.queryResponse.data.data.items,
        this.queryResponse.data.data.query_id
      )
    }

    // Query validation was triggered, display query validation message
    if (_get(this.queryResponse, 'data.data.replacements')) {
      return (
        <QueryValidationMessage
          themeConfig={this.props.themeConfig}
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
          onQueryValidationSelectOption={
            this.props.onQueryValidationSelectOption
          }
          initialSelections={this.props.queryValidationSelections}
          autoSelectSuggestion={this.props.autoSelectQueryValidationSuggestion}
        />
      )
    }

    // This is not technically an error. There is just no data in the DB
    if (this.noDataFound()) {
      return this.replaceErrorTextWithLinks(this.queryResponse.data.message)
    }

    if (displayType && !!_get(this.queryResponse, 'data.data.rows')) {
      if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (displayType === 'text') {
        return this.renderTextResponse()
      } else if (displayType === 'single-value') {
        return this.renderSingleValueResponse()
      } else if (isTableType(displayType)) {
        return this.renderTable()
      } else if (isChartType(displayType)) {
        return this.renderChart()
      }

      console.warn(
        `display type not recognized: ${this.props.displayType} - rendering as plain text`
      )

      return this.renderMessage(
        `display type not recognized: ${this.props.displayType}`
      )
    }

    return null
  }

  shouldRenderReverseTranslation = () => {
    return (
      getAutoQLConfig(this.props.autoQLConfig).enableQueryInterpretation &&
      this.props.showQueryInterpretation &&
      this.queryResponse?.data?.data?.interpretation &&
      !areAllColumnsHidden(this.queryResponse)
    )
  }

  renderReverseTranslation = () => {
    return (
      <ReverseTranslation
        authentication={this.props.authentication}
        onValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={this.props.appliedFilters}
        isResizing={this.props.isResizing}
        reverseTranslation={_get(
          this.queryResponse,
          'data.data.parsed_interpretation'
        )}
      />
    )
  }

  shouldRenderDataLimitWarning = () => {
    const isTableAndAjax =
      this.props.enableAjaxTableData && this.props.displayType === 'table'

    return (
      !isTableAndAjax &&
      this.isDataLimited() &&
      !areAllColumnsHidden(this.queryResponse)
    )
  }

  renderDataLimitWarning = () => {
    const isReverseTranslationRendered =
      getAutoQLConfig(this.props.autoQLConfig).enableQueryInterpretation &&
      this.props.showQueryInterpretation

    return (
      <div className="dashboard-data-limit-warning-icon">
        <Icon
          type="warning"
          data-tip={`The display limit of ${this.queryResponse?.data?.data?.row_limit} rows has been reached.<br />
            Try querying a smaller time-frame to ensure<br />
            all your data is displayed.`}
          data-for={`react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
          data-place={isReverseTranslationRendered ? 'left' : 'right'}
        />
      </div>
    )
  }

  renderFooter = () => {
    const shouldRenderRT = this.shouldRenderReverseTranslation()
    const shouldRenderDLW = this.shouldRenderDataLimitWarning()

    return (
      <div
        className={`query-output-footer${
          !shouldRenderRT && !shouldRenderDLW ? ' no-margin' : ''
        }`}
      >
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
          data-test="query-response-wrapper"
          className={`react-autoql-response-content-container
          ${isTableType(this.props.displayType) ? 'table' : ''}`}
        >
          {this.renderResponse()}
          {this.renderFooter()}
        </div>
        <ReactTooltip
          className="react-autoql-tooltip"
          id={`react-autoql-query-output-tooltip-${this.COMPONENT_KEY}`}
          effect="solid"
          place="left"
          html
        />
        <ReactTooltip
          className="react-autoql-chart-tooltip"
          id={`react-autoql-chart-tooltip-${this.COMPONENT_KEY}`}
          effect="solid"
          html
        />
      </ErrorBoundary>
    )
  }
}
