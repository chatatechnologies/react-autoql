import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import PapaParse from 'papaparse'
import uuid from 'uuid'
import { IoIosGlobe } from 'react-icons/io'
import Numbro from 'numbro'
import dayjs from 'dayjs'

import styles from './ResponseRenderer.css'
import { getParameterByName } from '../../js/Util'
import { ChataTable } from '../ChataTable'
import { ChataChart } from '../ChataChart'
import { SafetyNetMessage } from '../SafetyNetMessage'

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

const TABLE_TYPES = [
  'pivot_column',
  'table',
  'compare_table',
  'compare_table_budget',
  'date_pivot'
]

const CHART_TYPES = [
  'bar',
  'bubble',
  'chart',
  'column',
  'heatmap',
  'line',
  'pie',
  'stacked_bar',
  'stacked_column',
  'word_cloud',
  'contrast_bar',
  'contrast_column',
  'contrast_line'
]

export default class ResponseRenderer extends React.Component {
  static propTypes = {
    supportsSuggestions: PropTypes.bool,
    processDrilldown: PropTypes.func,
    response: PropTypes.shape({}).isRequired,
    onSuggestionClick: PropTypes.func,
    isQueryRunning: PropTypes.bool,
    tableBorderColor: PropTypes.string,
    displayType: PropTypes.string,
    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string)
  }

  static defaultProps = {
    supportedDisplayTypes: [],
    supportsSuggestions: true,
    isQueryRunning: false,
    tableBorderColor: undefined,
    displayType: undefined,
    onSuggestionClick: () => {},
    processDrilldown: () => {}
  }

  state = {
    activeDisplayType: undefined
  }

  componentDidMount = () => {
    const activeDisplayType =
      this.props.displayType ||
      (this.props.response &&
        this.props.response.data &&
        this.props.response.data.display_type)

    if (this.props.response && this.props.response.data) {
      const responseBody = this.props.response.data
      // do we need this stuff?
      // this.queryID = responseBody.query_id
      // this.filters = responseBody.filters
      // this.answer = responseBody.answer
      this.data = responseBody.data
      if (
        this.isTableType(activeDisplayType) ||
        this.isChartType(activeDisplayType)
      ) {
        this.tableColumns = this.formatColumnsForTable(responseBody.columns)
        this.tableData = PapaParse.parse(this.data).data
        if (responseBody.columns && responseBody.columns.length <= 3)
          this.chartData = this.formatChartData()
      }
    }
    this.setState({ activeDisplayType })
  }

  componentDidUpdate = prevProps => {
    if (
      this.props.displayType &&
      this.props.displayType !== prevProps.displayType
    ) {
      this.setState({ activeDisplayType: this.props.displayType })
    }
  }

  isChartType = type => CHART_TYPES.includes(type)
  isTableType = type => TABLE_TYPES.includes(type)

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
                  onClick={() => this.props.onSuggestionClick(suggestion)}
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
      this.state.activeDisplayType === 'suggestion' &&
      responseBody.data.length !== 0
    ) {
      const suggestions = responseBody.data.split('\n')
      const finalRow = suggestions[suggestions.length - 1] // strip out trailing newline
      if (finalRow === '') {
        suggestions.splice(-1)
      }
      const theUserInput = getParameterByName(
        'q',
        response.config && response.config.url
      )
      return this.createSuggestionMessage(theUserInput, suggestions)
    }
    // No suggestions
    else if (
      this.state.activeDisplayType === 'suggestion' &&
      responseBody.data.length === 0
    ) {
      return this.createSuggestionMessage()
    }
    // We don't understand the query, no suggestions
    else if (this.state.activeDisplayType === 'unknown_words') {
      return this.createSuggestionMessage()
    }
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

  renderTable = () => {
    if (this.tableData.length === 1 && this.tableData[0].length === 1) {
      return this.tableData
    }

    return (
      <ChataTable
        columns={this.tableColumns}
        ref={ref => (this.tableRef = ref)}
        data={this.tableData}
        borderColor={this.props.tableBorderColor}
        onRowDblClick={(row, columns) => {
          if (!this.props.isDrilldownDisabled) {
            this.props.processDrilldown(row, columns, this.queryID)
          }
        }}
      />
    )
  }

  renderChart = () => {
    let chartWidth = 0
    let chartHeight = 0
    const chatContainer = document.querySelector('.chat-message-container')
    if (chatContainer) {
      chartWidth = chatContainer.clientWidth - 20 - 40 // 100% of chat width minus message margins minus chat container margins
      chartHeight = 0.88 * chatContainer.clientHeight - 20 // 88% of chat height minus message margins
    }

    return (
      <ChataChart
        type={this.state.activeDisplayType}
        data={this.chartData}
        columns={this.tableColumns}
        height={chartHeight}
        width={chartWidth}
        valueFormatter={this.formatElement}
      />
    )

    // return (
    //   <ChataBarChartNew
    //     data={this.chartData}
    //     columns={this.tableColumns}
    //     height={chartHeight}
    //     width={chartWidth}
    //     dataValue="yValue"
    //     labelValue="xValue"
    //     tooltipFormatter={data => {
    //       return `<div>
    //           <span><strong>${this.tableColumns[0].title}:</strong> ${
    //         data.xValue
    //       }</span>
    //           <br />
    //           <span><strong>${
    //             this.tableColumns[1].title
    //           }:</strong> ${self.formatElement(data.yValue)}</span>
    //         </div>`
    //     }}
    //   />
    // )
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

  formatElement = (element, column = this.tableColumns[1]) => {
    if (!column) {
      return element
    }
    switch (column.type) {
      case 'STRING': {
        return element
      }
      case 'DOLLAR_AMT': {
        // We will need to grab the actual currency symbol here. Will that be returned in the query response?
        return Numbro(element).formatCurrency({
          thousandSeparated: true,
          mantissa: 2
        })
      }
      case 'QUANTITY': {
        if (Number(element) % 1 !== 0) {
          return Numbro(element).format('0,0.0')
        }
        return element
      }
      case 'DATE': {
        const title = column.title
        if (title && title.includes('Year')) {
          return dayjs.unix(element).format('YYYY')
        } else if (title && title.includes('Month')) {
          return dayjs.unix(element).format('MMMM YYYY')
        }
        return dayjs.unix(element).format('MMMM D, YYYY')
      }
      case 'PERCENT': {
        if (Number(element)) {
          return Numbro(element).format('0.00%')
        }
        return element
      }
      default: {
        return element
      }
    }
  }

  formatChartData = () => {
    const columns = this.tableColumns

    // Is there a more efficient way to do this?
    // const formattedData = this.tableData.map(row => {
    //   return row.map((element, index) => {
    //     return this.formatElement(element, columns[index])
    //   })
    // })

    return this.tableData.map(row => {
      return {
        xValue: row[0],
        yValue: Number(row[1]),
        xCol: columns[0],
        yCol: columns[1],
        formatter: (value, column) => {
          return this.formatElement(value, column)
        }
      }
    })
  }

  formatColumnsForTable = columns => {
    const formattedColumns = columns.map((col, i) => {
      col.field = `${i}`
      col.align = 'center'
      col.formatter = (cell, formatterParams, onRendered) => {
        return this.formatElement(cell.getValue(), col)
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
        console.log(`unexpected nameFragments.length ${nameFragments.length}`)
      }
      col.title = col.name.replace(/_/g, ' ')
      if (!col.title.isUpperCase()) {
        col.title = col.title.toProperCase()
      }
      return col
    })
    return formattedColumns
  }

  renderResponse = () => {
    const { activeDisplayType } = this.state
    if (!this.props.response) {
      return
    }
    const responseBody = this.props.response.data
    if (!responseBody) {
      return
    }

    if (responseBody.full_suggestion) {
      return (
        <SafetyNetMessage
          response={this.props.response}
          onSuggestionClick={this.props.onSuggestionClick}
        />
      )
    } else if (this.state.activeDisplayType) {
      if (
        activeDisplayType === 'suggestion' ||
        activeDisplayType === 'unknown_words'
      ) {
        return this.renderSuggestionMessage()
      } else if (activeDisplayType === 'help') {
        return this.renderHelpResponse()
      } else if (this.isTableType(activeDisplayType)) {
        return this.renderTable()
        return this.renderChart()
      } else if (this.isChartType(activeDisplayType)) {
        return this.renderChart()
      }
    } else if (responseBody.data && !responseBody.data.length) {
      return 'No data found.'
    }
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div className="chata-response-content-container">
          {this.renderResponse()}
        </div>
      </Fragment>
    )
  }
}
