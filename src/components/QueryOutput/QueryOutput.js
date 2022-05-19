import React, { Fragment } from 'react'
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
  number,
  bool,
  string,
  func,
  shape,
  arrayOf,
  instanceOf,
} from 'prop-types'

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
} from '../../js/Util.js'

import {
  isColumnNumberType,
  isColumnStringType,
  getNumberColumnIndices,
  getMultiSeriesColumnIndex,
  getDateColumnIndex,
  getStringColumnIndices,
  isColumnDateType,
} from './columnHelpers.js'

import { sendSuggestion, runDrilldown } from '../../js/queryService'

import './QueryOutput.scss'
import { MONTH_NAMES } from '../../js/Constants'
import { ReverseTranslation } from '../ReverseTranslation'

String.prototype.isUpperCase = function() {
  return this.valueOf().toUpperCase() === this.valueOf()
}

String.prototype.toProperCase = function() {
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

    this.queryResponse = props.queryResponse
    this.supportedDisplayTypes = getSupportedDisplayTypes({
      response: props.queryResponse,
    })
    this.queryID = _get(props.queryResponse, 'data.data.query_id')
    this.interpretation = _get(props.queryResponse, 'data.data.interpretation')
    this.tableID = uuid()
    this.pivotTableID = uuid()

    // Set initial config if needed
    // If this config causes errors, it will be reset when the error occurs
    if (props.tableConfig && this.isTableConfigValid(props.tableConfig)) {
      this.tableConfig = _cloneDeep(props.tableConfig)
    }

    const isProvidedDisplayTypeValid = isDisplayTypeValid(
      props.queryResponse,
      props.displayType
    )

    // Set the initial display type based on prop value, response, and supported display types
    const displayType = isProvidedDisplayTypeValid
      ? props.displayType
      : getDefaultDisplayType(props.queryResponse, props.autoChartAggregations)

    // Set theme colors
    const { chartColors } = getThemeConfig(props.themeConfig)
    this.colorScale = scaleOrdinal().range(chartColors)
    setCSSVars(getThemeConfig(props.themeConfig))

    // --------- generate data before mount --------
    this.generateAllData(props.queryResponse, displayType)
    // -------------------------------------------

    const isShowingInterpretation = getAutoQLConfig(props.autoQLConfig)
      .defaultShowInterpretation

    this.state = {
      displayType,
      tableFilters: [],
      suggestionSelection: props.selectedSuggestion,
      isShowingInterpretation,
    }
  }

  static propTypes = {
    queryResponse: shape({}),
    queryInputRef: instanceOf(QueryInput),
    authentication: authenticationType,
    themeConfig: themeConfigType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    tableConfig: shape({}),
    onSuggestionClick: func,
    displayType: string,
    renderTooltips: bool,
    onQueryValidationSelectOption: func,
    autoSelectQueryValidationSuggestion: bool,
    queryValidationSelections: arrayOf(shape({})),
    renderSuggestionsAsDropdown: bool,
    suggestionSelection: string,
    activeChartElementKey: string,
    enableColumnHeaderContextMenu: bool,
    isResizing: bool,
    enableDynamicCharting: bool,
    onTableConfigChange: func,
    onNoneOfTheseClick: func,
    autoChartAggregations: bool,
    onSupportedDisplayTypesChange: func,
    onRTValueLabelClick: func,
    isDashboardQuery: bool,
    enableQueryInterpretation: bool,
    defaultShowInterpretation: bool,
    isTaskModule: bool,
    onUpdate: func,
    onDrilldownStart: func,
    onDrilldownEnd: func,
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
    renderTooltips: true,
    autoSelectQueryValidationSuggestion: true,
    queryValidationSelections: undefined,
    renderSuggestionsAsDropdown: false,
    selectedSuggestion: undefined,
    activeChartElementKey: undefined,
    enableColumnHeaderContextMenu: false,
    isResizing: false,
    enableDynamicCharting: true,
    onNoneOfTheseClick: undefined,
    autoChartAggregations: true,
    isDashboardQuery: false,
    enableFilterLocking: false,
    showQueryInterpretation: false,
    isTaskModule: false,
    onDataClick: () => {},
    onQueryValidationSelectOption: () => {},
    onSupportedDisplayTypesChange: () => {},
    onErrorCallback: () => {},
    onRTValueLabelClick: () => {},
    onRecommendedDisplayType: () => {},
    onUpdate: () => {},
    onDrilldownStart: () => {},
    onDrilldownEnd: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    try {
      if (this.props.optionsToolbarRef?._isMounted) {
        this.props.optionsToolbarRef.forceUpdate()
      }

      const isProvidedDisplayTypeValid = isDisplayTypeValid(
        this.props.queryResponse,
        this.props.displayType
      )

      if (!isProvidedDisplayTypeValid) {
        this.onRecommendedDisplayType(
          getDefaultDisplayType(
            this.props.queryResponse,
            this.props.autoChartAggregations
          )
        )
      } else {
        this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)
      }
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
      // If data config was changed by a prop, change data config here
      if (!_isEqual(this.props.tableConfig, prevProps.tableConfig)) {
        if (this.props.tableConfig) {
          this.tableConfig = _cloneDeep(this.props.tableConfig)
        } else {
          this.setTableConfig()
        }
      }

      // If data config was changed here, tell the parent
      if (
        !_isEqual(this.props.tableConfig, this.tableConfig) &&
        this.props.onTableConfigChange
      ) {
        this.props.onTableConfigChange(this.tableConfig)
      }

      // If columns changed, we need to reset the column data config
      if (
        !_isEqual(this.props.columns, prevProps.columns) &&
        this.props.onTableConfigChange
      ) {
        this.props.onTableConfigChange({})
      }

      if (
        _isEqual(
          getThemeConfig(this.props.themeConfig),
          getThemeConfig(prevProps.themeConfig)
        )
      ) {
        setCSSVars(getThemeConfig(this.props.themeConfig))
      }

      if (this.props.queryResponse && !this.queryResponse) {
        if (
          !isDisplayTypeValid(this.props.queryResponse, this.props.displayType)
        ) {
          const recommendedDisplayType = getDefaultDisplayType(
            this.props.queryResponse,
            this.props.autoChartAggregations
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

        if (!isDisplayTypeValid(this.queryResponse, this.props.displayType)) {
          const recommendedDisplayType = getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations
          )
          this.onRecommendedDisplayType(recommendedDisplayType)
        } else {
          this.setResponseData()
          this.forceUpdate()
        }
      }

      // Detected a display type change from props. We must make sure
      // the display type is valid before updating the state
      if (
        this.props.displayType !== prevProps.displayType &&
        !isDisplayTypeValid(this.queryResponse, this.props.displayType)
      ) {
        const recommendedDisplayType = getDefaultDisplayType(
          this.queryResponse,
          this.props.autoChartAggregations
        )
        this.onRecommendedDisplayType(recommendedDisplayType)
      }

      // Do not allow scrolling while the context menu is open
      if (!prevState.isContextMenuOpen && this.state.isContextMenuOpen) {
        disableScroll.on()
      } else if (prevState.isContextMenuOpen && !this.state.isContextMenuOpen) {
        disableScroll.off()
      }

      if (
        prevState.isShowingInterpretation !== this.state.isShowingInterpretation
      ) {
        this.forceUpdate()
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
    clearTimeout(this.filterDrilldownTimeout)
    this._isMounted = false
    ReactTooltip.hide()
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

  onRecommendedDisplayType = (recommendedDisplayType) => {
    this.props.onRecommendedDisplayType(
      recommendedDisplayType,
      this.supportedDisplayTypes
    )
    console.warn(
      `Display type ${this.props.displayType} is not supported for this dataset, we called the onRecommendedDisplayType callback with the recommended display type: ${recommendedDisplayType}`
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

    // Get new supported display types after column change
    const newSupportedDisplayTypes = getSupportedDisplayTypes({
      response: this.queryResponse,
    })
    this.supportedDisplayTypes = newSupportedDisplayTypes
    this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)

    if (areAllColumnsHidden(this.queryResponse)) {
      // If all columns are hidden, display warning message instead of table
      this.onRecommendedDisplayType('text')
      return
    }

    // Reset persisted column config data
    this.tableConfig = undefined
    // Generate new table data from new columns
    if (this.shouldGenerateTableData()) {
      this.generateTableData()
      if (this.shouldGeneratePivotData()) {
        this.generatePivotTableData({ isFirstGeneration: true })
      } else {
        this.pivotTableColumns = undefined
        this.pivotTableData = undefined
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

  dateSortFn = (a, b) => {
    // First try to convert to number. It will sort properly if its a plain year or a unix timestamp
    let aDate = Number(a)
    let bDate = Number(b)

    // If one is not a number, use dayjs to format
    if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
      aDate = dayjs(a).unix()
      bDate = dayjs(b).unix()
    }

    // Finally if all else fails, just compare the 2 values directly
    if (!aDate || !bDate) {
      //If one is a YYYY-WW
      if (a.includes('-W')) {
        let aDateYear = a.substring(0, 4)
        let bDateYear = b.substring(0, 4)
        if (aDateYear !== bDateYear) {
          return bDateYear - aDateYear
        } else {
          let aDateWeek = a.substring(6, 8)
          let bDateWeek = b.substring(6, 8)
          return bDateWeek - aDateWeek
        }
      }
      //If one is one of a weekday
      else {
        const days = [
          {
            description: 'Sunday',
            value: 1,
            label: 'S',
          },
          {
            description: 'Monday',
            value: 2,
            label: 'M',
          },
          {
            description: 'Tuesday',
            value: 3,
            label: 'T',
          },
          {
            description: 'Wednesday',
            value: 4,
            label: 'W',
          },
          {
            description: 'Thursday',
            value: 5,
            label: 'T',
          },
          {
            description: 'Friday',
            value: 6,
            label: 'F',
          },
          {
            description: 'Saturday',
            value: 7,
            label: 'S',
          },
        ]
        let aWeekDay = null
        let bWeekDay = null
        days.forEach((weekdays) => {
          if (a.trim() === weekdays.description) {
            return (aWeekDay = weekdays.value)
          }
        })
        days.forEach((weekdays) => {
          if (b.trim() === weekdays.description) {
            return (bWeekDay = weekdays.value)
          }
        })
        if (aWeekDay === null || bWeekDay === null) {
          return b - a
        }
        return bWeekDay - aWeekDay
      }
    }
    return bDate - aDate
  }

  sortTableDataByDate = (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return undefined
      }

      const dateColumnIndex = getDateColumnIndex(this.tableColumns)

      if (dateColumnIndex >= 0) {
        let sortedData = [...data].sort((a, b) =>
          this.dateSortFn(a[dateColumnIndex], b[dateColumnIndex])
        )

        return sortedData
      }

      return data
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  generateTableData = (columns) => {
    this.tableColumns = columns || this.formatColumnsForTable()
    let filteredResponse = this.queryResponse.data.data.rows.filter(
      (row) => row[0] !== null
    )

    this.tableData = this.sortTableDataByDate(filteredResponse)

    this.setTableConfig()
  }

  generatePivotData = ({ isFirstGeneration, newTableData } = {}) => {
    try {
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
        <div className="react-autoql-suggestion-message">
          <div className="react-autoql-suggestions-container">
            {this.props.renderSuggestionsAsDropdown ? (
              <select
                key={uuid()}
                onChange={(e) => {
                  if (this._isMounted) {
                    this.setState({ suggestionSelection: e.target.value })
                    this.onSuggestionClick({
                      query: e.target.value,
                      source: 'suggestion',
                      queryId,
                    })
                  }
                }}
                value={this.state.suggestionSelection}
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
                  <div key={uuid()}>
                    <button
                      onClick={() =>
                        this.onSuggestionClick({
                          query: suggestion,
                          isButtonClick: true,
                          source: 'suggestion',
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
      suggestionListMessage = (
        <div className="react-autoql-suggestion-message">
          Sorry something went wrong, I have no suggestions for you.
        </div>
      )
    }

    return suggestionListMessage
  }

  renderSingleValueResponse = () => {
    return (
      <a
        className={`single-value-response ${
          getAutoQLConfig(this.props.autoQLConfig).enableDrilldowns
            ? ' with-drilldown'
            : ''
        }`}
        onClick={() => {
          this.props.onDataClick(
            { supportedByAPI: true, data: [] },
            this.queryID,
            true
          )
        }}
      >
        {formatElement({
          element: _get(this.queryResponse, 'data.data.rows[0][0]'),
          column: _get(this.queryResponse, 'data.data.columns[0]'),
          config: getDataFormatting(this.props.dataFormatting),
        })}
      </a>
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
    const filteredRows = this.tableData?.filter((origRow) => {
      return `${origRow[stringColumnIndex]}` === `${row[stringColumnIndex]}`
    })

    const drilldownResponse = _cloneDeep(this.queryResponse)
    drilldownResponse.data.data.rows = filteredRows
    return drilldownResponse
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
          const response = await runDrilldown({
            ...getAuthentication(getAuthentication(this.props.authentication)),
            ...getAutoQLConfig(getAutoQLConfig(this.props.autoQLConfig)),
            queryID: this.queryID,
            groupBys,
          })
          this.props.onDrilldownEnd({ response })
        } else if (!isNaN(stringColumnIndex) && !!row?.length) {
          this.props.onDrilldownStart(activeKey)
          const response = this.getFilterDrilldown({ stringColumnIndex, row })
          this.filterDrilldownTimeout = setTimeout(() => {
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
    let groupBys = {}
    if (this.pivotTableColumns && this.props.displayType === 'pivot_table') {
      groupBys = getGroupBysFromPivotTable(
        cell,
        this.tableColumns,
        this.pivotTableColumns,
        this.pivotOriginalColumnData
      )
    } else {
      groupBys = getGroupBysFromTable(cell, this.tableColumns)
    }

    this.processDrilldown({ groupBys, supportedByAPI: !!groupBys })
  }

  onChartClick = (
    row,
    columnIndex,
    columns,
    stringColumnIndex,
    legendColumn,
    numberColumnIndex,
    activeKey
  ) => {
    const drilldownData = {}
    const groupBys = []

    const stringColumn =
      columns?.[stringColumnIndex]?.origColumn || columns?.[stringColumnIndex]

    if (columns?.[stringColumnIndex]?.datePivot) {
      const year = Number(columns?.[columnIndex]?.name)
      const month = row?.[stringColumnIndex]
      const value = this.pivotOriginalColumnData?.[year]?.[month]
      groupBys.push({
        name: stringColumn.name,
        value,
      })
    } else if (stringColumn?.groupable) {
      groupBys.push({
        name: stringColumn.name,
        value: row?.[stringColumnIndex],
      })
    }

    if (legendColumn?.groupable) {
      groupBys.push({
        name: legendColumn.name,
        value: columns?.[numberColumnIndex]?.name,
      })
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

  onTableFilter = async (filters, rows) => {
    if (this.props.displayType === 'table') {
      this.headerFilters = filters

      const newTableData = []
      rows.forEach((row) => {
        newTableData.push(row.getData())
      })

      const numRows = newTableData.length
      const prevRows =
        this.prevRows >= 0 ? this.prevRows : this.tableData?.length

      if (numRows !== prevRows) {
        // We dont use filtered table to chart currently.
        // We can enable this if we add that feature back
        // this.setSupportedDisplayTypes(
        //   getSupportedDisplayTypes({
        //     response: this.queryResponse,
        //     dataLength: this.tableData?.length,
        //     pivotDataLength: this.pivotTableData?.length,
        //   })
        // )

        if (this.shouldGeneratePivotData(newTableData)) {
          this.generatePivotData({ newTableData })
        }

        if (this.props.optionsToolbarRef?._isMounted) {
          this.props.optionsToolbarRef.forceUpdate()
        }

        this.prevRows = numRows
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
      newColumns[columnIndex].isSeriesHidden = !newColumns[columnIndex]
        .isSeriesHidden

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
    if (this.supportsPivot()) {
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
    if (this.supportsPivot()) {
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

    if (this.supportsPivot()) {
      this.pivotTableConfig.numberColumnIndices = indices
      this.pivotTableConfig.numberColumnIndex = indices[0]
    } else {
      this.tableConfig.numberColumnIndices = indices
      this.tableConfig.numberColumnIndex = indices[0]
    }

    this.forceUpdate()
  }

  setPivotTableConfig = () => {
    const columns = this.pivotTableColumns

    if (!columns) {
      return
    }

    if (!this.pivotTableConfig) {
      this.pivotTableConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (
      !this.pivotTableConfig.stringColumnIndices ||
      !(this.pivotTableConfig.stringColumnIndex >= 0)
    ) {
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(
        columns
      )
      this.pivotTableConfig.stringColumnIndices = stringColumnIndices
      this.pivotTableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (!this.pivotTableConfig.numberColumnIndices) {
      const { numberColumnIndex, numberColumnIndices } = getNumberColumnIndices(
        columns
      )
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
      const { stringColumnIndices, stringColumnIndex } = getStringColumnIndices(
        columns
      )
      this.tableConfig.stringColumnIndices = stringColumnIndices
      this.tableConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (
      !this.tableConfig.numberColumnIndices ||
      !(this.tableConfig.numberColumnIndex >= 0)
    ) {
      const { numberColumnIndex, numberColumnIndices } = getNumberColumnIndices(
        columns
      )
      this.tableConfig.numberColumnIndices = numberColumnIndices
      this.tableConfig.numberColumnIndex = numberColumnIndex
    }

    // Set legend index if there should be one
    let legendColumnIndex = this.tableColumns.findIndex(
      (col, i) => col.groupable && i !== this.tableConfig.stringColumnIndex
    )
    if (legendColumnIndex >= 0)
      this.tableConfig.legendColumnIndex = legendColumnIndex
  }

  setSupportedDisplayTypes = (supportedDisplayTypes, justMounted) => {
    if (
      supportedDisplayTypes &&
      (justMounted ||
        !_isEqual(supportedDisplayTypes, this.supportedDisplayTypes))
    ) {
      this.supportedDisplayTypes = supportedDisplayTypes

      if (!this.supportedDisplayTypes.includes(this.props.displayType)) {
        this.onRecommendedDisplayType(
          getDefaultDisplayType(
            this.queryResponse,
            this.props.autoChartAggregations
          )
        )
      } else {
        this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)
      }
    }
  }

  getTooltipDataForCell = (row, columnIndex, numberValue) => {
    let tooltipElement = null
    try {
      if (this.supportsPivot()) {
        const stringColumn = this.tableColumns[
          this.tableConfig.stringColumnIndex
        ]
        const numberColumn = this.tableColumns[
          this.tableConfig.numberColumnIndex
        ]
        const legendColumn = this.tableColumns[
          this.tableConfig.legendColumnIndex
        ]
        const legendColumn = this.tableColumns[
          this.dataConfig.legendColumnIndex
        ]

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
        const stringColumn = this.tableColumns[
          this.tableConfig.stringColumnIndex
        ]
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
      return (a, b) => this.dateSortFn(b, a)
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

      col.field = `${i}`
      col.title = col.display_name
      col.id = uuid()
      col.widthGrow = 1
      col.widthShrink = 1

      // Visibility flag: this can be changed through the column visibility editor modal
      col.visible = col.is_visible

      // Cell alignment
      if (
        col.type === 'DOLLAR_AMT' ||
        col.type === 'RATIO' ||
        col.type === 'NUMBER'
      ) {
        col.hozAlign = 'right'
      } else {
        col.hozAlign = 'center'
      }

      // Cell formattingg
      col.formatter = (cell, formatterParams, onRendered) => {
        return formatElement({
          element: cell.getValue(),
          column: col,
          config: getDataFormatting(this.props.dataFormatting),
          htmlElement: cell.getElement(),
        })
      }

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      col.headerFilter = 'input'

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      col.headerFilterFunc = this.setFilterFunction(col)

      // Allow proper chronological sorting for date strings
      col.sorter = this.setSorterFunction(col)

      // Context menu when right clicking on column header
      col.headerContext = (e, column) => {
        // Do not show native context menu
        e.preventDefault()
        this.setState({
          isContextMenuOpen: true,
          activeColumn: column,
          contextMenuPosition: { top: e.clientY + 10, left: e.clientX - 20 },
        })
      }

      return col
    })

    return formattedColumns
  }

  formatDatePivotYear = (data, dateColumnIndex) => {
    if (this.tableColumns[dateColumnIndex].type === 'DATE') {
      return dayjs
        .unix(data[dateColumnIndex])
        .utc()
        .format('YYYY')
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
      // todo: just make this from a simple array
      const uniqueMonths = {
        [MONTH_NAMES[1]]: 0,
        [MONTH_NAMES[2]]: 1,
        [MONTH_NAMES[3]]: 2,
        [MONTH_NAMES[4]]: 3,
        [MONTH_NAMES[5]]: 4,
        [MONTH_NAMES[6]]: 5,
        [MONTH_NAMES[7]]: 6,
        [MONTH_NAMES[8]]: 7,
        [MONTH_NAMES[9]]: 8,
        [MONTH_NAMES[10]]: 9,
        [MONTH_NAMES[11]]: 10,
        [MONTH_NAMES[12]]: 11,
      }

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
          return Number(
            dayjs
              .unix(d[dateColumnIndex])
              .utc()
              .format('YYYY')
          )
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
          title: 'Month',
          name: 'Month',
          field: '0',
          frozen: true,
          visible: true,
          is_visible: true,
          type: 'DATE_STRING',
          datePivot: true,
          origColumn: this.tableColumns[dateColumnIndex],
        },
      ]

      Object.keys(uniqueYears).forEach((year, i) => {
        pivotTableColumns.push({
          ...this.tableColumns[numberColumnIndex],
          origColumn: this.tableColumns[numberColumnIndex],
          name: year,
          title: year,
          field: `${i + 1}`,
          headerContext: undefined,
          visible: true,
        })
      })

      const pivotTableData = makeEmptyArray(Object.keys(uniqueYears).length, 12)
      const pivotOriginalColumnData = {}

      // Populate first column
      Object.keys(uniqueMonths).forEach((month, i) => {
        pivotTableData[i][0] = month
      })
      // Populate remaining columns
      tableData.forEach((row) => {
        const year = this.formatDatePivotYear(row, dateColumnIndex)
        const month = this.formatDatePivotMonth(row, dateColumnIndex)

        const yearNumber = uniqueYears[year]
        const monthNumber = uniqueMonths[month]

        if (monthNumber && yearNumber) {
          pivotTableData[monthNumber][yearNumber] = row[numberColumnIndex]
          pivotOriginalColumnData[year] = {
            ...pivotOriginalColumnData[year],
            [month]: row[dateColumnIndex],
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
      this.supportedDisplayTypes = this.supportedDisplayTypes.filter(
        (displayType) => displayType !== 'pivot_table'
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

      const {
        legendColumnIndex,
        stringColumnIndex,
        numberColumnIndex,
      } = this.tableConfig

      let uniqueValues0 = this.sortTableDataByDate(tableData)
        .map((d) => d[stringColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let uniqueValues1 = this.sortTableDataByDate(tableData)
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

      // Generate new column array
      const pivotTableColumns = [
        {
          ...this.tableColumns[newStringColumnIndex],
          frozen: true,
          headerContext: undefined,
          visible: true,
          field: '0',
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
          name: columnName,
          title: formattedColumnName,
          field: `${i + 1}`,
          headerContext: undefined,
          visible: true,
        })
      })

      const pivotTableData = makeEmptyArray(
        Object.keys(uniqueValues1).length + 1, // Add one for the frozen first column
        Object.keys(uniqueValues0).length
      )

      tableData.forEach((row) => {
        // Populate first column
        pivotTableData[uniqueValues0[row[newStringColumnIndex]]][0] =
          row[newStringColumnIndex]

        // Populate remaining columns
        pivotTableData[uniqueValues0[row[newStringColumnIndex]]][
          uniqueValues1[row[newLegendColumnIndex]] + 1
        ] = row[numberColumnIndex]
      })

      // Pie charts might be available if dataset is small enough
      const newSupportedDisplayTypes = getSupportedDisplayTypes({
        response: this.queryResponse,
      })
      if (!_isEqual(newSupportedDisplayTypes, this.supportedDisplayTypes)) {
        this.setSupportedDisplayTypes(newSupportedDisplayTypes)
      }

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = _get(this.pivotTableData, 'length', 0)
      this.setPivotTableConfig()
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
      } else {
        this.setState({ customResponse: 'Thank you for your feedback.' })
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
        <div>
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

  renderAllColumnsHiddenMessage = () => {
    return (
      <div className="no-columns-error-message">
        <div>
          <Icon className="warning-icon" type="warning-triangle" />
          <br /> All columns in this table are currently hidden. You can adjust
          your column visibility preferences using the Column Visibility Manager
          (
          <Icon className="eye-icon" type="eye" />) in the Options Toolbar.
        </div>
      </div>
    )
  }

  renderTable = () => {
    if (
      !this.tableData ||
      (this.props.displayType === 'pivot_table' && !this.pivotTableData)
    ) {
      return 'Error: There was no data supplied for this table'
    }

    if (this.props.displayType === 'pivot_table') {
      return (
        <ErrorBoundary>
          <ChataTable
            themeConfig={getThemeConfig(this.props.themeConfig)}
            key={this.pivotTableID}
            ref={(ref) => (this.pivotTableRef = ref)}
            columns={this.pivotTableColumns}
            data={this.pivotTableData}
            onCellClick={this.onTableCellClick}
            headerFilters={this.pivotHeaderFilters}
            onFilterCallback={this.onTableFilter}
            isResizing={this.props.isResizing}
            enableColumnHeaderContextMenu={
              this.props.enableColumnHeaderContextMenu
            }
          />
        </ErrorBoundary>
      )
    }

    return (
      <ChataTable
        themeConfig={getThemeConfig(this.props.themeConfig)}
        key={this.tableID}
        ref={(ref) => (this.tableRef = ref)}
        columns={this.tableColumns}
        data={this.tableData}
        onCellClick={this.onTableCellClick}
        headerFilters={this.headerFilters}
        onFilterCallback={this.onTableFilter}
        isResizing={this.props.isResizing}
      />
    )
  }

  renderChart = (displayType) => {
    if (!this.tableData || !this.tableColumns || !this.tableConfig) {
      console.error('Required table data was missing')
      return 'Error: There was no data supplied for this chart'
    }

    const supportsPivot = this.supportsPivot()
    if (
      supportsPivot &&
      (!this.pivotTableData ||
        !this.pivotTableColumns ||
        !this.pivotTableConfig)
    ) {
      console.error('Required pivot table data was missing')
      return 'Error: There was no data supplied for this chart'
    }

    const dataConfig = supportsPivot ? this.pivotTableConfig : this.tableConfig

    return (
      <ErrorBoundary>
        <ChataChart
          themeConfig={getThemeConfig(this.props.themeConfig)}
          dataLength={this.tableData.length}
          ref={(ref) => (this.chartRef = ref)}
          type={displayType || this.props.displayType}
          {...dataConfig}
          data={supportsPivot ? this.pivotTableData : this.tableData}
          columns={supportsPivot ? this.pivotTableColumns : this.tableColumns}
          isPivot={supportsPivot}
          isShowingInterpretation={this.state.isShowingInterpretation}
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
          isAnimatingContainer={this.props.isAnimatingContainer}
          enableDynamicCharting={this.props.enableDynamicCharting}
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

      return <div>{errorMessage}</div>
    } catch (error) {
      console.warn(error)
      return <div>{errorMessages.GENERAL_QUERY}</div>
    }
  }

  renderHTMLMessage = (queryResponse) => {
    if (_get(queryResponse, 'data.data.answer', null) !== null) {
      return parse(_get(queryResponse, 'data.data.answer'), {
        replace: (domNode) => {
          if (domNode.name === 'a') {
            const props = domNode.attribs || {}
            return (
              <a {...props} target="_blank">
                {domNode.children}
              </a>
            )
          }
        },
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

    // This is used for "Thank you for your feedback" response
    // when user clicks on "None of these" in the suggestion list
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
          themeConfig={getThemeConfig(this.props.themeConfig)}
          key={this.QUERY_VALIDATION_KEY}
          response={this.queryResponse}
          onSuggestionClick={({ query, userSelection }) =>
            this.onSuggestionClick({
              query,
              userSelection,
              isButtonClick: true,
              skipQueryValidation: true,
              source: 'validation',
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
    if (!_get(this.queryResponse, 'data.data.rows.length')) {
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

  renderReverseTranslation = () => {
    return (
      <ReverseTranslation
        authentication={this.props.authentication}
        onValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={this.props.appliedFilters}
        isResizing={this.props.isResizing}
        reverseTranslation={_get(
          this.queryResponse,
          'data.data.reverse_translation'
        )}
      />
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
          {getAutoQLConfig(this.props.autoQLConfig).enableQueryInterpretation &&
          this.props.showQueryInterpretation
            ? this.renderReverseTranslation()
            : null}
        </div>
      </ErrorBoundary>
    )
  }
}
