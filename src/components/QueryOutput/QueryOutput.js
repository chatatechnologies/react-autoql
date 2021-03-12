import React, { Fragment } from 'react'
import uuid from 'uuid'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import disableScroll from 'disable-scroll'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

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

import dayjs from '../../js/dayjsWithPlugins'

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
  supportsRegularPivotTable,
  getNumberOfGroupables,
  getPadding,
} from '../../js/Util.js'

import {
  isColumnNumberType,
  isColumnStringType,
  getNumberColumnIndices,
  getMultiSeriesColumnIndex,
  getDateColumnIndex,
  getStringColumnIndices,
  shouldPlotMultiSeries,
  isColumnDateType,
} from './columnHelpers.js'

import { sendSuggestion } from '../../js/queryService'

import './QueryOutput.scss'
import { MONTH_NAMES } from '../../js/Constants'

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
  supportedDisplayTypes = []
  SAFETYNET_KEY = uuid.v4()

  static propTypes = {
    queryResponse: shape({}),
    queryInputRef: instanceOf(QueryInput),
    authentication: authenticationType,
    themeConfig: themeConfigType,
    autoQLConfig: autoQLConfigType,
    authentication: authenticationType,
    dataFormatting: dataFormattingType,
    dataConfig: shape({}),
    onSuggestionClick: func,
    displayType: string,
    renderTooltips: bool,
    onQueryValidationSelectOption: func,
    autoSelectQueryValidationSuggestion: bool,
    queryValidationSelections: arrayOf(shape({})),
    renderSuggestionsAsDropdown: bool,
    suggestionSelection: string,
    height: number,
    width: number,
    hideColumnCallback: func,
    activeChartElementKey: string,
    onTableFilterCallback: func,
    enableColumnHeaderContextMenu: bool,
    isResizing: bool,
    enableDynamicCharting: bool,
    onDataConfigChange: func,
    onDisplayTypeUpdate: func,
    onColumnsUpdate: func,
    onNoneOfTheseClick: func,
    autoChartAggregations: bool,
    onSupportedDisplayTypesChange: func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    autoQLConfig: autoQLConfigDefault,
    authentication: authenticationDefault,
    dataFormatting: dataFormattingDefault,
    dataConfig: undefined,

    queryResponse: undefined,
    displayType: undefined,
    queryInputRef: undefined,
    onSuggestionClick: undefined,
    renderTooltips: true,
    autoSelectQueryValidationSuggestion: true,
    queryValidationSelections: undefined,
    renderSuggestionsAsDropdown: false,
    selectedSuggestion: undefined,
    height: undefined,
    width: undefined,
    activeChartElementKey: undefined,
    enableColumnHeaderContextMenu: false,
    isResizing: false,
    enableDynamicCharting: true,
    onNoneOfTheseClick: undefined,
    autoChartAggregations: true,
    onDataClick: () => {},
    onQueryValidationSelectOption: () => {},
    onSupportedDisplayTypesChange: () => {},
    hideColumnCallback: () => {},
    onTableFilterCallback: () => {},
    onDataConfigChange: () => {},
    onErrorCallback: () => {},
    onDisplayTypeUpdate: () => {},
    onColumnsUpdate: () => {},
  }

  state = {
    displayType: null,
    tableFilters: [],
    suggestionSelection: this.props.selectedSuggestion,
  }

  componentDidMount = () => {
    try {
      // Set initial config if needed
      // If this config causes errors, it will be reset when the error occurs
      if (
        this.props.dataConfig &&
        this.isDataConfigValid(this.props.dataConfig)
      ) {
        this.dataConfig = _cloneDeep(this.props.dataConfig)
      }

      const { chartColors } = getThemeConfig(this.props.themeConfig)
      this.COMPONENT_KEY = uuid.v4()
      this.colorScale = scaleOrdinal().range(chartColors)
      setCSSVars(getThemeConfig(this.props.themeConfig))

      // Determine the supported visualization types based on the response data
      this.setSupportedDisplayTypes(
        getSupportedDisplayTypes(this.props.queryResponse),
        true
      )

      // Set the initial display type based on prop value, response, and supported display types
      this.setState({
        displayType: isDisplayTypeValid(
          this.props.queryResponse,
          this.props.displayType
        )
          ? this.props.displayType
          : getDefaultDisplayType(
              this.props.queryResponse,
              this.props.autoChartAggregations
            ),
      })

      if (this.props.optionsToolbarRef) {
        this.props.optionsToolbarRef.forceUpdate()
      }
      this.props.onDisplayTypeUpdate()
    } catch (error) {
      console.error(error)
      this.props.onErrorCallback(error)
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      // If data config was changed by a prop, change data config here
      if (!_isEqual(this.props.dataConfig, prevProps.dataConfig)) {
        if (this.props.dataConfig) {
          this.dataConfig = _cloneDeep(this.props.dataConfig)
        } else {
          this.setColumnIndices()
        }
      }

      // If data config was changed here, tell the parent
      if (!_isEqual(this.props.dataConfig, this.dataConfig)) {
        this.props.onDataConfigChange(this.dataConfig)
      }

      // If columns changed, we need to reset the column data config
      if (!_isEqual(this.props.columns, prevProps.columns)) {
        this.props.onDataConfigChange({})
      }

      if (
        _isEqual(
          getThemeConfig(this.props.themeConfig),
          getThemeConfig(prevProps.themeConfig)
        )
      ) {
        setCSSVars(getThemeConfig(this.props.themeConfig))
      }

      if (this.props.queryResponse && !prevProps.queryResponse) {
        this.setResponseData(this.state.displayType)
        this.forceUpdate()
      }

      // Initial display type has been determined, set the table and chart data now
      if (!prevState.displayType && this.state.displayType) {
        this.props.onDisplayTypeUpdate()
        this.setResponseData(this.state.displayType)
        this.forceUpdate()
        ReactTooltip.hide()
      }

      // Detected a display type change from props. We must make sure
      // the display type is valid before updating the state
      if (
        this.props.displayType &&
        this.props.displayType !== prevProps.displayType &&
        this.supportedDisplayTypes &&
        this.supportedDisplayTypes.includes(this.props.displayType)
      ) {
        this.tableID = uuid.v4()
        this.pivotTableID = uuid.v4()
        this.setState({ displayType: this.props.displayType })
      }

      // Do not allow scrolling while the context menu is open
      if (!prevState.isContextMenuOpen && this.state.isContextMenuOpen) {
        disableScroll.on()
      } else if (prevState.isContextMenuOpen && !this.state.isContextMenuOpen) {
        disableScroll.off()
      }

      if (this.props.optionsToolbarRef) {
        this.props.optionsToolbarRef.forceUpdate()
      }

      ReactTooltip.rebuild()
    } catch (error) {
      console.error(error)
    }
  }

  componentWillUnmount = () => {
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

  isDataConfigValid = (dataConfig) => {
    try {
      if (
        !dataConfig ||
        !dataConfig.numberColumnIndices ||
        !dataConfig.stringColumnIndices ||
        Number.isNaN(Number(dataConfig.numberColumnIndex)) ||
        Number.isNaN(Number(dataConfig.stringColumnIndex))
      ) {
        return false
      }

      if (
        !Array.isArray(dataConfig.numberColumnIndices) ||
        !Array.isArray(dataConfig.stringColumnIndices)
      ) {
        return false
      }

      const columns = _get(this.props.queryResponse, 'data.data.columns')

      const areNumberColumnsValid = dataConfig.numberColumnIndices.every(
        (index) => {
          return columns[index] && isColumnNumberType(columns[index])
        }
      )
      if (!areNumberColumnsValid) {
        return false
      }

      const areStringColumnsValid = dataConfig.stringColumnIndices.every(
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
    if (this.tableColumns) {
      this.tableColumns = columns

      this.props.onColumnsUpdate(this.tableColumns)
      this.setColumnIndices()
      this.forceUpdate()
    }
  }

  setResponseData = () => {
    // Initialize ID's of tables
    this.tableID = uuid.v4()
    this.pivotTableID = uuid.v4()

    const { displayType } = this.state
    const { queryResponse } = this.props

    if (_get(queryResponse, 'data.data') && displayType) {
      const responseBody = queryResponse.data.data
      this.queryID = responseBody.query_id // We need queryID for drilldowns (for now)
      this.interpretation = responseBody.interpretation
      if (isTableType(displayType) || isChartType(displayType)) {
        this.generateTableData()
        this.shouldGeneratePivotData() &&
          this.generatePivotData({ isFirstGeneration: true })
        this.shouldGenerateChartData() && this.generateChartData()
      }
    }
  }

  shouldGeneratePivotData = () => {
    return this.tableData && this.supportedDisplayTypes.includes('pivot_table')
  }

  shouldGenerateChartData = () => {
    return this.supportedDisplayTypes.length > 1
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
      return b - a
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

  generateTableData = () => {
    this.tableColumns = this.formatColumnsForTable(
      this.props.queryResponse.data.data.columns
    )

    this.supportsPivot = supportsRegularPivotTable(this.tableColumns)

    const data = this.sortTableDataByDate(
      _get(this.props.queryResponse, 'data.data.rows')
    )
    this.tableData = data

    this.numberOfTableRows = _get(data, 'length', 0)
    this.setColumnIndices()
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
                key={uuid.v4()}
                onChange={(e) => {
                  this.setState({ suggestionSelection: e.target.value })
                  this.onSuggestionClick({
                    query: e.target.value,
                    source: 'suggestion',
                    queryId,
                  })
                }}
                value={this.state.suggestionSelection}
                className="react-autoql-suggestions-select"
              >
                {suggestions.map((suggestion, i) => {
                  return (
                    <option key={uuid.v4()} value={suggestion}>
                      {suggestion}
                    </option>
                  )
                })}
              </select>
            ) : (
              suggestions.map((suggestion) => {
                return (
                  <div key={uuid.v4()}>
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
          element: this.tableData[0],
          column: this.tableColumns[0],
          config: getDataFormatting(this.props.dataFormatting),
        })}
      </a>
    )
  }

  copyTableToClipboard = () => {
    if (this.state.displayType === 'table' && this.tableRef) {
      this.tableRef.copyToClipboard()
    } else if (this.state.displayType === 'pivot_table' && this.pivotTableRef) {
      this.pivotTableRef.copyToClipboard()
    }
  }

  getBase64Data = () => {
    if (this.chartRef && isChartType(this.state.displayType)) {
      return this.chartRef.getBase64Data().then((data) => {
        const trimmedData = data.split(',')[1]
        return Promise.resolve(trimmedData)
      })
    } else if (this.tableRef && this.state.displayType === 'table') {
      const data = this.tableRef.getBase64Data()
      return Promise.resolve(data)
    } else if (this.pivotTableRef && this.state.displayType === 'pivot_table') {
      const data = this.pivotTableRef.getBase64Data()
      return Promise.resolve(data)
    }

    return undefined
  }

  saveTableAsCSV = () => {
    if (this.state.displayType === 'table' && this.tableRef) {
      this.tableRef.saveAsCSV()
    } else if (this.state.displayType === 'pivot_table' && this.pivotTableRef) {
      this.pivotTableRef.saveAsCSV()
    }
  }

  saveChartAsPNG = () => {
    if (this.chartRef) {
      this.chartRef.saveAsPNG()
    }
  }

  processCellClick = (cell) => {
    if (this.state.isContextMenuOpen) {
      this.setState({ isContextMenuOpen: false })
    } else {
      const drilldownData = { supportedByAPI: true, data: undefined }
      if (this.pivotTableColumns && this.state.displayType === 'pivot_table') {
        drilldownData.data = getGroupBysFromPivotTable(
          cell,
          this.tableColumns,
          this.pivotTableColumns,
          this.pivotOriginalColumnData
        )
      } else {
        drilldownData.data = getGroupBysFromTable(cell, this.tableColumns)
      }

      this.props.onDataClick(drilldownData, this.queryID)
    }
  }

  onChartClick = ({ activeKey, drilldownData, row, column, cellIndex }) => {
    this.props.onDataClick(drilldownData, this.queryID, activeKey)
  }

  onTableFilter = async (filters) => {
    if (
      this.state.displayType === 'table' &&
      _get(this.tableRef, 'ref.table')
    ) {
      this.headerFilters = filters
      setTimeout(() => {
        const tableRef = _get(this.tableRef, 'ref.table')
        if (tableRef) {
          const newTableData = tableRef.getData('active')
          // todo: Eventually we will want to update the pivot data too
          // if (this.supportsPivot) {
          //   this.generatePivotData({ newTableData })
          // }
          this.shouldGenerateChartData() && this.generateChartData(newTableData)
          this.props.onTableFilterCallback(this.tableData)
        }
      }, 500)
    } else if (
      this.state.displayType === 'pivot_table' &&
      _get(this.pivotTableRef, 'ref.table')
    ) {
      this.pivotHeaderFilters = filters
      setTimeout(() => {
        const pivotTableRef = _get(this.pivotTableRef, 'ref.table')
        if (pivotTableRef) {
          const newTableData = pivotTableRef.getData('active')
          this.props.onTableFilterCallback(newTableData)
        }
      }, 500)
    }
  }

  onLegendClick = (d) => {
    if (this.state.displayType === 'pie') {
      this.onPieChartLegendClick(d)
    } else {
      const newChartData = this.chartData.map((data) => {
        const newCells = data.cells.map((cell) => {
          if (cell.label === d) {
            return {
              ...cell,
              hidden: !cell.hidden,
            }
          }
          return cell
        })

        return {
          ...data,
          cells: newCells,
        }
      })

      let newColumns = []
      newColumns = this.chartTableColumns.map((col) => {
        if (col.title === d) {
          return {
            ...col,
            isSeriesHidden: !col.isSeriesHidden,
          }
        }
        return col
      })

      this.chartTableColumns = newColumns
      this.chartData = newChartData
    }

    this.forceUpdate()
  }

  onPieChartLegendClick = (d) => {
    const newChartData = this.chartData.map((data) => {
      if (data.label === d.label) {
        return {
          ...data,
          hidden: !_get(data, 'hidden', false),
        }
      }
      return data
    })

    this.chartData = newChartData
  }

  areAllColumnsHidden = () => {
    try {
      const allColumnsHidden = this.tableColumns.every((col) => !col.visible)

      return allColumnsHidden
    } catch (error) {
      return false
    }
  }

  onChangeStringColumnIndex = (index) => {
    if (this.dataConfig.legendColumnIndex === index) {
      this.dataConfig.legendColumnIndex = undefined
    }
    this.dataConfig.stringColumnIndex = index

    if (this.supportsPivot) {
      this.generatePivotTableData()
    }
    this.generateChartData()
    this.forceUpdate()
  }

  onChangeLegendColumnIndex = (index) => {
    if (this.dataConfig.stringColumnIndex === index) {
      this.dataConfig.stringColumnIndex = undefined
    }
    this.dataConfig.legendColumnIndex = index

    if (this.supportsPivot) {
      this.generatePivotTableData()
    }
    this.generateChartData()
    this.forceUpdate()
  }

  onChangeNumberColumnIndices = (indices) => {
    if (this.supportsPivot && this.pivotTableColumns) {
      // Add "hidden" attribute to pivot table columns for charts
      this.pivotTableColumns = this.pivotTableColumns.map((column, i) => {
        return {
          ...column,
          numberColHidden: !indices.includes(i),
        }
      })
    }

    if (indices) {
      this.dataConfig.numberColumnIndices = indices
      this.dataConfig.numberColumnIndex = indices[0]
      this.generateChartData()
      this.forceUpdate()
    }
  }

  setColumnIndices = (chartTableColumns) => {
    const columns = chartTableColumns || this.chartTableColumns
    if (!columns) {
      return
    }

    if (!this.dataConfig) {
      this.dataConfig = {}
    }

    // Set string type columns (ordinal axis)
    if (!this.dataConfig.stringColumnIndices) {
      const { stringColumnIndices } = getStringColumnIndices(
        columns,
        this.supportsPivot
      )
      this.dataConfig.stringColumnIndices = stringColumnIndices
    }
    if (!(this.dataConfig.stringColumnIndex >= 0)) {
      const { stringColumnIndex } = getStringColumnIndices(
        columns,
        this.supportsPivot
      )
      this.dataConfig.stringColumnIndex = stringColumnIndex
    }

    // Set number type columns and number series columns (linear axis)
    if (!this.dataConfig.numberColumnIndices) {
      const { numberColumnIndex, numberColumnIndices } = getNumberColumnIndices(
        columns
      )

      this.dataConfig.numberColumnIndices = numberColumnIndices
      this.dataConfig.numberColumnIndex = numberColumnIndex
    } else {
      this.dataConfig.numberColumnIndex = this.dataConfig.numberColumnIndices[0]
    }
  }

  setSupportedDisplayTypes = (supportedDisplayTypes, justMounted) => {
    if (
      supportedDisplayTypes &&
      (justMounted ||
        !_isEqual(supportedDisplayTypes, this.supportedDisplayTypes))
    ) {
      this.supportedDisplayTypes = supportedDisplayTypes
      this.props.onSupportedDisplayTypesChange(this.supportedDisplayTypes)

      if (!this.supportedDisplayTypes.includes(this.state.displayType)) {
        this.setState({
          displayType: getDefaultDisplayType(
            this.props.queryResponse,
            this.props.autoChartAggregations
          ),
        })
      }
    }
  }

  getTooltipDataForCell = (row, columnIndex, numberValue) => {
    let tooltipElement = null
    try {
      if (this.supportsPivot) {
        const stringColumn = this.tableColumns[
          this.dataConfig.stringColumnIndex
        ]
        const numberColumn = this.tableColumns[
          this.dataConfig.numberColumnIndex
        ]

        tooltipElement = `<div>
            <div>
              <strong>${
                this.pivotTableColumns[0].title
              }:</strong> ${formatElement({
          element: row[0],
          column: this.pivotTableColumns[0],
          config: getDataFormatting(this.props.dataFormatting),
        })}
            </div>
            <div><strong>${
              this.tableColumns[this.dataConfig.legendColumnIndex].title
            }:</strong> ${this.pivotTableColumns[columnIndex].title}
            </div>
            <div>
            <div><strong>${numberColumn.title}:</strong> ${formatElement({
          element: row[columnIndex] || 0,
          column: numberColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })}
            </div>
          </div>`
      } else {
        const stringColumn = this.chartTableColumns[
          this.dataConfig.stringColumnIndex
        ]
        const numberColumn = this.chartTableColumns[columnIndex]

        tooltipElement = `<div>
            <div>
              <strong>${stringColumn.title}:</strong> ${formatElement({
          element: row[this.dataConfig.stringColumnIndex],
          column: stringColumn,
          config: getDataFormatting(this.props.dataFormatting),
        })}
            </div>
            <div>
            <div><strong>${numberColumn.title}:</strong> ${formatElement({
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

    if (this.supportsPivot) {
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
              `[${this.dataConfig.legendColumnIndex}].name`
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
              this.chartTableColumns,
              `[${this.dataConfig.stringColumnIndex}].name`
            ),
            value: `${_get(row, `[${this.dataConfig.stringColumnIndex}]`)}`,
          },
        ],
      }
    }
  }

  isStringColumnDateType = () => {
    const stringColumn = this.tableColumns[this.dataConfig.stringColumnIndex]
    return isColumnDateType(stringColumn)
  }

  getMultiSeriesData = (columns, tableData) => {
    const { stringColumnIndex } = getStringColumnIndices(
      columns,
      this.supportsPivot
    )
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
    this.chartTableColumns.forEach((col, index) => {
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
        const cells = makeEmptyArray(this.chartTableColumns.length, 1, 0)
        cells[0] = categoryå
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

  getMultiSeriesColumns = (columns) => {
    const multiSeriesIndex = getMultiSeriesColumnIndex(columns)
    const { numberColumnIndex } = getNumberColumnIndices(columns)
    const { stringColumnIndex } = getStringColumnIndices(
      columns,
      this.supportsPivot
    )

    const allCategories = this.tableData.map((d) => {
      return formatElement({
        element: d[multiSeriesIndex],
        column: columns[multiSeriesIndex],
        config: this.props.dataFormatting,
      })
    })

    const uniqueCategories = [...allCategories].filter(onlyUnique).sort()
    const newNumberColumns = []
    uniqueCategories.forEach((category) => {
      newNumberColumns.push({
        ...columns[numberColumnIndex],
        title: category,
        seriesCategory: category,
      })
    })

    return [columns[stringColumnIndex], ...newNumberColumns]
  }

  getChartTableData = (newTableData) => {
    let tableData = _cloneDeep(newTableData) || _cloneDeep(this.tableData)

    if (shouldPlotMultiSeries(this.tableColumns)) {
      return this.getMultiSeriesData(this.tableColumns, tableData)
    }

    if (supportsRegularPivotTable(this.tableColumns)) {
      tableData = _cloneDeep(this.pivotTableData)
    }

    return tableData
  }

  getChartTableColumns = () => {
    if (shouldPlotMultiSeries(this.tableColumns)) {
      return this.getMultiSeriesColumns(this.tableColumns)
    }

    if (supportsRegularPivotTable(this.tableColumns)) {
      return _cloneDeep(this.pivotTableColumns)
    }

    return _cloneDeep(this.tableColumns)
  }

  generateChartData = (newTableData) => {
    try {
      // Get columns for chart then reset indexes if necessary
      const columns = this.getChartTableColumns()
      this.chartTableColumns = columns

      // Get table data for chart after columns
      const tableData = this.getChartTableData(newTableData)
      this.chartTableData = tableData

      if (!this.dataConfig || shouldPlotMultiSeries(this.tableColumns)) {
        this.setColumnIndices()
      }

      let stringIndex = this.dataConfig.stringColumnIndex

      if (this.supportsPivot) {
        stringIndex = 0
        const newNumberColumnIndices = []
        this.pivotTableColumns.forEach((col, i) => {
          if (!col.numberColHidden && i !== stringIndex) {
            newNumberColumnIndices.push(i)
          }
        })

        this.dataConfig.numberColumnIndices = newNumberColumnIndices
      }

      if (this.isStringColumnDateType()) {
        tableData.reverse()
      }

      this.chartData = Object.values(
        tableData.reduce((chartDataObject, row, rowIndex) => {
          // Loop through columns and create a series for each
          const cells = []

          this.dataConfig.numberColumnIndices.forEach((columnIndex, i) => {
            const value = row[columnIndex]
            const colorScaleValue = this.supportsPivot ? columnIndex : i
            const drilldownData = this.getDrilldownDataForCell(row, columnIndex)
            const tooltipData = this.getTooltipDataForCell(
              row,
              columnIndex,
              value
            )

            cells.push({
              value: !Number.isNaN(Number(value)) ? Number(value) : value, // this should always be able to convert to a number
              label: columns[columnIndex].title,
              color: this.colorScale(colorScaleValue),
              hidden: false,
              drilldownData,
              tooltipData,
            })
          })

          // Make sure the row label doesn't exist already
          if (!chartDataObject[row[stringIndex]]) {
            chartDataObject[row[stringIndex]] = {
              origRow: row,
              label: row[stringIndex],
              cells,
              formatter: (value, column) => {
                return formatElement({
                  element: value,
                  column,
                  config: getDataFormatting(this.props.dataFormatting),
                })
              },
            }
          } else {
            // If this label already exists, just add the values together
            // The BE should prevent this from happening though
            chartDataObject[row[stringIndex]].cells = chartDataObject[
              row[stringIndex]
            ].cells.map((cell, index) => {
              const newValue = cell.value + Number(cells[index].value)
              return {
                ...cell,
                value: newValue,
                tooltipData: this.getTooltipDataForCell(
                  row,
                  this.dataConfig.numberColumnIndices[index],
                  newValue
                ),
              }
            })
          }
          return chartDataObject
        }, {})
      )

      // Update supported display types after table data has been recalculated
      // there may be too many categories for a pie chart etc.
      this.setSupportedDisplayTypes(
        getSupportedDisplayTypes(this.props.queryResponse, this.chartData)
      )

      this.chartDataError = false
    } catch (error) {
      if (!this.chartDataError) {
        // Try one more time after resetting data config settings
        console.warn(
          'An error was thrown while generating the chart data. Resetting the data config and trying again.'
        )
        this.chartDataError = true
        this.dataConfig = undefined
        this.setColumnIndices()
        this.generateChartData()
      } else {
        // Something went wrong a second time. Do not show chart options
        this.setSupportedDisplayTypes(['table'])
        this.chartData = undefined
        console.error(error)
      }
    }
  }

  setFilterFunction = (col) => {
    const self = this
    if (col.type === 'DATE' || col.type === 'DATE_STRING') {
      return (headerValue, rowValue, rowData, filterParams) => {
        // headerValue - the value of the header filter element
        // rowValue - the value of the column in this row
        // rowData - the data for the row being filtered
        // filterParams - params object passed to the headerFilterFuncParams property

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
        // headerValue - the value of the header filter element
        // rowValue - the value of the column in this row
        // rowData - the data for the row being filtered
        // filterParams - params object passed to the headerFilterFuncParams property

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
      return (a, b) => this.dateSortFn(a, b)
    } else if (col.type === 'STRING') {
      // There is some bug in tabulator where its not sorting
      // certain columns. This explicitly sets the sorter so
      // it works every time
      return 'string'
    }

    return undefined
  }

  formatColumnsForTable = (columns) => {
    if (!columns) {
      return null
    }
    const formattedColumns = columns.map((col, i) => {
      // Regardless of the BE response, we want to default to percent
      if (
        (col.type === 'RATIO' || col.type === 'NUMBER') &&
        _get(
          getDataFormatting(this.props.dataFormatting),
          'comparisonDisplay'
        ) === 'PERCENT'
      ) {
        col.type = 'PERCENT'
      }

      col.field = `${i}`
      col.title = col.display_name
      col.id = uuid.v4()
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

      if (!this.dataConfig) {
        // We should change this to getColumnIndices since this wont be
        // the final version that we use. We dont want to persist it
        this.setColumnIndices(this.tableColumns)
      }

      const dateColumnIndex = getDateColumnIndex(this.tableColumns)
      if (!(this.dataConfig.numberColumnIndex >= 0)) {
        this.dataConfig.numberColumnIndex = this.tableColumns.findIndex(
          (col, index) => index !== dateColumnIndex && isColumnNumberType(col)
        )
      }

      const tableData =
        newTableData || _get(this.props.queryResponse, 'data.data.rows')

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
          // sorter: 'date',
          frozen: true,
          visible: true,
        },
      ]

      Object.keys(uniqueYears).forEach((year, i) => {
        pivotTableColumns.push({
          ...this.tableColumns[this.dataConfig.numberColumnIndex],
          origColumn: this.tableColumns[this.dataConfig.numberColumnIndex],
          drilldownData: [
            {
              name: this.tableColumns[dateColumnIndex].name,
              value: null,
            },
          ],
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
          pivotTableData[monthNumber][yearNumber] =
            row[this.dataConfig.numberColumnIndex]
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
    } catch (error) {
      console.error(error)
      this.supportedDisplayTypes.filter(
        (displayType) => displayType !== 'pivot_table'
      )
      this.setState({ displayType: 'table' })
    }
  }

  getColumnFromIndexString = (colIndexString) => {
    return _get(
      this.tableColumns,
      `[${_get(this.dataConfig, `[${colIndexString}]`)}]`
    )
  }

  generatePivotTableData = ({ isFirstGeneration, newTableData } = {}) => {
    try {
      const tableData =
        newTableData || _get(this.props.queryResponse, 'data.data.rows')

      if (!this.dataConfig) {
        // We should change this to getColumnIndices since this wont be
        // the final version that we use. We dont want to persist it
        this.setColumnIndices(this.tableColumns)
      }

      // Set the columns used for the 2 headers (ordinal and legend for charts)
      // If one of the indices is already specified, use it
      let dataConfigWasPersisted = false
      if (_get(this.dataConfig, 'legendColumnIndex') >= 0) {
        dataConfigWasPersisted = true
        this.dataConfig.stringColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.legendColumnIndex
        )
      } else if (_get(this.dataConfig, 'stringColumnIndex') >= 0) {
        this.dataConfig.legendColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.stringColumnIndex
        )
      } else {
        this.dataConfig.stringColumnIndex = this.tableColumns.findIndex(
          (col) => col.groupable
        )
        this.dataConfig.legendColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.stringColumnIndex
        )
      }

      // Set the number type column
      if (!(_get(this.dataConfig, 'numberColumnIndex') >= 0)) {
        this.dataConfig.numberColumnIndex = this.tableColumns.findIndex(
          (col, index) => isColumnNumberType(col) && !col.groupable
        )
      }

      let uniqueValues0 = this.sortTableDataByDate(tableData)
        .map((d) => d[this.dataConfig.stringColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let uniqueValues1 = this.sortTableDataByDate(tableData)
        .map((d) => d[this.dataConfig.legendColumnIndex])
        .filter(onlyUnique)
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      // Make sure the longer list is in the legend, UNLESS its a date type
      // DATE types should always go in the axis if possible
      if (
        isFirstGeneration &&
        Object.keys(uniqueValues1).length > Object.keys(uniqueValues0).length &&
        !dataConfigWasPersisted &&
        !isColumnDateType(this.getColumnFromIndexString('stringColumnIndex'))
      ) {
        const tempCol = this.dataConfig.legendColumnIndex
        this.dataConfig.legendColumnIndex = this.dataConfig.stringColumnIndex
        this.dataConfig.stringColumnIndex = tempCol

        const tempValues = { ...uniqueValues0 }
        uniqueValues0 = { ...uniqueValues1 }
        uniqueValues1 = { ...tempValues }
      }

      // if (Object.keys(uniqueValues1).length > 50) {
      //   this.supportedDisplayTypes = this.supportedDisplayTypes.filter(
      //     displayType => displayType !== "pivot_table"
      //   );
      //   this.setState({ displayType: "table" });
      //   return null;
      // }

      // Generate new column array
      const pivotTableColumns = [
        {
          ...this.tableColumns[this.dataConfig.stringColumnIndex],
          frozen: true,
          headerContext: undefined,
          visible: true,
          field: '0',
        },
      ]

      Object.keys(uniqueValues1).forEach((columnName, i) => {
        const formattedColumnName = formatElement({
          element: columnName,
          column: this.tableColumns[this.dataConfig.legendColumnIndex],
          config: getDataFormatting(this.props.dataFormatting),
        })
        pivotTableColumns.push({
          ...this.tableColumns[this.dataConfig.numberColumnIndex],
          origColumn: this.tableColumns[this.dataConfig.numberColumnIndex],
          drilldownData: [
            {
              name: this.tableColumns[this.dataConfig.stringColumnIndex].name,
              value: null,
            },
            {
              name: this.tableColumns[this.dataConfig.legendColumnIndex].name,
              value: columnName,
            },
          ],
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
        pivotTableData[
          uniqueValues0[row[this.dataConfig.stringColumnIndex]]
        ][0] = row[this.dataConfig.stringColumnIndex]

        // Populate remaining columns
        pivotTableData[uniqueValues0[row[this.dataConfig.stringColumnIndex]]][
          uniqueValues1[row[this.dataConfig.legendColumnIndex]] + 1
        ] = row[this.dataConfig.numberColumnIndex]
      })

      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = _get(this.pivotTableData, 'length', 0)
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
                  <a onClick={this.props.reportProblemCallback}>report</a>
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
    if (this.areAllColumnsHidden()) {
      return (
        <div className="no-columns-error-message">
          <div>
            <Icon className="warning-icon" type="warning-triangle" />
            <br /> All columns in this table are currently hidden. You can
            adjust your column visibility preferences using the Column
            Visibility Manager (
            <Icon className="eye-icon" type="eye" />) in the Options Toolbar.
          </div>
        </div>
      )
    }

    return null
  }

  renderTable = () => {
    if (
      !this.tableData ||
      (this.state.displayType === 'pivot_table' && !this.pivotTableData)
    ) {
      return 'Error: There was no data supplied for this table'
    }

    if (this.tableData.length === 1 && this.tableData[0].length === 1) {
      // This is a single cell of data
      return this.renderSingleValueResponse()
    }

    if (this.state.displayType === 'pivot_table') {
      return (
        <ChataTable
          themeConfig={getThemeConfig(this.props.themeConfig)}
          key={this.pivotTableID}
          ref={(ref) => (this.pivotTableRef = ref)}
          columns={this.pivotTableColumns}
          data={this.pivotTableData}
          onCellClick={this.processCellClick}
          headerFilters={this.pivotHeaderFilters}
          onFilterCallback={this.onTableFilter}
          setFilterTagsCallback={this.props.setFilterTagsCallback}
          enableColumnHeaderContextMenu={
            this.props.enableColumnHeaderContextMenu
          }
        />
      )
    }

    return (
      <Fragment>
        {this.renderAllColumnsHiddenMessage()}
        <ChataTable
          themeConfig={getThemeConfig(this.props.themeConfig)}
          key={this.tableID}
          ref={(ref) => (this.tableRef = ref)}
          columns={this.tableColumns}
          data={this.tableData}
          onCellClick={this.processCellClick}
          headerFilters={this.headerFilters}
          onFilterCallback={this.onTableFilter}
          setFilterTagsCallback={this.props.setFilterTagsCallback}
          // We don't want to skip rendering it because we need to
          // access the table ref for showing the columns if the
          // col visibility is changed
          style={{
            visibility: this.areAllColumnsHidden() ? 'hidden' : 'visible',
          }}
        />
      </Fragment>
    )
  }

  renderChart = (width, height, displayType) => {
    if (!this.chartData) {
      return 'Error: There was no data supplied for this chart'
    }

    return (
      <ErrorBoundary>
        <ChataChart
          themeConfig={getThemeConfig(this.props.themeConfig)}
          ref={(ref) => (this.chartRef = ref)}
          type={displayType || this.state.displayType}
          data={this.chartData}
          tableColumns={this.tableColumns}
          columns={this.chartTableColumns}
          height={height}
          width={width}
          dataFormatting={getDataFormatting(this.props.dataFormatting)}
          backgroundColor={this.props.backgroundColor}
          activeChartElementKey={this.props.activeChartElementKey}
          onLegendClick={this.onLegendClick}
          dataConfig={_cloneDeep(this.dataConfig)}
          themeConfig={getThemeConfig(this.props.themeConfig)}
          changeStringColumnIndex={this.onChangeStringColumnIndex}
          changeLegendColumnIndex={this.onChangeLegendColumnIndex}
          changeNumberColumnIndices={this.onChangeNumberColumnIndices}
          onChartClick={this.onChartClick}
          isResizing={this.props.isResizing}
          enableDynamicCharting={this.props.enableDynamicCharting}
        />
      </ErrorBoundary>
    )
  }

  renderHelpResponse = () => {
    const url = _get(this.props.queryResponse, 'data.data.rows[0]')
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
      console.warn('Warning: No response data supplied')
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

  renderResponse = (width, height) => {
    const { displayType } = this.state
    const { queryResponse } = this.props
    const data = _get(queryResponse, 'data.data.rows')

    if (this.hasError(queryResponse)) {
      return this.renderError(queryResponse)
    }

    // This is used for "Thank you for your feedback" response
    // when user clicks on "None of these" in the suggestion list
    if (this.state.customResponse) {
      return this.state.customResponse
    }

    // If "items" are returned in response it is a list of suggestions
    const isSuggestionList = !!_get(queryResponse, 'data.data.items')
    if (isSuggestionList) {
      return this.renderSuggestionMessage(
        queryResponse.data.data.items,
        queryResponse.data.data.query_id
      )
    }

    // Query validation was triggered, display query validation message
    if (_get(queryResponse, 'data.data.replacements')) {
      return (
        <QueryValidationMessage
          themeConfig={getThemeConfig(this.props.themeConfig)}
          key={this.SAFETYNET_KEY}
          response={this.props.queryResponse}
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
    if (!_get(data, 'length')) {
      return this.replaceErrorTextWithLinks(queryResponse.data.message)
    }

    if (displayType && data) {
      if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (isTableType(displayType)) {
        return this.renderTable()
      } else if (isChartType(displayType)) {
        return this.renderChart(width, height)
      }
      return this.renderMessage(
        `display type not recognized: ${this.state.displayType}`
      )
    }
    return null
  }

  renderContextMenuContent = ({
    position,
    nudgedLeft,
    nudgedTop,
    targetRect,
    popoverRect,
  }) => {
    return (
      <div className="context-menu">
        <ul className="context-menu-list">
          <li
            onClick={() => {
              this.setState({ isContextMenuOpen: false })
              this.props.hideColumnCallback(this.state.activeColumn)
            }}
          >
            Hide Column
          </li>
        </ul>
      </div>
    )
  }

  renderContextMenu = () => {
    return (
      <Popover
        isOpen={this.state.isContextMenuOpen}
        position="bottom" // if you'd like, supply an array of preferred positions ordered by priority
        padding={10} // adjust padding here!
        onClickOutside={() => this.setState({ isContextMenuOpen: false })}
        contentLocation={this.state.contextMenuPosition}
        content={(props) => this.renderContextMenuContent(props)}
      >
        <div />
      </Popover>
    )
  }

  render = () => {
    const responseContainer = document.getElementById(
      `react-autoql-response-content-container-${this.COMPONENT_KEY}`
    )

    let height = 0
    let width = 0

    if (responseContainer) {
      height =
        responseContainer.clientHeight -
        getPadding(responseContainer).top -
        getPadding(responseContainer).bottom
      width =
        responseContainer.clientWidth -
        getPadding(responseContainer).left -
        getPadding(responseContainer).right
    }

    if (this.props.height) {
      height = this.props.height
    }

    if (this.props.width) {
      width = this.props.width
    }

    return (
      <ErrorBoundary>
        <div
          key={this.COMPONENT_KEY}
          id={`react-autoql-response-content-container-${this.COMPONENT_KEY}`}
          data-test="query-response-wrapper"
          className={`react-autoql-response-content-container ${
            isTableType(this.state.displayType) ? 'table' : ''
          }`}
        >
          {this.renderResponse(width, height)}
        </div>
        {this.renderContextMenu()}
      </ErrorBoundary>
    )
  }
}
