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
} from '../../props/defaults'
import { LIGHT_THEME, DARK_THEME } from '../../js/Themes'
import dayjs from '../../js/dayjsWithPlugins'

import { ChataTable } from '../ChataTable'
import { ChataChart } from '../Charts/ChataChart'
import { QueryInput } from '../QueryInput'
import { SafetyNetMessage } from '../SafetyNetMessage'
import { Icon } from '../Icon'
// import { ChataForecast } from '../ChataForecast'

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
  isForecastType,
  setStyleVars,
  getQueryParams,
  supportsRegularPivotTable,
  supports2DCharts,
  isColumnNumberType,
  isColumnStringType,
  getNumberColumnIndices,
  getNumberOfGroupables,
  getPadding,
} from '../../js/Util.js'

import './QueryOutput.scss'
import { MONTH_NAMES } from '../../js/Constants'

String.prototype.isUpperCase = function() {
  return this.valueOf().toUpperCase() === this.valueOf()
}

String.prototype.toProperCase = function() {
  return this.replace(/\w\S*/g, txt => {
    if (txt.isUpperCase()) {
      return txt
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}

export default class QueryOutput extends React.Component {
  supportedDisplayTypes = []
  dataConfig = {}
  SAFETYNET_KEY = uuid.v4()

  static propTypes = {
    queryResponse: shape({}).isRequired,
    queryInputRef: instanceOf(QueryInput),
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
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    autoQLConfig: autoQLConfigDefault,
    authentication: authenticationDefault,
    dataFormatting: dataFormattingDefault,
    dataConfig: {
      numberColumnIndex: undefined,
      numberColumnIndices: undefined,
      stringColumnIndex: undefined,
      stringColumnIndices: undefined,
      legendColumnIndex: undefined,
      seriesIndices: undefined,
    },
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
    onDataClick: () => {},
    onQueryValidationSelectOption: () => {},
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
      this.dataConfig = _cloneDeep(this.props.dataConfig)

      const { theme, chartColors } = this.props.themeConfig
      this.COMPONENT_KEY = uuid.v4()
      this.colorScale = scaleOrdinal().range(chartColors)
      this.themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
      setStyleVars({
        themeStyles: this.themeStyles,
        prefix: '--chata-output-',
      })

      // Determine the supported visualization types based on the response data
      this.supportedDisplayTypes = getSupportedDisplayTypes(
        this.props.queryResponse
      )

      // Set the initial display type based on prop value, response, and supported display types
      this.setState({
        displayType: isDisplayTypeValid(
          this.props.queryResponse,
          this.props.displayType
        )
          ? this.props.displayType
          : getDefaultDisplayType(this.props.queryResponse),
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
    if (!_isEqual(this.props.dataConfig, this.dataConfig)) {
      this.props.onDataConfigChange(this.dataConfig)
    }

    // If columns changed, we need to reset the column data config
    if (!_isEqual(this.props.columns, prevProps.columns)) {
      this.props.onDataConfigChange({})
    }

    if (
      _get(prevProps, 'themeConfig.theme') !==
      _get(this.props, 'themeConfig.theme')
    ) {
      const { theme } = this.props.themeConfig
      this.themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
      setStyleVars({
        themeStyles: this.themeStyles,
        prefix: '--chata-output-',
      })
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
  }

  componentWillUnmount = () => {
    ReactTooltip.hide()
  }

  updateColumns = columns => {
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
      } else if (isForecastType(displayType)) {
        this.generateForecastData()
      }
    }
  }

  shouldGeneratePivotData = () => {
    return this.tableData && this.supportedDisplayTypes.includes('pivot_table')
  }

  shouldGenerateChartData = () => {
    return this.supportedDisplayTypes.length > 1
  }

  generateForecastData = () => {
    // This is temporary until we create the forecast vis
    this.generateTableData()
    this.shouldGenerateChartData() && this.generateChartData()
  }

  generateTableData = () => {
    this.tableColumns = this.formatColumnsForTable(
      this.props.queryResponse.data.data.columns
    )

    const data = _get(this.props.queryResponse, 'data.data.rows')
    this.tableData = data ? [...data] : undefined

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

  createSuggestionMessage = (userInput, suggestions) => {
    let suggestionListMessage
    try {
      suggestionListMessage = (
        <div className="chata-suggestion-message">
          <div className="chata-suggestions-container">
            {this.props.renderSuggestionsAsDropdown ? (
              <select
                key={uuid.v4()}
                onChange={e => {
                  this.setState({ suggestionSelection: e.target.value })
                  this.onSuggestionClick(
                    e.target.value,
                    undefined,
                    undefined,
                    'suggestion'
                  )
                }}
                value={this.state.suggestionSelection}
                className="chata-suggestions-select"
              >
                <option key={uuid.v4()} value={userInput}>
                  {userInput}
                </option>
                {suggestions.map((suggestion, i) => {
                  return (
                    <option key={uuid.v4()} value={suggestion}>
                      {suggestion}
                    </option>
                  )
                })}
              </select>
            ) : (
              suggestions.map(suggestion => {
                return (
                  <div key={uuid.v4()}>
                    <button
                      onClick={() =>
                        this.onSuggestionClick(
                          suggestion,
                          true,
                          undefined,
                          'suggestion'
                        )
                      }
                      className="chata-suggestion-btn"
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
        <div className="chata-suggestion-message">
          Sorry something went wrong, I have no suggestions for you.
        </div>
      )
    }

    return suggestionListMessage
  }

  renderSuggestionMessage = suggestions => {
    const { queryResponse } = this.props

    const queryParams = getQueryParams(_get(queryResponse, 'config.url'))
    if (suggestions.length && queryParams) {
      const originalQuery = queryParams.search
      return this.createSuggestionMessage(originalQuery, suggestions)
    } else {
      return this.createSuggestionMessage()
    }
  }

  renderSingleValueResponse = () => {
    return (
      <a
        className={`single-value-response ${
          this.props.autoQLConfig.enableDrilldowns ? ' with-drilldown' : ''
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
          config: this.props.dataFormatting,
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

  renderForecastVis = () => {
    return this.renderTable()
    // return <ChataForecast />
  }

  processCellClick = cell => {
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

  onTableFilter = async filters => {
    if (
      this.state.displayType === 'table' &&
      _get(this.tableRef, 'ref.table')
    ) {
      this.headerFilters = filters
      setTimeout(() => {
        const tableRef = _get(this.tableRef, 'ref.table')
        if (tableRef) {
          const newTableData = tableRef.getData(true)
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
          const newTableData = pivotTableRef.getData(true)
          this.props.onTableFilterCallback(newTableData)
        }
      }, 500)
    }
  }

  onLegendClick = d => {
    if (this.state.displayType === 'pie') {
      this.onPieChartLegendClick(d)
    } else {
      const newChartData = this.chartData.map(data => {
        const newCells = data.cells.map(cell => {
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
      if (this.supportsPivot) {
        newColumns = this.pivotTableColumns.map(col => {
          if (col.title === d) {
            return {
              ...col,
              isSeriesHidden: !col.isSeriesHidden,
            }
          }
          return col
        })
        this.pivotTableColumns = newColumns
      } else {
        newColumns = this.tableColumns.map(col => {
          if (col.title === d) {
            return {
              ...col,
              isSeriesHidden: !col.isSeriesHidden,
            }
          }
          return col
        })
        this.tableColumns = newColumns
      }

      this.chartData = newChartData
    }

    this.forceUpdate()
  }

  onPieChartLegendClick = d => {
    const newChartData = this.chartData.map(data => {
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
      const allColumnsHidden = this.tableColumns.every(col => !col.visible)

      return allColumnsHidden
    } catch (error) {
      return false
    }
  }

  renderAllColumnsHiddenMessage = () => {
    if (this.areAllColumnsHidden()) {
      return (
        <div className="no-columns-error-message">
          {this.renderErrorMessage(
            <div>
              <Icon className="warning-icon" type="warning-triangle" />
              <br /> All columns in this table are currently hidden. You can
              adjust your column visibility preferences using the Column
              Visibility Manager (
              <Icon className="eye-icon" type="eye" />) in the Options Toolbar.
            </div>
          )}
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

    const tableBorderColor =
      this.props.themeConfig.theme === 'light'
        ? LIGHT_THEME['--chata-messenger-border-color']
        : DARK_THEME['--chata-messenger-border-color']

    const tableHoverColor =
      this.props.themeConfig.theme === 'light'
        ? LIGHT_THEME['--chata-messenger-hover-color']
        : DARK_THEME['--chata-messenger-hover-color']

    if (this.state.displayType === 'pivot_table') {
      return (
        <ChataTable
          key={this.pivotTableID}
          ref={ref => (this.pivotTableRef = ref)}
          columns={this.pivotTableColumns}
          data={this.pivotTableData}
          borderColor={tableBorderColor}
          hoverColor={tableHoverColor}
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
          key={this.tableID}
          ref={ref => (this.tableRef = ref)}
          columns={this.tableColumns}
          data={this.tableData}
          borderColor={tableBorderColor}
          hoverColor={tableHoverColor}
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

    const chartThemeConfig = {
      ...this.props.themeConfig,
      ...this.themeStyles,
    }

    return (
      <ErrorBoundary>
        <ChataChart
          ref={ref => (this.chartRef = ref)}
          type={displayType || this.state.displayType}
          data={this.chartData}
          tableColumns={this.tableColumns}
          columns={
            this.supportsPivot ? this.pivotTableColumns : this.tableColumns
          }
          height={height}
          width={width}
          dataFormatting={this.props.dataFormatting}
          chartColors={this.props.themeConfig.chartColors}
          backgroundColor={this.props.backgroundColor}
          activeChartElementKey={this.props.activeChartElementKey}
          onLegendClick={this.onLegendClick}
          stringColumnIndices={this.dataConfig.stringColumnIndices}
          numberColumnIndices={this.dataConfig.numberColumnIndices}
          seriesIndices={this.dataConfig.seriesIndices}
          stringColumnIndex={this.dataConfig.stringColumnIndex}
          legendColumnIndex={this.dataConfig.legendColumnIndex}
          numberColumnIndex={this.dataConfig.numberColumnIndex}
          themeConfig={chartThemeConfig}
          // valueFormatter={formatElement}
          // onChartClick={(row, columns) => {
          //   if (!this.props.isDrilldownDisabled) {
          //     this.props.processDrilldown(row, columns, this.queryID)
          //   }
          // }}
          changeStringColumnIndex={index => {
            if (this.dataConfig.legendColumnIndex === index) {
              this.dataConfig.legendColumnIndex = undefined
            }
            this.dataConfig.stringColumnIndex = index

            if (this.supportsPivot) {
              this.generatePivotTableData()
            }
            this.generateChartData()
            this.forceUpdate()
          }}
          changeLegendColumnIndex={index => {
            if (this.dataConfig.stringColumnIndex === index) {
              this.dataConfig.stringColumnIndex = undefined
            }
            this.dataConfig.legendColumnIndex = index

            if (this.supportsPivot) {
              this.generatePivotTableData()
            }
            this.generateChartData()
            this.forceUpdate()
          }}
          changeNumberColumnIndices={indices => {
            if (indices) {
              this.dataConfig.numberColumnIndices = indices
              this.dataConfig.numberColumnIndex = indices[0]
              this.generateChartData()
              this.forceUpdate()
            }
          }}
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
            className="chata-help-link-btn"
            target="_blank"
            onClick={() => window.open(url, '_blank')}
          >
            <Icon type="globe" className="chata-help-link-icon" />
            {linkText}
          </button>
        }
      </Fragment>
    )
  }

  setColumnIndices = () => {
    if (!this.tableColumns) {
      return
    }

    const allStringColumnIndices = []
    this.tableColumns.forEach((col, index) => {
      if (isColumnStringType(col) || col.groupable) {
        allStringColumnIndices.push(index)
      }
    })

    // We will usually want to take the second column because the first one
    // will most likely have all of the same value. Grab the first column only
    // if it's the only string column
    if (!this.dataConfig.stringColumnIndices) {
      this.dataConfig.stringColumnIndices = allStringColumnIndices
    }

    if (!(this.dataConfig.stringColumnIndex >= 0)) {
      this.dataConfig.stringColumnIndex = this.supportsPivot
        ? this.tableColumns.findIndex(col => col.groupable)
        : this.dataConfig.stringColumnIndices[1] ||
          this.dataConfig.stringColumnIndices[0]
    }

    if (!this.dataConfig.numberColumnIndices) {
      const columns = this.supportsPivot
        ? this.pivotTableColumns
        : this.tableColumns
      this.dataConfig.numberColumnIndices = getNumberColumnIndices(columns)
    }
    this.dataConfig.numberColumnIndex = this.dataConfig.numberColumnIndices[0]
  }

  getTooltipDataForCell = (row, columnIndex, numberValue) => {
    let tooltipElement = null
    try {
      const numberColumn = this.tableColumns[this.dataConfig.numberColumnIndex]
      const stringColumn = this.tableColumns[this.dataConfig.stringColumnIndex]

      if (this.supportsPivot) {
        tooltipElement = `<div>
            <div>
              <strong>${this.pivotTableColumns[0].display_name}:</strong> ${
          row[0]
        }
            </div>
            <div><strong>${
              this.tableColumns[this.dataConfig.legendColumnIndex].display_name
            }:</strong> ${this.pivotTableColumns[columnIndex].title}
            </div>
            <div>
            <div><strong>${numberColumn.display_name}:</strong> ${formatElement(
          {
            element: row[columnIndex] || 0,
            column: numberColumn,
            config: this.props.dataFormatting,
          }
        )}
            </div>
          </div>`
      } else {
        tooltipElement = `<div>
            <div>
              <strong>${stringColumn.display_name}:</strong> ${formatElement({
          element: row[this.dataConfig.stringColumnIndex],
          column: stringColumn,
          config: this.props.dataFormatting,
        })}
            </div>
            <div>
            <div><strong>${numberColumn.display_name}:</strong> ${formatElement(
          {
            element: numberValue || row[columnIndex] || 0,
            column: numberColumn,
            config: this.props.dataFormatting,
          }
        )}
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
            name: this.pivotTableColumns[0].name,
            value: `${row[0]}`,
          },
          {
            name: this.tableColumns[this.dataConfig.legendColumnIndex].name,
            value: `${this.pivotTableColumns[columnIndex].name}`,
          },
        ],
      }
    } else {
      return {
        supportedByAPI,
        data: [
          {
            name: this.tableColumns[this.dataConfig.stringColumnIndex].name,
            value: `${row[this.dataConfig.stringColumnIndex]}`,
          },
        ],
      }
    }
  }

  generateChartData = newTableData => {
    try {
      this.supportsPivot = supportsRegularPivotTable(this.tableColumns)
      let columns = this.tableColumns
      let tableData = newTableData || this.tableData

      if (this.supportsPivot) {
        columns = this.pivotTableColumns
        tableData = this.pivotTableData
      }

      let stringIndex = this.dataConfig.stringColumnIndex
      this.dataConfig.seriesIndices = this.dataConfig.numberColumnIndices

      if (this.supportsPivot) {
        stringIndex = 0
        this.dataConfig.seriesIndices = this.pivotTableColumns.map(
          (col, i) => i
        )
        this.dataConfig.seriesIndices.shift()
      }

      this.chartData = Object.values(
        tableData.reduce((chartDataObject, row, rowIndex) => {
          // Loop through columns and create a series for each
          const cells = []

          this.dataConfig.seriesIndices.forEach((columnIndex, i) => {
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
                  config: this.props.dataFormatting,
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
                  undefined,
                  newValue
                ),
              }
            })
          }
          return chartDataObject
        }, {})
      )

      this.chartDataError = false
    } catch (error) {
      if (!this.chartDataError) {
        // Try one more time after resetting data config settings
        this.chartDataError = true
        this.dataConfig = {}
        this.setColumnIndices()
        this.generateChartData()
      } else {
        // Something went wrong a second time. Do not show chart options
        this.supportedDisplayTypes = ['table']
        this.chartData = undefined
        console.error(error)
      }
    }
  }

  setFilterFunction = col => {
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

  getColTitle = col => {
    if (col.display_name) {
      return col.display_name
    }

    let title
    const nameFragments = col.name.split('___')
    if (nameFragments.length === 2) {
      let firstFragment = nameFragments[0]
      let secondFragment = nameFragments[1]

      if (!firstFragment.isUpperCase()) {
        firstFragment = firstFragment.toProperCase()
      }
      if (!secondFragment.isUpperCase()) {
        secondFragment = secondFragment.toProperCase()
      }
      title = `${firstFragment} (${secondFragment})`
    } else if (nameFragments.length === 1) {
      // all good
    } else {
      console.warn(`unexpected nameFragments.length ${nameFragments.length}`)
    }

    // replace underscores with spaces, then collapse all consecutive spaces to 1
    title = col.name.replace(/_/g, ' ').replace(/\s+/g, ' ')
    title = `${title.toProperCase()}`

    return title
  }

  formatColumnsForTable = columns => {
    if (!columns) {
      return null
    }
    const formattedColumns = columns.map((col, i) => {
      // Regardless of the BE response, we want to default to percent
      if (
        (col.type === 'RATIO' || col.type === 'NUMBER') &&
        _get(this.props.dataFormatting, 'comparisonDisplay') === 'PERCENT'
      ) {
        col.type = 'PERCENT'
      }

      col.field = `${i}`
      col.title = this.getColTitle(col)
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
        col.align = 'right'
      } else {
        col.align = 'center'
      }

      // Cell formattingg
      col.formatter = (cell, formatterParams, onRendered) => {
        return formatElement({
          element: cell.getValue(),
          column: col,
          config: this.props.dataFormatting,
          htmlElement: cell.getElement(),
        })
      }

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      col.headerFilter = 'input'

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      col.headerFilterFunc = this.setFilterFunction(col)

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

      // Allow proper chronological sorting for date strings
      if (col.type === 'DATE' || col.type === 'DATE_STRING') {
        col.sorter = function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aDate = dayjs(a).unix()
          const bDate = dayjs(b).unix()

          if (!aDate || !bDate) {
            return a - b
          }

          return aDate - bDate
        }
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

  generateDatePivotData = newTableData => {
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

      const dateColumnIndex = this.tableColumns.findIndex(
        col => col.type === 'DATE' || col.type === 'DATE_STRING'
      )
      if (!(this.dataConfig.numberColumnIndex >= 0)) {
        this.dataConfig.numberColumnIndex = this.tableColumns.findIndex(
          (col, index) => index !== dateColumnIndex && isColumnNumberType(col)
        )
      }

      const tableData =
        newTableData || _get(this.props.queryResponse, 'data.data.rows')

      const allYears = tableData.map(d => {
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

      const uniqueYears = allYears
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
      tableData.forEach(row => {
        const year = this.formatDatePivotYear(row, dateColumnIndex)
        const month = this.formatDatePivotMonth(row, dateColumnIndex)

        const yearNumber = uniqueYears[year]
        const monthNumber = uniqueMonths[month]

        pivotTableData[monthNumber][yearNumber] =
          row[this.dataConfig.numberColumnIndex]
        pivotOriginalColumnData[year] = {
          ...pivotOriginalColumnData[year],
          [month]: row[dateColumnIndex],
        }
      })

      this.pivotOriginalColumnData = pivotOriginalColumnData
      this.pivotTableColumns = pivotTableColumns
      this.pivotTableData = pivotTableData
      this.numberOfPivotTableRows = 12
    } catch (error) {
      this.supportedDisplayTypes.filter(
        displayType => displayType !== 'pivot_table'
      )
      this.setState({ displayType: 'table' })
    }
  }

  generatePivotTableData = ({ isFirstGeneration, newTableData } = {}) => {
    try {
      const tableData =
        newTableData || _get(this.props.queryResponse, 'data.data.rows')

      // Set the columns used for the 2 headers (ordinal and legend for charts)
      // If one of the indices is already specified, use it
      let dataConfigWasPersisted = false
      if (this.dataConfig.legendColumnIndex >= 0) {
        dataConfigWasPersisted = true
        this.dataConfig.stringColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.legendColumnIndex
        )
      } else if (this.dataConfig.stringColumnIndex >= 0) {
        this.dataConfig.legendColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.stringColumnIndex
        )
      } else {
        this.dataConfig.stringColumnIndex = this.tableColumns.findIndex(
          col => col.groupable
        )
        this.dataConfig.legendColumnIndex = this.tableColumns.findIndex(
          (col, i) => col.groupable && i !== this.dataConfig.stringColumnIndex
        )
      }

      // Set the number type column
      if (!(this.dataConfig.numberColumnIndex >= 0)) {
        this.dataConfig.numberColumnIndex = this.tableColumns.findIndex(
          (col, index) => isColumnNumberType(col) && !col.groupable
        )
      }

      let uniqueValues0 = tableData
        .map(d => d[this.dataConfig.stringColumnIndex])
        .filter(onlyUnique)
        .sort()
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      let uniqueValues1 = tableData
        .map(d => d[this.dataConfig.legendColumnIndex])
        .filter(onlyUnique)
        .sort()
        .reduce((map, title, i) => {
          map[title] = i
          return map
        }, {})

      // Make sure the longer list is on the side, not the top
      if (
        isFirstGeneration &&
        Object.keys(uniqueValues1).length > Object.keys(uniqueValues0).length &&
        !dataConfigWasPersisted
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
          config: this.props.dataFormatting,
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
          display_name: formattedColumnName,
          field: `${i + 1}`,
          headerContext: undefined,
          visible: true,
        })
      })

      const pivotTableData = makeEmptyArray(
        Object.keys(uniqueValues1).length + 1, // Add one for the frozen first column
        Object.keys(uniqueValues0).length
      )
      tableData.forEach(row => {
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

  onSuggestionClick = (suggestion, isButtonClick, skipSafetyNet, source) => {
    if (suggestion === 'None of these') {
      this.setState({ customResponse: 'Thank you for your feedback.' })
    } else {
      if (this.props.onSuggestionClick) {
        this.props.onSuggestionClick(
          suggestion,
          isButtonClick,
          skipSafetyNet,
          source
        )
      }
      if (this.props.queryInputRef) {
        this.props.queryInputRef.submitQuery({
          queryText: suggestion,
          skipSafetyNet: true,
          source,
        })
      }
    }
  }

  renderErrorMessage = message => {
    if (message) {
      return message
    }

    return errorMessages.GENERAL
  }

  renderResponse = (width, height) => {
    const { displayType } = this.state
    const { queryResponse } = this.props
    const data = _get(queryResponse, 'data.data.rows')

    // This is used for "Thank you for your feedback" response
    // when user clicks on "None of these" in the suggestion list
    // Eventually we will want to send this info to the BE
    if (this.state.customResponse) {
      return this.state.customResponse
    }

    // No response prop was provided to <QueryOutput />
    if (!queryResponse) {
      console.warn('Warning: No response object supplied')
      return this.renderErrorMessage('No response supplied')
      // return null
    }

    // Response prop was provided, but it has no response data
    const responseBody = { ...queryResponse.data }
    if (!responseBody) {
      console.warn('Warning: No response body supplied')
      return this.renderErrorMessage()
    }

    // Safetynet was triggered, display safetynet message
    if (responseBody.full_suggestion) {
      return (
        <SafetyNetMessage
          key={this.SAFETYNET_KEY}
          response={this.props.queryResponse}
          onSuggestionClick={query =>
            this.onSuggestionClick(query, true, true, 'validation')
          }
          onQueryValidationSelectOption={
            this.props.onQueryValidationSelectOption
          }
          initialSelections={this.props.queryValidationSelections}
          autoSelectSuggestion={this.props.autoSelectQueryValidationSuggestion}
        />
      )
    }

    // Response is not a suggestion list, but no query data object was provided
    // There is no valid query data. This is an error. Return message from UMS
    const responseData = responseBody.data
    if (!responseData) {
      console.warn('Warning: No response data supplied')
      return this.renderErrorMessage(_get(queryResponse, 'message'))
    }

    const isSuggestionList = !!responseData.items
    if (isSuggestionList) {
      return this.renderSuggestionMessage(responseData.items)
    }

    // This is not an error. There is just no data in the DB
    if (!_get(data, 'length')) {
      return this.renderErrorMessage(
        _get(responseBody, 'message', 'No Data Found')
      )
    }

    if (displayType && data) {
      if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (isForecastType(displayType)) {
        return this.renderForecastVis()
      } else if (isTableType(displayType)) {
        return this.renderTable()
      } else if (isChartType(displayType)) {
        return this.renderChart(width, height)
      }
      return this.renderErrorMessage(
        `display type not recognized: ${this.state.displayType}`
      )
    }
    // return this.renderErrorMessage('Error: No Display Type')
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
        content={props => this.renderContextMenuContent(props)}
      >
        <div />
      </Popover>
    )
  }

  render = () => {
    const responseContainer = document.getElementById(
      `chata-response-content-container-${this.COMPONENT_KEY}`
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
      <Fragment>
        <div
          key={this.COMPONENT_KEY}
          id={`chata-response-content-container-${this.COMPONENT_KEY}`}
          data-test="query-response-wrapper"
          className={`chata-response-content-container ${
            isTableType(this.state.displayType) ? 'table' : ''
          }`}
        >
          {this.renderResponse(width, height)}
        </div>
        {this.renderContextMenu()}
      </Fragment>
    )
  }
}
