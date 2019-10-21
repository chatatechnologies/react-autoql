import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import { IoIosGlobe } from 'react-icons/io'
import dayjs from 'dayjs'
import ReactTooltip from 'react-tooltip'

import styles from './ResponseRenderer.css'
import { ChataTable } from '../ChataTable'
import { ChataChart } from '../ChataChart'
import { ChatBar } from '../ChatBar'
import { SafetyNetMessage } from '../SafetyNetMessage'
// import { ChataForecast } from '../ChataForecast'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  onlyUnique,
  formatElement,
  makeEmptyArray,
  getNumberOfGroupables,
  getSupportedDisplayTypes,
  getGroupBysFromPivotTable,
  getGroupBysFromTable,
  getGroupBysFrom3dChart,
  getGroupBysFrom2dChart
} from '../../js/Util.js'

import { TABLE_TYPES, CHART_TYPES, FORECAST_TYPES } from '../../js/Constants.js'

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

export default class ResponseRenderer extends React.Component {
  supportedDisplayTypes = []

  static propTypes = {
    response: PropTypes.shape({}).isRequired,
    chatBarRef: PropTypes.instanceOf(ChatBar),
    supportsSuggestions: PropTypes.bool,
    processDrilldown: PropTypes.func,
    onSuggestionClick: PropTypes.func,
    isQueryRunning: PropTypes.bool,
    tableBorderColor: PropTypes.string,
    tableHoverColor: PropTypes.string,
    displayType: PropTypes.string,
    renderTooltips: PropTypes.bool,
    onSafetyNetSelectOption: PropTypes.func,
    autoSelectSafetyNetSuggestion: PropTypes.bool,
    safetyNetSelections: PropTypes.arrayOf(PropTypes.shape({})),
    renderSuggestionsAsDropdown: PropTypes.bool,
    suggestionSelection: PropTypes.string,
    enableSuggestions: PropTypes.bool,
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    chartColors: PropTypes.arrayOf(PropTypes.string),
    height: PropTypes.number,
    width: PropTypes.number
  }

  static defaultProps = {
    supportsSuggestions: true,
    isQueryRunning: false,
    tableBorderColor: undefined, // this should be what it is in light theme by default
    tableHoverColor: undefined, // this should be what it is in light theme by default
    displayType: undefined,
    chatBarRef: undefined,
    onSuggestionClick: undefined,
    renderTooltips: true,
    autoSelectSafetyNetSuggestion: true,
    safetyNetSelections: undefined,
    renderSuggestionsAsDropdown: false,
    selectedSuggestion: undefined,
    enableSuggestions: true,
    currencyCode: undefined,
    languageCode: undefined,
    height: undefined,
    width: undefined,
    chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
    processDrilldown: () => {},
    onSafetyNetSelectOption: () => {}
  }

  state = {
    displayType: null,
    suggestionSelection: this.props.selectedSuggestion
  }

  componentDidMount = () => {
    this.RESPONSE_COMPONENT_KEY = uuid.v4()

    // Determine the supported visualization types based on the response data
    this.supportedDisplayTypes = getSupportedDisplayTypes(this.props.response)

    // Set the initial display type based on prop value, response, and supported display types
    this.setState({
      displayType: this.getInitialDisplayType(this.supportedDisplayTypes)
    })
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Initial display type has been determined, set the table and chart data now
    if (!prevState.displayType && this.state.displayType) {
      this.setResponseData(this.state.displayType)
      this.forceUpdate()
    }

    // Detected a display type change from props. We must make sure
    // the display type is valid before updating the state
    if (
      this.props.displayType &&
      this.props.displayType !== prevProps.displayType &&
      this.supportedDisplayTypes &&
      this.supportedDisplayTypes.includes(this.props.displayType)
    ) {
      this.setState({ displayType: this.props.displayType })
    }

    ReactTooltip.rebuild()
  }

  isChartType = type => CHART_TYPES.includes(type)
  isTableType = type => TABLE_TYPES.includes(type)
  isForecastType = type => FORECAST_TYPES.includes(type)

