import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import { IoIosCloseCircleOutline } from 'react-icons/io'
import { MdPlayCircleOutline } from 'react-icons/md'

export default class SafetyNetMessage extends React.Component {
  originalReplaceWords = []
  suggestionLists = []

  static propTypes = {
    response: PropTypes.shape({}).isRequired,
    onSuggestionClick: PropTypes.func.isRequired,
    autoSelectSuggestion: PropTypes.bool.isRequired,
    isQueryRunning: PropTypes.bool,
    initialSelections: PropTypes.arrayOf(PropTypes.shape({})),
    onSafetyNetSelectOption: PropTypes.func.isRequired
  }

  static defaultProps = {
    initialSelections: undefined,
    isQueryRunning: false
  }

  state = {
    safetyNetQueryArray: [],
    selectedSuggestions: undefined
  }

  componentDidMount = () => {
    if (this.props.response && this.props.response.data) {
      this.initializeSafetyNetOptions(this.props.response.data)
    }
  }

  getSuggestionLists = (query, fullSuggestions) => {
    const suggestionLists = []
    if (fullSuggestions.length) {
      fullSuggestions.forEach(suggestionInfo => {
        const originalWord = query.slice(
          suggestionInfo.start,
          suggestionInfo.end
        )

        // Add ID to each original suggestion
        const originalSuggestionList = suggestionInfo.suggestion_list.map(
          suggestion => {
            return {
              id: uuid.v4(),
              hidden: false,
              ...suggestion
            }
          }
        )

        // Add original query value to suggestion list
        const list = [
          ...originalSuggestionList,
          { id: uuid.v4(), text: originalWord }
        ]

        suggestionLists.push(list)
      })
    }
    return suggestionLists
  }

  getPlainTextList = (query, fullSuggestions) => {
    const textList = []
    let lastEndIndex = 0

    fullSuggestions.forEach((fullSuggestion, index) => {
      textList.push(query.slice(lastEndIndex, fullSuggestion.start))
      // textList.push(query.slice(fullSuggestion.start, fullSuggestion.end))
      if (index === fullSuggestions.length - 1) {
        textList.push(query.slice(fullSuggestion.end, query.length))
      }
      lastEndIndex = fullSuggestion.end
    })

    return textList
  }

  isInitialSelectionValid = () => {
    let isValid = true

    if (this.props.initialSelections.length !== this.suggestionLists.length) {
      isValid = false
    }

    this.props.initialSelections.forEach((selection, index) => {
      if (
        !this.suggestionLists[index].find(
          suggestion => suggestion.text === selection.text
        )
      ) {
        isValid = false
      }
    })
    return isValid
  }

  setInitialSelections = () => {
    if (this.props.initialSelections && this.isInitialSelectionValid()) {
      // Replace IDs with new ones from user
      this.suggestionLists.forEach((suggestionList, index) => {
        suggestionList.find(
          suggestion =>
            suggestion.text === this.props.initialSelections[index].text
        ).id = this.props.initialSelections[index].id || uuid.v4()
      })

      this.setState({
        selectedSuggestions: this.props.initialSelections
      })
    } else if (this.props.autoSelectSuggestion) {
      // Use first suggestion in list
      this.setState({
        selectedSuggestions: this.suggestionLists.map(
          suggestionList => suggestionList[0]
        )
      })
    } else {
      // Use original query (last value)
      this.setState({
        selectedSuggestions: this.suggestionLists.map(
          suggestionList => suggestionList[suggestionList.length - 1]
        )
      })
    }
  }

  initializeSafetyNetOptions = responseBody => {
    const { full_suggestion: fullSuggestions, query } = responseBody
    if (!fullSuggestions || !query) {
      return []
    }

    // Gets list of suggestions with value labels for each "dropdown"
    // and also includes the original query at the end of this list
    this.suggestionLists = this.getSuggestionLists(query, fullSuggestions)

    // Gets list of text from the query that are not part of the suggestions
    this.plainTextList = this.getPlainTextList(query, fullSuggestions)

    // Set initial safetynet selection values based on props
    this.setInitialSelections()
  }

