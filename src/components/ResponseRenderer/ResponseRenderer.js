import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import PapaParse from 'papaparse'
import uuid from 'uuid'
import { IoIosGlobe, IoIosCloseCircleOutline } from 'react-icons/io'
import { MdPlayCircleOutline } from 'react-icons/md'

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
  'pivot_column',
  'table',
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
    displayType: PropTypes.string
  }

  static defaultProps = {
    supportsSuggestions: true,
    isQueryRunning: false,
    tableBorderColor: undefined,
    displayType: undefined,
    onSuggestionClick: () => {},
    processDrilldown: () => {}
  }

  state = {
    safetyNetQueryArray: [],
    activeDisplayType:
      this.props.displayType ||
      (this.props.response &&
        this.props.response.data &&
        this.props.response.data.display_type)
  }

  componentDidMount = () => {
    if (
      this.props.response &&
      this.props.response.data &&
      this.props.response.data.full_suggestion
    ) {
      this.initializeSafetyNetOptions(this.props.response.data)
    }
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

  initializeSafetyNetOptions = responseBody => {
    const queryArray = []
    let lastEndIndex = 0
    const { full_suggestion: fullSuggestions, query } = responseBody

    // const sortedFullSuggestions = fullSuggestions.sortBy(['start']).value();
    const sortedFullSuggestions = fullSuggestions
    sortedFullSuggestions.forEach((fullSuggestion, index) => {
      if (
        fullSuggestion.suggestion_list &&
        fullSuggestion.suggestion_list.length > 0
      ) {
        const suggestionList = fullSuggestion.suggestion_list
        queryArray.push({
          type: 'text',
          value: query.slice(lastEndIndex, fullSuggestion.start)
        })

        const replaceWord = query.slice(
          fullSuggestion.start,
          fullSuggestion.end
        )

        queryArray.push({
          type: 'suggestion',
          value: replaceWord,
          valueLabel: suggestionList[0].value_label
        })

        if (index === sortedFullSuggestions.length - 1) {
          queryArray.push({
            type: 'text',
            value: query.slice(fullSuggestion.end, query.length)
          })
        }

        lastEndIndex = fullSuggestion.end
      } else {
        queryArray.push({
          type: 'text',
          value: query.slice(lastEndIndex, fullSuggestion.start)
        })

        const replaceWord = query.slice(
          fullSuggestion.start,
          fullSuggestion.end
        )
        queryArray.push({
          type: 'suggestion',
          value: replaceWord
        })

        if (index === sortedFullSuggestions.length - 1) {
          queryArray.push({
            type: 'text',
            value: query.slice(fullSuggestion.end, query.length)
          })
        }

        lastEndIndex = fullSuggestion.end
      }
    })

    const newSafetyNetQueryArray = queryArray.map((element, index) => {
      if (index > 0 && index % 2 !== 0) {
        const fullSuggestionIndex = Math.floor(index / 2)
        if (
          fullSuggestions &&
          fullSuggestions[fullSuggestionIndex] &&
          fullSuggestions[fullSuggestionIndex].suggestion_list
        ) {
          return {
            ...element,
            value:
              fullSuggestions[fullSuggestionIndex].suggestion_list[0] &&
              fullSuggestions[fullSuggestionIndex].suggestion_list[0].text
          }
        }
        return {
          ...element,
          value:
            fullSuggestions &&
            fullSuggestions[fullSuggestionIndex] &&
            fullSuggestions[fullSuggestionIndex].suggestion
        }
      }
      return element
    })

    this.setState({
      safetyNetQueryArray: newSafetyNetQueryArray
    })
  }

  createSuggestionMessage = (userInput, suggestions) => {
    return (
      <div>
        I'm not sure what you mean by "{userInput}". Did you mean:
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
      this.createSuggestionMessage()
      return
    }
    // We don't understand the query, no suggestions
    else if (this.state.activeDisplayType === 'unknown_words') {
      this.createSuggestionMessage()
      return
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
    const self = this
    const columns = this.formatColumnsForTable(self.columns)
    const data = PapaParse.parse(self.data).data

    if (data.length === 1 && data[0].length === 1) {
      return data
    }

    return (
      <ChataTable
        columns={columns}
        ref={ref => (this.tableRef = ref)}
        data={data}
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
    // const columns = this.formatColumnsForTable(this.columns)
    // const data = PapaParse.parse(this.data).data
    console.log('rendering chart now')
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

  onChangeSafetyNetSelectOption = (suggestion, suggestionIndex) => {
    const newSafetyNetQueryArray = this.state.safetyNetQueryArray.map(
      (element, index) => {
        if (index === suggestionIndex) {
          return {
            ...element,
            value: JSON.parse(suggestion).text,
            valueLabel: JSON.parse(suggestion).value_label
          }
        }
        return element
      }
    )

    this.setState({
      safetyNetQueryArray: newSafetyNetQueryArray
    })
  }

  deleteSafetyNetSuggestion = suggestionIndex => {
    const newSafetyNetQueryArray = this.state.safetyNetQueryArray.map(
      (element, index) => {
        if (index === suggestionIndex) {
          return {
            ...element,
            value: ''
          }
        }
        return element
      }
    )

    this.setState({
      safetyNetQueryArray: newSafetyNetQueryArray
    })
  }

  renderSafetyNetMessage = () => {
    const { response } = this.props
    const fullSuggestions = response.data.full_suggestion
    const { query } = response.data
    const queryArray = this.state.safetyNetQueryArray

    const safetyNetQuery = (
      <span>
        {queryArray.map((element, index) => {
          if (element.type === 'text' || element.value === '') {
            return (
              <span
                // className="chata-safety-net-text"
                key={`query-element-${index}`}
              >
                {element.value}
              </span>
            )
          }

          const fullSuggestionIndex = Math.floor(index / 2)
          const suggestion = fullSuggestions[fullSuggestionIndex]

          if (suggestion) {
            const replaceWord = query.slice(suggestion.start, suggestion.end)
            const safetyNetSelectUniqueId = uuid.v4()

            const suggestionText = `${element.value}${
              element.valueLabel ? ` (${element.valueLabel})` : ''
            }`

            const suggestionValue = suggestion.suggestion_list.find(
              suggestion => suggestion.text === element.value
            ) || { text: replaceWord }

            const suggestionDiv = document.createElement('DIV')
            suggestionDiv.innerHTML = suggestionText
            suggestionDiv.style.display = 'inline-block'
            suggestionDiv.style.position = 'absolute'
            suggestionDiv.style.visibility = 'hidden'
            document.body.appendChild(suggestionDiv)
            const selectWidth = suggestionDiv.clientWidth + 28

            return (
              <div
                className="chata-safety-net-selector-container"
                key={`query-element-${index}`}
              >
                <select
                  key={uuid.v4()}
                  value={JSON.stringify(suggestionValue)}
                  className="chata-safetynet-select"
                  style={{ width: selectWidth }}
                  onChange={e =>
                    this.onChangeSafetyNetSelectOption(e.target.value, index)
                  }
                >
                  {suggestion.suggestion_list.map(
                    (suggestionItem, suggIndex) => {
                      return (
                        <option
                          key={`option-${suggIndex}`}
                          value={JSON.stringify(suggestionItem)}
                        >
                          {`${
                            suggestionItem.text
                          }${suggestionItem.value_label &&
                            ` (${suggestionItem.value_label})`}`}
                        </option>
                      )
                    }
                  )}
                  <option
                    key="original-option"
                    value={JSON.stringify({ text: replaceWord })}
                  >
                    {replaceWord}
                  </option>
                </select>
                <IoIosCloseCircleOutline
                  className="chata-safety-net-delete-button"
                  onClick={() => {
                    this.deleteSafetyNetSuggestion(index)
                  }}
                />
              </div>
            )
          }
          return null
        })}
      </span>
    )

    return (
      <Fragment>
        <span
        // className="chata-safety-net-response-template"
        >
          Before I can try to find your answer, I need your help understanding a
          term you used that I don't see in your data. Click the dropdown to
          view suggestions so I can ensure you get the right data!
        </span>
        <br />
        <br />
        <span
        // className="chata-safety-net-result"
        >
          {safetyNetQuery}
          <br />
          <button
            className="chata-safety-net-execute-btn"
            onClick={() => {
              let safetyNetQuery = ''
              this.state.safetyNetQueryArray.forEach(element => {
                safetyNetQuery = safetyNetQuery.concat(element.value)
              })
              this.props.onSuggestionClick(safetyNetQuery)
            }}
          >
            <MdPlayCircleOutline className="chata-execute-query-icon" />
            Run Query
          </button>
        </span>
      </Fragment>
    )
  }

  formatColumnsForTable = columns => {
    const formattedColumns = columns.map((col, i) => {
      col.field = `${i}`
      col.align = 'center'
      col.formatter = undefined

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

    if (responseBody.full_suggestion) {
      // process safety net response
      // this.initializeSafetyNetOptions(responseBody)
      return this.renderSafetyNetMessage()
    } else if (this.state.activeDisplayType) {
      self.displayType = this.state.activeDisplayType
      // self.supportedDisplayTypes = responseBody.supported_display_types
      self.columns = responseBody.columns
      self.queryID = responseBody.query_id
      self.filters = responseBody.filters
      self.answer = responseBody.answer
      self.data = responseBody.data

      if (
        self.displayType === 'suggestion' ||
        self.displayType === 'unknown_words'
      ) {
        return this.renderSuggestionMessage()
      } else if (self.displayType === 'help') {
        return this.renderHelpResponse()
      } else if (this.isTableType(self.displayType)) {
        return this.renderTable()
      } else if (this.isChartType(self.displayType)) {
        return this.renderChart()
      }
    } else if (responseBody.data && !responseBody.data.length) {
      return 'No data found.'
    }
    console.log('No render type was found... why? Was there an error?')
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
