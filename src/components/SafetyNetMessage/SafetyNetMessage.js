import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'

import { Icon } from '../Icon'
import { Select } from '../Select'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

export default class SafetyNetMessage extends React.Component {
  originalReplaceWords = []
  suggestionLists = []

  static propTypes = {
    themeConfig: themeConfigType,
    response: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    autoSelectSuggestion: PropTypes.bool,
    isQueryRunning: PropTypes.bool,
    initialSelections: PropTypes.arrayOf(PropTypes.shape({})),
    onQueryValidationSelectOption: PropTypes.func,
    message: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
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

  getSuggestionLists = (query, replacements) => {
    const suggestionLists = []
    if (replacements.length) {
      replacements.forEach((suggestionInfo) => {
        const originalWord = query.slice(
          suggestionInfo.start,
          suggestionInfo.end
        )

        // Add ID to each original suggestion
        const originalSuggestionList = suggestionInfo.suggestions.map(
          (suggestion) => {
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
          (suggestion) => suggestion.text === selection.text
        )
      ) {
        isValid = false
      }
    })
    return isValid
  }

  updateStartAndEndIndexes = (selectedSuggestions) => {
    if (!_get(selectedSuggestions, 'length')) {
      return
    }

    let safetyNetQueryString = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      safetyNetQueryString = safetyNetQueryString.concat(word)
      const suggestion = selectedSuggestions[dropdownIndex]

      if (suggestion && !suggestion.hidden) {
        const startIndex = safetyNetQueryString.length
        suggestion.start = startIndex
        suggestion.end = startIndex + suggestion.text.length
        safetyNetQueryString = safetyNetQueryString.concat(suggestion.text)
      }
    })
  }

  setInitialSelections = () => {
    let selectedSuggestions

    if (this.props.initialSelections && this.isInitialSelectionValid()) {
      // Replace IDs with new ones from user
      this.suggestionLists.forEach((suggestionList, index) => {
        suggestionList.find(
          (suggestion) =>
            suggestion.text === this.props.initialSelections[index].text
        ).id = this.props.initialSelections[index].id || uuid.v4()
      })

      selectedSuggestions = this.props.initialSelections
    } else if (this.props.autoSelectSuggestion) {
      // Use first suggestion in list
      selectedSuggestions = this.suggestionLists.map(
        (suggestionList) => suggestionList[0]
      )
    } else {
      // Use original query (last value)
      selectedSuggestions = this.suggestionLists.map(
        (suggestionList) => suggestionList[suggestionList.length - 1]
      )
    }

    this.updateStartAndEndIndexes(selectedSuggestions)
    this.setState({ selectedSuggestions: _cloneDeep(selectedSuggestions) })
  }

  initializeSafetyNetOptions = (responseBody) => {
    const { replacements, query } = responseBody.data
    if (!replacements || !query) {
      return []
    }

    // Gets list of suggestions with value labels for each "dropdown"
    // and also includes the original query at the end of this list
    this.suggestionLists = this.getSuggestionLists(query, replacements)

    // Gets list of text from the query that are not part of the suggestions
    this.plainTextList = this.getPlainTextList(query, replacements)

    // Set initial safetynet selection values based on props
    this.setInitialSelections()
  }

  onChangeSafetyNetSelectOption = (suggestionId, index) => {
    if (suggestionId === 'remove-word') {
      this.deleteSafetyNetSuggestion(index)
      return
    }

    const newSuggestion = this.suggestionLists[index].find(
      (suggestion) => suggestion.id === suggestionId
    )
    const newSelectedSuggestions = _cloneDeep(this.state.selectedSuggestions)
    newSelectedSuggestions[index] = newSuggestion

    // If user provided callback for safetynet selection
    this.props.onQueryValidationSelectOption(
      this.getSafetyNetQueryText(newSelectedSuggestions),
      newSelectedSuggestions
    )

    this.updateStartAndEndIndexes(newSelectedSuggestions)
    this.setState({ selectedSuggestions: _cloneDeep(newSelectedSuggestions) })
  }

  deleteSafetyNetSuggestion = (suggestionIndex) => {
    const newSelectedSuggestions = _cloneDeep(
      this.state.selectedSuggestions.map((suggestion, index) => {
        if (index === suggestionIndex) {
          return {
            ...suggestion,
            hidden: true,
          }
        }
        return suggestion
      })
    )

    // Update list in callback
    this.props.onQueryValidationSelectOption(
      this.getSafetyNetQueryText(newSelectedSuggestions),
      newSelectedSuggestions
    )

    this.updateStartAndEndIndexes(newSelectedSuggestions)
    this.setState({
      selectedSuggestions: _cloneDeep(newSelectedSuggestions),
    })
  }

  renderWordSelector = (suggestionDropdownIndex) => {
    const suggestion = _cloneDeep(
      this.state.selectedSuggestions[suggestionDropdownIndex]
    )
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
        className="react-autoql-safety-net-selector-container"
        key={`query-element-${suggestion.id}`}
      >
        <Select
          themeConfig={getThemeConfig(this.props.themeConfig)}
          options={options}
          key={uuid.v4()}
          value={suggestion.id}
          className="react-autoql-safetynet-select"
          popupClassname="safetynet-select"
          // style={{ width: selectWidth }}
          onChange={(value) =>
            this.onChangeSafetyNetSelectOption(value, suggestionDropdownIndex)
          }
        />
      </div>
    )
  }

  renderSafetyNetQuery = () => {
    return (
      <div className="react-autoql-safety-net-query">
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

  getSafetyNetQueryText = (newSelectedSuggestions) => {
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
      <div className="react-autoql-safety-net-container">
        <div className="react-autoql-safety-net-description">
          {this.props.message ||
            `I need your help matching a term you used to the exact corresponding term in your database. Verify by selecting the correct term from the menu below:`}
        </div>
        <span>
          {this.renderSafetyNetQuery()}
          <button
            className="react-autoql-safety-net-execute-btn"
            onClick={() => {
              this.props.onSuggestionClick({
                query: this.getSafetyNetQueryText(
                  this.state.selectedSuggestions
                ),
                userSelection: this.state.selectedSuggestions,
              })
            }}
          >
            <Icon
              type={this.props.submitIcon || 'play'}
              className="react-autoql-execute-query-icon"
            />
            {this.props.submitText || 'Run Query'}
          </button>
        </span>
      </div>
    )
  }

  render = () => {
    return (
      <div className="react-autoql-response-content-container">
        {this.renderResponse()}
      </div>
    )
  }
}