  onChangeSafetyNetSelectOption = (suggestionId, index) => {
    const newSuggestion = this.suggestionLists[index].find(
      suggestion => suggestion.id === suggestionId
    )
    const newSelectedSuggestions = [...this.state.selectedSuggestions]
    newSelectedSuggestions[index] = newSuggestion

    // If user provided callback for safetynet selection
    this.props.onSafetyNetSelectOption(
      this.getSafetyNetQueryText(newSelectedSuggestions),
      newSelectedSuggestions
    )

    this.setState({ selectedSuggestions: newSelectedSuggestions })
  }

  deleteSafetyNetSuggestion = suggestionIndex => {
    const newSelectedSuggestions = this.state.selectedSuggestions.map(
      (suggestion, index) => {
        if (index === suggestionIndex) {
          return {
            ...suggestion,
            hidden: true
          }
        }
        return suggestion
      }
    )

    // Update list in callback
    this.props.onSafetyNetSelectOption(
      this.getSafetyNetQueryText(newSelectedSuggestions),
      newSelectedSuggestions
    )

    this.setState({
      selectedSuggestions: newSelectedSuggestions
    })
  }

  getSuggestionElement = suggestionDropdownIndex => {
    const suggestion = this.state.selectedSuggestions[suggestionDropdownIndex]
    if (!suggestion || suggestion.hidden) {
      return null
    }

    // Create temporary div to autosize select element
    // to the suggestion length
    const suggestionText = `${suggestion.text}${
      suggestion.value_label ? ` (${suggestion.value_label})` : ''
    }`
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
        key={`query-element-${suggestion.id}`}
      >
        <select
          key={uuid.v4()}
          value={suggestion.id}
          className="chata-safetynet-select"
          style={{ width: selectWidth }}
          onChange={e =>
            this.onChangeSafetyNetSelectOption(
              e.target.value,
              suggestionDropdownIndex
            )
          }
        >
          {this.suggestionLists[suggestionDropdownIndex].map(suggestionItem => {
            return (
              <option key={suggestionItem.id} value={suggestionItem.id}>
                {`${suggestionItem.text}${
                  suggestionItem.value_label
                    ? ` (${suggestionItem.value_label})`
                    : ''
                }`}
              </option>
            )
          })}
        </select>
        <IoIosCloseCircleOutline
          className="chata-safety-net-delete-button"
          onClick={() => {
            this.deleteSafetyNetSuggestion(suggestionDropdownIndex)
          }}
        />
      </div>
    )
  }

  renderSafetyNetQuery = () => {
    return (
      <div className="chata-safety-net-query">
        {this.plainTextList.map((textValue, index) => {
          const textElement = (
            <span key={`query-element-${index}`}>{textValue}</span>
          )
          let suggestionElement = this.getSuggestionElement(index)

          return (
            <span key={uuid.v4()}>
              {textElement}
              {suggestionElement}
            </span>
          )
        })}
      </div>
    )
  }

  getSafetyNetQueryText = newSelectedSuggestions => {
    let safetyNetQueryText = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      safetyNetQueryText = safetyNetQueryText.concat(word)
      const suggestion = newSelectedSuggestions[dropdownIndex]
      if (suggestion && !suggestion.hidden) {
        safetyNetQueryText = safetyNetQueryText.concat(suggestion.text)
      }
    })

    return safetyNetQueryText
  }

  renderResponse = () => {
    if (
      !this.state.selectedSuggestions ||
      !this.state.selectedSuggestions.length
    ) {
      return null
    }

    return (
      <div className="chata-safety-net-container">
        <div className="chata-safety-net-description">
          Before I can try to find your answer, I need your help understanding a
          term you used that I don't see in your data. Click the dropdown to
          view suggestions so I can ensure you get the right data!
        </div>
        <span>
          {this.renderSafetyNetQuery()}
          <button
            className="chata-safety-net-execute-btn"
            onClick={() => {
              this.props.onSuggestionClick(
                this.getSafetyNetQueryText(this.state.selectedSuggestions)
              )
            }}
          >
            <MdPlayCircleOutline className="chata-execute-query-icon" />
            Run Query
          </button>
        </span>
      </div>
    )
  }

  render = () => {
    return (
      <div className="chata-response-content-container">
        {this.renderResponse()}
      </div>
    )
  }
}