  getInitialDisplayType = supportedDisplayTypes => {
    // If display type is a provided prop and it is valid
    if (
      this.props.displayType &&
      supportedDisplayTypes.includes(this.props.displayType)
    ) {
      return this.props.displayType
    }

    // If there is no display type in the response, default to table
    if (
      !this.props.response ||
      !this.props.response.data ||
      !this.props.response.data.data ||
      !this.props.response.data.data.display_type
    ) {
      return 'table'
    }

    const displayType = this.props.response.data.data.display_type

    // If the display type is a recognized non-chart or non-table type
    if (displayType === 'suggestion' || displayType === 'help') {
      return displayType
    }

    // If the display type is a recognized table type
    if (this.isTableType(displayType)) {
      return 'table'
    }

    // If the display type is a recognized chart type
    // This probably won't happen with chata.io, it is
    // usually returned as a table type initially
    if (this.isChartType(displayType)) {
      return displayType
    }

    // Default to table type
    return 'table'
  }

  setResponseData = () => {
    // Initialize ID's of tables
    this.tableID = uuid.v4()
    this.pivotTableID = uuid.v4()

    const { displayType } = this.state
    const { response } = this.props

    if (response && response.data && response.data.data && displayType) {
      const responseBody = response.data.data
      this.queryID = responseBody.query_id // We need queryID for drilldowns (for now)
      this.interpretation = responseBody.interpretation
      this.data = responseBody.rows ? [...responseBody.rows] : null
      if (this.isTableType(displayType) || this.isChartType(displayType)) {
        this.generateTableData()
        this.shouldGeneratePivotData() && this.generatePivotData()
        this.shouldGenerateChartData() && this.generateChartData()
      } else if (this.isForecastType(displayType)) {
        this.generateForecastData()
      }
    }
  }

  shouldGeneratePivotData = () => {
    return this.tableData && this.supportedDisplayTypes.includes('pivot_table')
  }

  shouldGenerateChartData = () => {
    return !!getNumberOfGroupables(this.tableColumns) && this.tableData
  }

  generateForecastData = () => {
    // This is temporary until we create the forecast vis
    this.generateTableData()
    this.shouldGenerateChartData() && this.generateChartData()
  }

  generateTableData = () => {
    this.tableColumns = this.formatColumnsForTable(
      this.props.response.data.data.columns
    )
    this.tableData =
      typeof this.data === 'string' // This will change once the query response is refactored
        ? undefined
        : this.data
  }

  generatePivotData = () => {
    if (this.tableColumns.length === 2) {
      this.generateDatePivotData()
    } else {
      this.generatePivotTableData()
    }
  }

