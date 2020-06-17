import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import { Icon } from '../Icon'
import { Select } from '../Select'

export default class SafetyNetMessage extends React.Component {
  originalReplaceWords = []
  suggestionLists = []

  static propTypes = {
    response: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    autoSelectSuggestion: PropTypes.bool,
    isQueryRunning: PropTypes.bool,
    initialSelections: PropTypes.arrayOf(PropTypes.shape({})),
    onQueryValidationSelectOption: PropTypes.func,
    message: PropTypes.string,
  }

  static defaultProps = {
    response: undefined,
    autoSelectSuggestion: true,
    initialSelections: undefined,
    isQueryRunning: false,
    message: undefined,
    onSuggestionClick: () => {},
    onQueryValidationSelectOption: () => {},
  }

  state = {
    safetyNetQueryArray: [],
    selectedSuggestions: undefined,
  }

  componentDidMount = () => {
    if (_get(this.props, 'response.data')) {
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
              ...suggestion,
            }
          }
        )

        // Add original query value to suggestion list
        const list = [
          ...originalSuggestionList,
          { id: uuid.v4(), text: originalWord },
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
        !this.suggestionLists[index] ||
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
        selectedSuggestions: this.props.initialSelections,
      })
    } else if (this.props.autoSelectSuggestion) {
      // Use first suggestion in list
      this.setState({
        selectedSuggestions: this.suggestionLists.map(
          suggestionList => suggestionList[0]
        ),
      })
    } else {
      // Use original query (last value)
      this.setState({
        selectedSuggestions: this.suggestionLists.map(
          suggestionList => suggestionList[suggestionList.length - 1]
        ),
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
    if (suggestionId === 'remove-word') {
      this.deleteSafetyNetSuggestion(index)
    }

    const newSuggestion = this.suggestionLists[index].find(
      suggestion => suggestion.id === suggestionId
    )
    const newSelectedSuggestions = [...this.state.selectedSuggestions]
    newSelectedSuggestions[index] = newSuggestion

    // If user provided callback for safetynet selection
    this.props.onQueryValidationSelectOption(
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
            hidden: true,
          }
        }
        return suggestion
      }
    )

    // Update list in callback
    this.props.onQueryValidationSelectOption(
      this.getSafetyNetQueryText(newSelectedSuggestions),
      newSelectedSuggestions
    )

    this.setState({
      selectedSuggestions: newSelectedSuggestions,
    })
  }

  renderWordSelector = suggestionDropdownIndex => {
    const suggestion = this.state.selectedSuggestions[suggestionDropdownIndex]
    if (!suggestion || suggestion.hidden) {
      return null
    }

    const wordList = this.suggestionLists[suggestionDropdownIndex]

    const options = wordList.map((suggestionItem, i) => {
      const option = {
        value: suggestionItem.id,
        label: suggestionItem.text,
      }

      // The last word is the original suggestion, append "original word" to the list label
      if (i === wordList.length - 1) {
        option.listLabel = `${option.label} (Original term)`
      } else {
        option.listLabel = `${suggestionItem.text}${
          suggestionItem.value_label ? ` (${suggestionItem.value_label})` : ''
        }`
      }

      return option
    })

    options.push({
      value: 'remove-word',
      label: (
        <span>
          <Icon type="trash" /> Remove term
        </span>
      ),
    })

    return (
      <div
        className="chata-safety-net-selector-container"
        key={`query-element-${suggestion.id}`}
      >
        <Select
          options={options}
          key={uuid.v4()}
          value={suggestion.id}
          className="chata-safetynet-select"
          popupClassname="safetynet-select"
          // style={{ width: selectWidth }}
          onChange={value =>
            this.onChangeSafetyNetSelectOption(value, suggestionDropdownIndex)
          }
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
          let suggestionElement = this.renderWordSelector(index)

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
          {this.props.message ||
            `I need your help matching a term you used to the exact corresponding term in your database. Verify by selecting the correct term from the menu below:`}
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
            <Icon
              type={this.props.submitIcon || 'play'}
              className="chata-execute-query-icon"
            />
            {this.props.submitText || 'Run Query'}
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
