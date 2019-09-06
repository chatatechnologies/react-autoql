import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import { IoIosCloseCircleOutline } from 'react-icons/io'
import { MdPlayCircleOutline } from 'react-icons/md'

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement)
}

export default class SafetyNetMessage extends React.Component {
  static propTypes = {
    response: PropTypes.shape({}).isRequired,
    onSuggestionClick: PropTypes.func.isRequired,
    isQueryRunning: PropTypes.bool
  }

  static defaultProps = {
    isQueryRunning: false
  }

  state = {
    safetyNetQueryArray: []
  }

  componentDidMount = () => {
    this.initializeSafetyNetOptions(this.props.response.data)
  }

  initializeSafetyNetOptions = responseBody => {
    const queryArray = []
    let lastEndIndex = 0
    const { full_suggestion: fullSuggestions, query } = responseBody

    // Do we need to sort or will it always be sent sorted?
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

  renderResponse = () => {
    const { response } = this.props
    const fullSuggestions = response.data.full_suggestion
    const { query } = response.data
    const queryArray = this.state.safetyNetQueryArray

    const safetyNetQuery = (
      <span>
        {queryArray.map((element, index) => {
          if (element.type === 'text' || element.value === '') {
            return <span key={`query-element-${index}`}>{element.value}</span>
          }

          const fullSuggestionIndex = Math.floor(index / 2)
          const suggestion = fullSuggestions[fullSuggestionIndex]

          if (suggestion) {
            const replaceWord = query.slice(suggestion.start, suggestion.end)

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
                          {`${suggestionItem.text}${
                            suggestionItem.value_label
                              ? ` (${suggestionItem.value_label})`
                              : ''
                          }`}
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
        <span>
          Before I can try to find your answer, I need your help understanding a
          term you used that I don't see in your data. Click the dropdown to
          view suggestions so I can ensure you get the right data!
        </span>
        <br />
        <br />
        <span>
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

  render = () => {
    return (
      <Fragment>
        <div className="chata-response-content-container">
          {this.renderResponse()}
        </div>
      </Fragment>
    )
  }
}