  createSuggestionMessage = (userInput, suggestions) => {
    return (
      <div className="chata-suggestion-message">
        <div className="chata-suggestion-message-description">
          I'm not sure what you mean by <strong>"{userInput}"</strong>. Did you
          mean:
        </div>
        <div className="chata-suggestions-container">
          {this.props.renderSuggestionsAsDropdown ? (
            <select
              key={uuid.v4()}
              onChange={e => {
                this.setState({ suggestionSelection: e.target.value })
                this.onSuggestionClick(e.target.value)
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
                    // disabled={this.props.isQueryRunning}
                    onClick={() => this.onSuggestionClick(suggestion[0], true)}
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
  }

  renderSuggestionMessage = () => {
    if (!this.props.enableSuggestions) {
      return this.renderErrorMessage("Oops! We didn't understand that query.")
    }
    // There is actually a suggestion for this case
    const { response } = this.props
    const responseBody = { ...response.data }
    if (
      this.state.displayType === 'suggestion' &&
      response.config &&
      responseBody.data.rows.length !== 0
    ) {
      const suggestions = responseBody.data.rows
      const theUserInput = JSON.parse(response.config.data).text
      return this.createSuggestionMessage(theUserInput, suggestions)
    }

    // No suggestions
    else if (
      this.state.displayType === 'suggestion' &&
      responseBody.data.length === 0
    ) {
      return this.createSuggestionMessage()
    }

    return this.renderErrorMessage()
  }

  renderSingleValueResponse = () => {
    return (
      <a
        className="single-value-response"
        onClick={() => {
          this.props.processDrilldown({}, this.queryID, true)
        }}
      >
        {formatElement(
          this.tableData[0],
          this.tableColumns[0],
          this.props.currencyCode,
          this.props.languageCode
        )}
      </a>
    )
  }

  copyTableToClipboard = () => {
    if (this.tableRef) {
      this.tableRef.copyToClipboard()
    }
  }

  saveTableAsCSV = () => {
    if (this.tableRef) {
      this.tableRef.saveAsCSV()
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
    let groupByObject = {}
    if (this.pivotTableColumns && this.state.displayType === 'pivot_table') {
      groupByObject = getGroupBysFromPivotTable(
        cell,
        this.tableColumns,
        this.pivotTableColumns
      )
    } else {
      groupByObject = getGroupBysFromTable(cell, this.tableColumns)
    }

    if (!this.props.isDrilldownDisabled) {
      this.props.processDrilldown(groupByObject, this.queryID)
    }
  }

  onChartClick = (row, column) => {
    let groupByObject = {}
    if (
      this.pivotTableColumns &&
      !this.tableColumns[0].name.includes('month')
    ) {
      groupByObject = getGroupBysFrom3dChart(row, column, this.tableColumns)
    } else {
      groupByObject = getGroupBysFrom2dChart(row, this.tableColumns)
    }
    if (!this.props.isDrilldownDisabled) {
      this.props.processDrilldown(groupByObject, this.queryID)
    }
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
          key={this.pivotTableID}
          ref={ref => (this.tableRef = ref)}
          columns={this.pivotTableColumns}
          data={this.pivotTableData}
          borderColor={this.props.tableBorderColor}
          hoverColor={this.props.tableHoverColor}
          onCellClick={this.processCellClick}
          // onCellClick={(cell, columns) => {
          //   if (!this.props.isDrilldownDisabled) {
          //     this.props.processDrilldown(cell, columns, this.queryID)
          //   }
          // }}
        />
      )
    }

    return (
      <ChataTable
        key={this.tableID}
        ref={ref => (this.tableRef = ref)}
        columns={this.tableColumns}
        data={this.tableData}
        borderColor={this.props.tableBorderColor}
        hoverColor={this.props.tableHoverColor}
        // onRowClick={this.processRowClick}
        onCellClick={this.processCellClick}
      />
    )
  }

  renderChart = (width, height) => {
    if (!this.chartData) {
      return 'Error: There was no data supplied for this chart'
    }

    // let data = this.chartData
    // let columns = this.tableColumns
    // if (
    //   this.state.displayType === 'stacked_bar' ||
    //   this.state.displayType === 'stacked_column'
    // ) {
    //   data = this.pivotTableData
    //   columns = this.pivotTableColumns
    // }

    return (
      <ErrorBoundary>
        <ChataChart
          ref={ref => (this.chartRef = ref)}
          type={this.state.displayType}
          data={this.chartData}
          columns={this.tableColumns}
          height={height}
          width={width}
          currencyCode={this.props.currencyCode}
          languageCode={this.props.languageCode}
          chartColors={this.props.chartColors}
          // valueFormatter={formatElement}
          // onChartClick={(row, columns) => {
          //   if (!this.props.isDrilldownDisabled) {
          //     this.props.processDrilldown(row, columns, this.queryID)
          //   }
          // }}
          onChartClick={this.onChartClick}
        />
      </ErrorBoundary>
    )
  }

  renderHelpResponse = () => {
    const url = this.data
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
            <IoIosGlobe className="chata-help-link-icon" />
            {linkText}
          </button>
        }
      </Fragment>
    )
  }

  formatDateElement = (title, value) => {
    if (title && title.includes('Year')) {
      return dayjs.unix(value).format('YYYY')
    } else if (title && title.includes('Month')) {
      return dayjs.unix(value).format('MMMM YYYY')
    }
    return dayjs.unix(value).format('MMMM D, YYYY')
  }

  generateChartData = () => {
    const columns = this.tableColumns

    if (getNumberOfGroupables(this.tableColumns) === 1) {
      this.chartData = Object.values(
        this.tableData.reduce((chartDataObject, row) => {
          // Loop through columns and create a series for each
          const values = []
          row.forEach((value, i) => {
            if (i > 0) {
              values.push(Number(value) || value)
            }
          })

          // Make sure the row label doesn't exist already
          if (!chartDataObject[row[0]]) {
            chartDataObject[row[0]] = {
              origColumns: columns,
              origRow: row,
              label: row[0],
              values,
              formatter: (value, column) => {
                return formatElement(
                  value,
                  column,
                  this.props.currencyCode,
                  this.props.languageCode
                )
              }
            }
          } else {
            // If this label already exists, just add the values together
            chartDataObject[row[1]].value += Number(row[1])
          }
          return chartDataObject
        }, {})
      )
    } else if (getNumberOfGroupables(this.tableColumns) === 2) {
      this.chartData = this.tableData.map(row => {
        return {
          origColumns: columns,
          origRow: row,
          labelX: row[1],
          labelY: row[0],
          value: Number(row[2]) || row[2],
          formatter: (value, column) => {
            return formatElement(
              value,
              column,
              this.props.currencyCode,
              this.props.languageCode
            )
          }
        }
      })
    }
  }

  setFilterFunction = col => {
    const self = this
    if (col.type === 'DATE') {
      return (headerValue, rowValue, rowData, filterParams) => {
        // headerValue - the value of the header filter element
        // rowValue - the value of the column in this row
        // rowData - the data for the row being filtered
        // filterParams - params object passed to the headerFilterFuncParams property

        const formattedElement = self
          .formatDateElement(col.title, rowValue)
          .toLowerCase()

        return formattedElement.includes(headerValue.toLowerCase())
      }
    } else if (
      col.type === 'DOLLAR_AMT' ||
      col.type === 'QUANTITY' ||
      col.type === 'PERCENT'
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
        } catch (err) {
          console.log(err)
          return false
        }
      }
    }
    return undefined
  }

