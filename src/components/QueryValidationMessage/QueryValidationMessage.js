import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { cloneDeep } from 'lodash'

import { Icon } from '../Icon'
import { Select } from '../Select'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { Button } from '../Button'

export default class QueryValidationMessage extends React.Component {
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
    queryValidationQueryArray: [],
    selectedSuggestions: undefined,
  }

  componentDidMount = () => {
    if (this.props?.response?.data) {
      this.initializeQueryValidationOptions(this.props.response.data)
    }
  }

  getSuggestionLists = (query, replacements) => {
    const suggestionLists = []
    if (replacements.length) {
      replacements.forEach((suggestionInfo) => {
        const originalWord = query.slice(suggestionInfo.start, suggestionInfo.end)

        // Add ID to each original suggestion
        const originalSuggestionList = suggestionInfo.suggestions.map((suggestion) => {
          return {
            id: uuid(),
            hidden: false,
            ...suggestion,
          }
        })

        // Add original query value to suggestion list
        const list = [...originalSuggestionList, { id: uuid(), text: originalWord }]

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
        !this.suggestionLists[index].find((suggestion) => suggestion.text === selection.text)
      ) {
        isValid = false
      }
    })
    return isValid
  }

  updateStartAndEndIndexes = (selectedSuggestions) => {
    if (!selectedSuggestions?.length) {
      return
    }

    let queryValidationQueryString = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      queryValidationQueryString = queryValidationQueryString.concat(word)
      const suggestion = selectedSuggestions[dropdownIndex]

      if (suggestion && !suggestion.hidden) {
        const startIndex = queryValidationQueryString.length
        suggestion.start = startIndex
        suggestion.end = startIndex + suggestion.text.length
        queryValidationQueryString = queryValidationQueryString.concat(suggestion.text)
      }
    })
  }

  setInitialSelections = () => {
    let selectedSuggestions

    if (this.props.initialSelections && this.isInitialSelectionValid()) {
      // Replace IDs with new ones from user
      this.suggestionLists.forEach((suggestionList, index) => {
        suggestionList.find((suggestion) => suggestion.text === this.props.initialSelections[index].text).id =
          this.props.initialSelections[index].id || uuid()
      })

      selectedSuggestions = this.props.initialSelections
    } else if (this.props.autoSelectSuggestion) {
      // Use first suggestion in list
      selectedSuggestions = this.suggestionLists.map((suggestionList) => suggestionList[0])
    } else {
      // Use original query (last value)
      selectedSuggestions = this.suggestionLists.map((suggestionList) => suggestionList[suggestionList.length - 1])
    }

    this.updateStartAndEndIndexes(selectedSuggestions)
    this.setState({ selectedSuggestions: cloneDeep(selectedSuggestions) })
  }

  initializeQueryValidationOptions = (responseBody) => {
    const { replacements, query } = responseBody.data
    const sortedReplacements = replacements.sort((a, b) => {
      return a.start - b.start
    })

    if (!sortedReplacements || !query) {
      return []
    }

    // Gets list of suggestions with value labels for each "dropdown"
    // and also includes the original query at the end of this list
    this.suggestionLists = this.getSuggestionLists(query, sortedReplacements)

    // Gets list of text from the query that are not part of the suggestions
    this.plainTextList = this.getPlainTextList(query, sortedReplacements)

    // Set initial validation selection values based on props
    this.setInitialSelections()
  }

  onChangeQueryValidationSelectOption = (suggestionId, index) => {
    if (suggestionId === 'remove-word') {
      this.deleteQueryValidationSuggestion(index)
      return
    }

    const newSuggestion = this.suggestionLists[index].find((suggestion) => suggestion.id === suggestionId)
    const newSelectedSuggestions = cloneDeep(this.state.selectedSuggestions)
    newSelectedSuggestions[index] = newSuggestion

    // If user provided callback for validation selection
    this.props.onQueryValidationSelectOption(
      this.getQueryValidationQueryText(newSelectedSuggestions),
      newSelectedSuggestions,
    )

    this.updateStartAndEndIndexes(newSelectedSuggestions)
    this.setState({ selectedSuggestions: cloneDeep(newSelectedSuggestions) })
  }

  deleteQueryValidationSuggestion = (suggestionIndex) => {
    const newSelectedSuggestions = cloneDeep(
      this.state.selectedSuggestions.map((suggestion, index) => {
        if (index === suggestionIndex) {
          return {
            ...suggestion,
            hidden: true,
          }
        }
        return suggestion
      }),
    )

    // Update list in callback
    this.props.onQueryValidationSelectOption(
      this.getQueryValidationQueryText(newSelectedSuggestions),
      newSelectedSuggestions,
    )

    this.updateStartAndEndIndexes(newSelectedSuggestions)
    this.setState({
      selectedSuggestions: cloneDeep(newSelectedSuggestions),
    })
  }

  renderWordSelector = (suggestionDropdownIndex) => {
    const suggestion = cloneDeep(this.state.selectedSuggestions[suggestionDropdownIndex])
    if (!suggestion || suggestion.hidden) {
      return null
    }

    const wordList = this.suggestionLists[suggestionDropdownIndex]
    const options = []

    wordList.forEach((suggestionItem, i) => {
      if (!suggestionItem?.text) {
        return
      }

      const option = {
        value: suggestionItem.id,
        label: suggestionItem.text,
      }

      // The last word is the original suggestion, append "original word" to the list label
      if (i === wordList.length - 1) {
        option.listLabel = (
          <span>
            {option.label} <em>(Original term)</em>
          </span>
        )
      } else {
        option.listLabel = (
          <span>
            {suggestionItem.text}
            {suggestionItem.value_label ? <em> ({suggestionItem.value_label})</em> : null}
          </span>
        )
      }

      options.push(option)
    })

    options.push({
      value: 'remove-word',
      label: (
        <span>
          <Icon type='trash' /> Remove term
        </span>
      ),
    })

    return (
      <div className='react-autoql-query-validation-selector-container' key={`query-element-${suggestion.id}`}>
        <Select
          options={options}
          key={uuid()}
          value={suggestion.id}
          className='react-autoql-query-validation-select'
          popupClassname='query-validation-select'
          outlined={false}
          showArrow={false}
          onChange={(value) => this.onChangeQueryValidationSelectOption(value, suggestionDropdownIndex)}
        />
      </div>
    )
  }

  renderQueryValidationQuery = () => {
    return (
      <div className='react-autoql-query-validation-query'>
        {this.plainTextList.map((textValue, index) => {
          const textElement = <span key={`query-element-${index}`}>{textValue}</span>
          const suggestionElement = this.renderWordSelector(index)

          return (
            <span key={uuid()}>
              {textElement}
              {suggestionElement}
            </span>
          )
        })}
      </div>
    )
  }

  getQueryValidationQueryText = (newSelectedSuggestions) => {
    let queryValidationQueryText = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      queryValidationQueryText = queryValidationQueryText.concat(word)
      const suggestion = newSelectedSuggestions[dropdownIndex]
      if (suggestion && !suggestion.hidden) {
        queryValidationQueryText = queryValidationQueryText.concat(suggestion.text)
      }
    })

    return queryValidationQueryText
  }

  renderResponse = () => {
    if (!this.state.selectedSuggestions || !this.state.selectedSuggestions.length) {
      return null
    }

    return (
      <div className='react-autoql-query-validation-container'>
        <div className='react-autoql-query-validation-description'>
          <span>
            {this.props.message ||
              'I need your help matching a term you used to the exact corresponding term in your database. Verify by selecting the correct term from the menu below:'}
          </span>
        </div>
        <div>
          {this.renderQueryValidationQuery()}
          <div className='react-autoql-query-validation-execute-btn-container'>
            <Button
              className='react-autoql-query-validation-execute-btn'
              onClick={() => {
                this.props.onSuggestionClick({
                  query: this.getQueryValidationQueryText(this.state.selectedSuggestions),
                  userSelection: this.state.selectedSuggestions,
                  scope: this.props.scope,
                })
              }}
              icon={this.props.submitIcon || 'play'}
            >
              {this.props.submitText || 'Run Query'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='react-autoql-response-content-container'>{this.renderResponse()}</div>
      </ErrorBoundary>
    )
  }
}
