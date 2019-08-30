import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import { IoIosGlobe } from 'react-icons/io'
import Numbro from 'numbro'
import dayjs from 'dayjs'

import styles from './ResponseRenderer.css'
import { getParameterByName } from '../../js/Util'
import { ChataTable } from '../ChataTable'
import { ChataChart } from '../ChataChart'
import { ChatBar } from '../ChatBar'
import { SafetyNetMessage } from '../SafetyNetMessage'
import { onlyUnique, formatElement, makeEmptyArray } from '../../js/Util.js'
import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'

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
  static propTypes = {
    supportsSuggestions: PropTypes.bool,
    processDrilldown: PropTypes.func,
    response: PropTypes.shape({}).isRequired,
    onSuggestionClick: PropTypes.func,
    chatBarRef: PropTypes.instanceOf(ChatBar),
    isQueryRunning: PropTypes.bool,
    tableBorderColor: PropTypes.string,
    tableHoverColor: PropTypes.string,
    displayType: PropTypes.string,
    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string),
    isFilteringTable: PropTypes.bool
  }

  static defaultProps = {
    supportedDisplayTypes: [],
    supportsSuggestions: true,
    isQueryRunning: false,
    tableBorderColor: undefined, // this should be what it is in light theme by default
    tableHoverColor: undefined, // this should be what it is in light theme by default
    displayType: undefined,
    chatBarRef: undefined,
    onSuggestionClick: undefined,
    isFilteringTable: false,
    processDrilldown: () => {}
  }

  state = {
    displayType:
      this.props.displayType ||
      (this.props.response &&
        this.props.response.data &&
        this.props.response.data.data &&
        this.props.response.data.data.displayType)
  }

  componentWillMount = () => {
    this.setResponseData(this.state.displayType)
    this.tableID = uuid.v4()
    this.pivotTableID = uuid.v4()
  }

  componentDidUpdate = prevProps => {
    if (
      this.props.displayType &&
      this.props.displayType !== prevProps.displayType
    ) {
      this.setState({ displayType: this.props.displayType })
    }
  }

  isChartType = type => CHART_TYPES.includes(type)
  isTableType = type => TABLE_TYPES.includes(type)

  setResponseData = displayType => {
    if (
      this.props.response &&
      this.props.response.data &&
      this.props.response.data.data
    ) {
      const responseBody = this.props.response.data.data
      this.queryID = responseBody.queryId // We need queryID for drilldowns (for now)
      this.interpretation = responseBody.interpretation // Where should we display this?
      this.data = responseBody.rows

      if (
        this.isTableType(displayType) ||
        this.isChartType(displayType)
        // responseBody.columns &&
        // responseBody.data
      ) {
        this.generateTableData()
        if (
          this.tableData &&
          this.props.supportedDisplayTypes.includes('pivot_table')
        ) {
          this.generatePivotData()
        }
        if (
          this.tableData &&
          responseBody.columns &&
          responseBody.columns.length <= 3
        ) {
          this.generateChartData()
        }
      }
    }
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
      <div>
        I'm not sure what you mean by <strong>"{userInput}"</strong>. Did you
        mean:
        <br />
        <div className="chata-suggestions-container">
          {suggestions.map(suggestion => {
            return (
              <div key={uuid.v4()}>
                <button
                  // disabled={this.props.isQueryRunning}
                  onClick={() => this.onSuggestionClick(suggestion)}
                  className="chata-suggestion-btn"
                >
                  {suggestion}
                </button>
                <br />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  renderSuggestionMessage = () => {
    // There is actually a suggestion for this case
    const { response } = this.props
    const responseBody = response.data
    if (
      this.state.displayType === 'suggestion' &&
      responseBody.data.rows.length !== 0
    ) {
      const suggestions = responseBody.data.rows
      const theUserInput = getParameterByName(
        'q',
        response.config && response.config.url
      )
      return this.createSuggestionMessage(theUserInput, suggestions)
    }
    // No suggestions
    else if (
      this.state.displayType === 'suggestion' &&
      responseBody.data.length === 0
    ) {
      return this.createSuggestionMessage()
    }
    // We don't understand the query, no suggestions
    else if (this.state.displayType === 'unknown_words') {
      return this.createSuggestionMessage()
    }
    // this shouldn't happen...
    return this.renderErrorMessage()
  }

  copyTableToClipboard = () => {
    if (this.tableRef) {
      this.tableRef.copyToClipboard()
    }
    // else if (this.state.displayType === 'pivot_table' && this.pivotTableRef) {
    //   this.pivotTableRef.copyToClipboard()
    // }
  }

  saveTableAsCSV = () => {
    if (this.tableRef) {
      this.tableRef.saveAsCSV()
    }
    // else if (this.state.displayType === 'pivot_table' && this.pivotTableRef) {
    //   this.pivotTableRef.saveAsCSV()
    // }
  }

  saveChartAsPNG = () => {
    if (this.chartRef) {
      this.chartRef.saveAsPNG()
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
      return this.tableData
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
          isFilteringTable={this.props.isFilteringTable}
          // onRowClick={(row, columns) => {
          //   if (!this.props.isDrilldownDisabled) {
          //     this.props.processDrilldown(row, columns, this.queryID)
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
        onRowClick={(row, columns) => {
          if (!this.props.isDrilldownDisabled) {
            this.props.processDrilldown(row, columns, this.queryID)
          }
        }}
        isFilteringTable={this.props.isFilteringTable}
      />
    )
  }

  renderChart = () => {
    if (!this.chartData) {
      return 'Error: There was no data supplied for this chart'
    }
    let chartWidth = 0
    let chartHeight = 0
    const chatContainer = document.querySelector('.chat-message-container')
    if (chatContainer) {
      chartWidth = chatContainer.clientWidth - 20 - 40 // 100% of chat width minus message margins minus chat container margins
      chartHeight = 0.85 * chatContainer.clientHeight - 20 // 85% of chat height minus message margins
    }

    // const height =
    //   this.props.height ||
    //   (document.querySelector(`#${this.props.key}`) &&
    //     document.querySelector(`#${this.props.key}`).parent() &&
    //     document
    //       .querySelector(`#${this.props.key}`)
    //       .parent()
    //       .height()) ||
    //   300

    // const width =
    //   this.props.width ||
    //   (document.querySelector(`#${this.props.key}`) &&
    //     document.querySelector(`#${this.props.key}`).parent() &&
    //     document
    //       .querySelector(`#${this.props.key}`)
    //       .parent()
    //       .width()) ||
    //   500

    return (
      <ChataChart
        ref={ref => (this.chartRef = ref)}
        type={this.state.displayType}
        data={this.chartData}
        columns={this.tableColumns}
        height={chartHeight}
        width={chartWidth}
        valueFormatter={formatElement}
        onChartClick={(row, columns) => {
          if (!this.props.isDrilldownDisabled) {
            this.props.processDrilldown(row, columns, this.queryID)
          }
        }}
      />
    )
  }

  renderHelpResponse = () => {
    const url = this.data
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

  formatElement = (element, column = this.tableColumns[1]) => {
    let formattedElement = element
    if (column) {
      switch (column.type) {
        case 'STRING': {
          // do nothing
          break
        }
        case 'DOLLAR_AMT': {
          // We will need to grab the actual currency symbol here. Will that be returned in the query response?
          formattedElement = Numbro(element).formatCurrency({
            thousandSeparated: true,
            mantissa: 2
          })
          break
        }
        case 'QUANTITY': {
          if (Number(element) && Number(element) % 1 !== 0) {
            formattedElement = Numbro(element).format('0,0.0')
          }
          break
        }
        case 'DATE': {
          // This will change when the query response is refactored
          formattedElement = this.formatDateElement(column.title, element)
          break
        }
        case 'PERCENT': {
          if (Number(element)) {
            formattedElement = Numbro(element).format('0.00%')
          }
          break
        }
        default: {
          break
        }
      }
    }
    return formattedElement
  }

  generateChartData = () => {
    const columns = this.tableColumns

    if (columns.length === 2) {
      this.chartData = Object.values(
        this.tableData.reduce((chartDataObject, row) => {
          if (!chartDataObject[row[0]]) {
            chartDataObject[row[0]] = {
              origColumns: columns,
              origRow: row,
              // Don't think we need to do x and y separately. Can just use origRow
              label: row[0],
              value: Number(row[1]) || row[1],
              // Don't think we need to do x and y separately. Can just use origColumns
              // labelCol: columns[0],
              // valueCol: columns[1],
              formatter: (value, column) => {
                return formatElement(value, column)
              }
            }
          } else {
            chartDataObject[row[1]].value += Number(row[1])
          }
          return chartDataObject
        }, {})
      )
    } else if (columns.length === 3) {
      this.chartData = this.tableData.map(row => {
        return {
          origColumns: columns,
          origRow: row,
          labelX: row[1],
          labelY: row[0],
          value: Number(row[2]) || row[2],
          formatter: (value, column) => {
            return formatElement(value, column)
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
        return formatElement(cell.getValue(), col)
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
        console.error(`unexpected nameFragments.length ${nameFragments.length}`)
      }

      col.title = col.name.replace(/_/g, ' ')
      if (!col.title.isUpperCase()) {
        col.title = col.title.toProperCase()
      }

      // Always have filtering enabled, but only
      // display if filtering is toggled by user
      col.headerFilter = 'input'

      // Need to set custom filters for cells that are
      // displayed differently than the data (ie. dates)
      col.headerFilterFunc = this.setFilterFunction(col)

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
        this.tableColumns[1]
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

  onSuggestionClick = suggestion => {
    if (this.props.onSuggestionClick) {
      this.props.onSuggestionClick(suggestion)
    } else if (this.props.chatBarRef) {
      if (suggestion === 'None of these') {
        this.setState({ customResponse: 'Thank you for your feedback.' })
      } else {
        this.props.chatBarRef.submitQuery(suggestion)
      }
    }
  }

  renderErrorMessage = message => {
    if (message) {
      return message
    }
    return 'Oops... Something went wrong with this query. If the problem persists, please contact the customer success team'
  }

  renderResponse = () => {
    const { displayType } = this.state
    if (this.state.customResponse) {
      return this.state.customResponse
    }
    if (!this.props.response) {
      return this.renderErrorMessage('Error: No response object supplied')
    }
    const responseBody = this.props.response.data
    if (!responseBody) {
      return this.renderErrorMessage('Error: No response body supplied')
    }

    if (responseBody.full_suggestion) {
      return (
        <SafetyNetMessage
          response={this.props.response}
          onSuggestionClick={this.onSuggestionClick}
        />
      )
    }

    if (responseBody.rows && !responseBody.rows.length) {
      // This is not an error. There is just no data in the DB
      return 'No data found.'
    }

    if (displayType) {
      if (displayType === 'suggestion' || displayType === 'unknown_words') {
        return this.renderSuggestionMessage()
      } else if (displayType === 'help') {
        return this.renderHelpResponse()
      } else if (this.isTableType(displayType)) {
        return this.renderTable()
      } else if (this.isChartType(displayType)) {
        return this.renderChart()
      }
      return this.renderErrorMessage(
        `display type not recognized: ${this.state.displayType}`
      )
    }
    return this.renderErrorMessage('Error: No Display Type')
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          data-test="query-response-wrapper"
          className="chata-response-content-container"
        >
          {this.renderResponse()}
        </div>
      </Fragment>
    )
  }
}
