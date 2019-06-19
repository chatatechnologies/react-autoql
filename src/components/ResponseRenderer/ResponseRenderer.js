import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import PapaParse from 'papaparse'

import styles from './ResponseRenderer.css'
import { getParameterByName } from '../../js/Util'
import { ChataTable } from '../ChataTable'

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement)
}

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
  'csv',
  'pivot_column',
  'table',
  'text',
  'compare_table_budget',
  'date_pivot',
  'compare_table'
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
    isQueryRunning: PropTypes.bool
  }

  static defaultProps = {
    supportsSuggestions: true,
    isQueryRunning: false,
    onSuggestionClick: () => {},
    processDrilldown: () => {}
  }

  state = {}

  isChartType = type => CHART_TYPES.includes(type)
  isTableType = type => TABLE_TYPES.includes(type)

  createSuggestionMessage = (userInput, suggestions) => {
    return (
      <div>
        I'm not sure what you mean by "{userInput}". Did you mean:
        <br />
        <div className="chata-suggestions-container">
          {suggestions.map(suggestion => {
            return (
              <Fragment>
                <button
                  // disabled={this.props.isQueryRunning}
                  onClick={() => this.props.onSuggestionClick(suggestion)}
                  className="chata-suggestion-btn"
                >
                  {suggestion}
                </button>
                <br />
              </Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  renderSuggestionMessage = response => {
    // There is actually a suggestion for this case
    const responseBody = response.data
    if (
      responseBody.display_type === 'suggestion' &&
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
      responseBody.display_type === 'suggestion' &&
      responseBody.data.length === 0
    ) {
      this.createSuggestionMessage()
      return
    }
    // We don't understand the query, no suggestions
    else if (responseBody.display_type === 'unknown_words') {
      this.createSuggestionMessage()
      return
    }
  }

  renderTable = () => {
    const self = this
    const columns = this.formatColumnsForTable(self.columns)
    const data = PapaParse.parse(self.data).data

    if (data.length === 1 && data[0].length === 1) {
      return data
    }

    return (
      <ChataTable
        columns={columns}
        data={data}
        onRowDblClick={(row, columns) => {
          if (!this.props.isDrilldownDisabled) {
            this.props.processDrilldown(row, columns, this.queryID)
          }
        }}
      />
    )
  }

  renderChart = () => {
    const columns = this.formatColumnsForTable(this.columns)
    const data = PapaParse.parse(this.data).data
  }

  renderSingleValueResponse = () => {}

  formatColumnsForTable = columns => {
    const formattedColumns = columns.map((col, i) => {
      col.field = `${i}`
      col.align = 'center'
      col.formatter = undefined
      // if (col.name.toLowerCase().includes('score')) {
      //   col.formatter = 'star'
      // }

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
    const self = this
    if (!this.props.response) {
      console.log('no response was provided....')
      return
    }
    const responseBody = this.props.response.data
    if (!responseBody) {
      console.log('no data in the response.....')
      return
    }
    // const theUserInput = getParameterByName(
    //   'q',
    //   response && response.config && response.config.url
    // )
    // if body is undefined, we shouldn't have made it this far anyway

    if (responseBody.display_type) {
      // what is the case where there is no display type?
      self.displayType = responseBody.display_type
      self.supportedDisplayTypes = responseBody.supported_display_types
      self.columns = responseBody.columns
      self.queryID = responseBody.query_id
      self.filters = responseBody.filters
      self.answer = responseBody.answer
      self.data = responseBody.data

      if (
        responseBody.display_type === 'suggestion' ||
        responseBody.display_type === 'unknown_words'
      ) {
        return this.renderSuggestionMessage(this.props.response)
      } else if (this.isTableType(self.displayType)) {
        return this.renderTable()
      } else if (this.isChartType(self.displayType)) {
        return this.renderChart(self.displayType)
      }
    } else {
      console.log('there is no display type.... why? Was there an error?')
      if (responseBody.data && !responseBody.data.length) {
        return 'No data found.'
      }
      // // not sure what all this is for....?
      // self.queryType = body.type;
      // self.multiIndex = body.multi_index;
      // self.activeColumns = body.active_columns;
      // // save off the queryID for chained queries...
      // console.log('ChatApp::runQuery() - returned queryID is: ' + body.query_id)
      // self.previousQueryID = body.query_id;
      // self.queryID = body.query_id;
    }

    // If you reached this, the query did not fail, processing the results now
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