  formatColumnsForTable = columns => {
    if (!columns) {
      return null
    }
    const formattedColumns = columns.map((col, i) => {
      col.field = `${i}`
      col.align = 'center'
      col.formatter = (cell, formatterParams, onRendered) => {
        return formatElement(
          cell.getValue(),
          col,
          this.props.currencyCode,
          this.props.languageCode
        )
      }

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
        col.title = `${firstFragment} (${secondFragment})`
      } else if (nameFragments.length === 1) {
        // all good
      } else {
        console.warn(`unexpected nameFragments.length ${nameFragments.length}`)
      }

      col.title = col.name.replace(/_/g, ' ')
      col.title = `${col.title.toProperCase()}`

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      col.headerFilter = 'input'

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      col.headerFilterFunc = this.setFilterFunction(col)

      if (col.type === 'DATE') {
        col.sorter = function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aDate = dayjs.unix(a)
          const bDate = dayjs.unix(b)

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

  generateDatePivotData = () => {
    const uniqueMonths = {
      January: 0,
      February: 1,
      March: 2,
      April: 3,
      May: 4,
      June: 5,
      July: 6,
      August: 7,
      September: 8,
      October: 9,
      November: 10,
      December: 11
    }

    const uniqueYears = this.tableData
      .map(d => Number(dayjs.unix(d[0]).format('YYYY')))
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
        frozen: true
      }
    ]
    Object.keys(uniqueYears).forEach((year, i) => {
      pivotTableColumns.push({
        ...this.tableColumns[1], // value column
        name: year,
        title: year,
        field: `${i + 1}`
      })
    })

    const pivotTableData = makeEmptyArray(Object.keys(uniqueYears).length, 12)

    // Populate first column
    Object.keys(uniqueMonths).forEach((month, i) => {
      pivotTableData[i][0] = month
    })
    // Populate remaining columns
    this.tableData.forEach(row => {
      const year = dayjs.unix(row[0]).format('YYYY')
      const month = dayjs.unix(row[0]).format('MMMM')
      pivotTableData[uniqueMonths[month]][uniqueYears[year]] = row[1]
    })

    this.pivotTableColumns = pivotTableColumns
    this.pivotTableData = pivotTableData
  }

  generatePivotTableData = () => {
    const uniqueValues0 = this.tableData
      .map(d => d[0])
      .filter(onlyUnique)
      .sort()
      .reduce((map, title, i) => {
        map[title] = i
        return map
      }, {})

    const uniqueValues1 = this.tableData
      .map(d => d[1])
      .filter(onlyUnique)
      .sort()
      .reduce((map, title, i) => {
        map[title] = i + 1
        return map
      }, {})

    // Generate new column array
    const pivotTableColumns = [
      {
        ...this.tableColumns[0],
        frozen: true
      }
    ]
    Object.keys(uniqueValues1).forEach((columnName, i) => {
      const formattedColumnName = formatElement(
        columnName,
        this.tableColumns[1],
        this.props.currencyCode,
        this.props.languageCode
      )
      pivotTableColumns.push({
        ...this.tableColumns[2], // value column
        name: formattedColumnName,
        title: formattedColumnName,
        field: `${i + 1}`
      })
    })

    const pivotTableData = makeEmptyArray(
      Object.keys(uniqueValues1).length,
      Object.keys(uniqueValues0).length
    )
    this.tableData.forEach(row => {
      // Populate first column
      pivotTableData[uniqueValues0[row[0]]][0] = row[0]
      // Populate data for remaining columns
      pivotTableData[uniqueValues0[row[0]]][uniqueValues1[row[1]]] = row[2]
    })

    this.pivotTableColumns = pivotTableColumns
    this.pivotTableData = pivotTableData
  }

  onSuggestionClick = (suggestion, isButtonClick) => {
    if (this.props.onSuggestionClick) {
      this.props.onSuggestionClick(suggestion, isButtonClick)
    }
    if (this.props.chatBarRef) {
      if (suggestion === 'None of these') {
        this.setState({ customResponse: 'Thank you for your feedback.' })
      } else {
        this.props.chatBarRef.submitQuery(suggestion, skipSafetyNet)
      }
    }
  }

  renderErrorMessage = message => {
    if (message) {
      return message
    }
    return 'Oops... Something went wrong with this query. If the problem persists, please contact the customer success team'
  }

  renderResponse = (width, height) => {
    const { displayType } = this.state
    const { response } = this.props

    // This is used for "Thank you for your feedback" response
    // when user clicks on "None of these" in the suggestion list
    // Eventually we will want to send this info to the BE
    if (this.state.customResponse) {
      return this.state.customResponse
    }

    // No response prop was provided to <ResponseRenderer />
    if (!response) {
      console.warn('Warning: No response object supplied')
      return this.renderErrorMessage()
    }

    // Response prop was provided, but it has no response data
    const responseBody = { ...response.data }
    if (!responseBody) {
      console.warn('Warning: No response body supplied')
      return this.renderErrorMessage()
    }

    // Safetynet was triggered, display safetynet message
    if (responseBody.full_suggestion) {
      return (
        <SafetyNetMessage
          response={this.props.response}
          onSuggestionClick={this.onSuggestionClick}
          onSafetyNetSelectOption={this.props.onSafetyNetSelectOption}
          initialSelections={this.props.safetyNetSelections}
          autoSelectSuggestion={this.props.autoSelectSafetyNetSuggestion}
        />
      )
    }

    // Response is not a suggestion list, but no query data object was provided
    const responseData = responseBody.data
    if (!responseData) {
      console.warn('Warning: No response data supplied')
      return this.renderErrorMessage(responseBody.message)
    }

    if (!responseData.rows || !responseData.rows.length) {
      // This is not an error. There is just no data in the DB
      return 'No data found.'
    }

    if (displayType && this.data) {
      if (displayType === 'suggestion') {
        return this.renderSuggestionMessage()
      } else if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (this.isForecastType(displayType)) {
        return this.renderForecastVis()
      } else if (this.isTableType(displayType)) {
        return this.renderTable()
      } else if (this.isChartType(displayType)) {
        return this.renderChart(width, height)
      }
      return this.renderErrorMessage(
        `display type not recognized: ${this.state.displayType}`
      )
    }
    // return this.renderErrorMessage('Error: No Display Type')
    return null
  }

  render = () => {
    const responseContainer = document.getElementById(
      `chata-response-content-container-${this.RESPONSE_COMPONENT_KEY}`
    )

    let height = 0
    let width = 0

    if (responseContainer) {
      height = responseContainer.clientHeight
      width = responseContainer.clientWidth
    }

    if (this.props.height) {
      height = this.props.height
    }

    if (this.props.width) {
      width = this.props.width
    }

    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          key={this.RESPONSE_COMPONENT_KEY}
          id={`chata-response-content-container-${this.RESPONSE_COMPONENT_KEY}`}
          data-test="query-response-wrapper"
          className="chata-response-content-container"
          // style={{ ...style }}
        >
          {this.renderResponse(width, height)}
        </div>
        {this.props.renderTooltips && (
          <ReactTooltip
            className="chata-chart-tooltip"
            id="chart-element-tooltip"
            effect="solid"
            html
          />
        )}
      </Fragment>
    )
  }
}
