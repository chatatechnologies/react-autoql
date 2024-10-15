import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import sanitizeHtml from 'sanitize-html'
import { cloneDeep } from 'lodash'
import ContentEditable from 'react-contenteditable'
import { runQueryValidation, setCaretPosition, authenticationDefault, getAuthentication } from 'autoql-fe-utils'

import { Select } from '../Select'
import { Popover } from '../Popover'

import { authenticationType } from '../../props/types'

import './QueryInputWithValidation.scss'

export default class QueryValidationMessage extends React.Component {
  COMPONENT_KEY = `query-input-with-validation-${uuid()}`
  POPOVER_TRIGGER_KEY = `validation-popover-trigger-${uuid()}`
  originalReplaceWords = []
  suggestionLists = []

  constructor() {
    super()
    this.contentEditable = React.createRef()
    this.state = {
      html: '',
      validationQueryArray: [],
      selectedSuggestions: undefined,
    }
  }

  static propTypes = {
    authentication: authenticationType,

    response: PropTypes.shape({}),
    onSuggestionClick: PropTypes.func,
    autoSelectSuggestion: PropTypes.bool,
    isQueryRunning: PropTypes.bool,
    initialSelections: PropTypes.arrayOf(PropTypes.shape({})),
    onQueryValidationSelectOption: PropTypes.func,
    message: PropTypes.string,
    placeholder: PropTypes.string,
    showChataIcon: PropTypes.bool,
    showLoadingDots: PropTypes.bool,
    submitQuery: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    response: undefined,
    autoSelectSuggestion: false,
    initialSelections: undefined,
    isQueryRunning: false,
    message: undefined,
    onSuggestionClick: () => {},
    onQueryValidationSelectOption: () => {},
    placeholder: 'Type your queries here',
    showChataIcon: false,
    showLoadingDots: false,
    submitQuery: () => {},
  }

  componentDidMount = () => {
    if (this.props?.response?.data) {
      this.initializeQueryValidationOptions(this.props.response.data)
    }
  }

  componentDidUpdate = () => {
    const validationSelectElements = document.querySelectorAll(`#${this.COMPONENT_KEY} .validation-selector-element`)

    if (validationSelectElements?.length) {
      const elements = [...validationSelectElements]
      elements.forEach((el) => {
        el.removeEventListener('click', this.onQueryValidationTriggerClick)
        el.addEventListener('click', this.onQueryValidationTriggerClick)
      })
    }
  }

  onQueryValidationTriggerClick = (e) => {
    const popoverTrigger = document.querySelector(`#${this.POPOVER_TRIGGER_KEY}`)
    if (popoverTrigger) {
      popoverTrigger.style.left = '0px'
      popoverTrigger.style.top = '0px'
      this.validationSelectorLocation = {
        top: e.clientY,
        left: e.clientX,
      }

      this.validationSelectorIndex = Number(e.target.getAttribute('data-index'))
      const clientRect = popoverTrigger.getBoundingClientRect()
      const clientX = clientRect.left
      const clientY = clientRect.top
      const left = e.clientX - clientX
      const top = e.clientY - clientY

      popoverTrigger.style.left = `${left}px`
      popoverTrigger.style.top = `${top}px`
      popoverTrigger.click()
    }
  }

  // ================================ QUERY_VALIDATION =======================================
  // todo: centralize these functions so we can use them in both here and QueryValidationMessage

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
    let textList = []
    let lastEndIndex = 0

    fullSuggestions.forEach((fullSuggestion, index) => {
      textList.push(query.slice(lastEndIndex, fullSuggestion.start))
      if (index === fullSuggestions.length - 1) {
        textList.push(query.slice(fullSuggestion.end, query.length))
      }
      lastEndIndex = fullSuggestion.end
    })

    if (!textList.length) {
      textList = [this.state.inputText]
    }

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

    let validationQueryString = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      validationQueryString = validationQueryString.concat(word)
      const suggestion = selectedSuggestions[dropdownIndex]

      if (suggestion && !suggestion.hidden) {
        const startIndex = validationQueryString.length
        suggestion.start = startIndex
        suggestion.end = startIndex + suggestion.text.length
        validationQueryString = validationQueryString.concat(suggestion.text)
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
    this.setState({ selectedSuggestions: cloneDeep(selectedSuggestions) }, () => {
      setCaretPosition(this.inputRef, 5)
    })
  }

  initializeQueryValidationOptions = (responseBody) => {
    const { replacements, query } = responseBody.data
    if (!replacements || !query) {
      return []
    }

    // Gets list of suggestions with value labels for each "dropdown"
    // and also includes the original query at the end of this list
    this.suggestionLists = this.getSuggestionLists(query, replacements)

    // Gets list of text from the query that are not part of the suggestions
    this.plainTextList = this.getPlainTextList(query, replacements)

    // Set initial validation selection values based on props
    this.setInitialSelections()
  }

  onChangeQueryValidationSelectOption = (suggestionId) => {
    const index = this.validationSelectorIndex
    const newSuggestion = this.suggestionLists[index].find((suggestion) => suggestion.id === suggestionId)
    const newSelectedSuggestions = cloneDeep(this.state.selectedSuggestions)
    newSelectedSuggestions[index] = newSuggestion

    // If user provided callback for validation selection
    this.props.onQueryValidationSelectOption(
      this.getQueryValidationQueryText(newSelectedSuggestions),
      newSelectedSuggestions,
    )

    this.updateStartAndEndIndexes(newSelectedSuggestions)
    this.setState({ selectedSuggestions: cloneDeep(newSelectedSuggestions) }, () => {
      // this.moveCaretAtEnd()
    })
  }

  getWordSelectorOptions = (suggestionDropdownIndex) => {
    const suggestion = cloneDeep(this.state.selectedSuggestions[suggestionDropdownIndex])
    if (!suggestion || suggestion.hidden) {
      return []
    }

    const wordList = this.suggestionLists[suggestionDropdownIndex]

    const options = wordList.map((suggestionItem, i) => {
      const option = {
        value: suggestionItem.id,
        label: suggestionItem.text,
      }

      // The last word is the original suggestion, append "original word" to the list label
      if (i === wordList.length - 1) {
        // option.listLabel = `${option.label} (Original term)`
        option.listLabel = `${option.label}`
      } else {
        option.listLabel = `${suggestionItem.text}${
          suggestionItem.value_label ? ` (${suggestionItem.value_label})` : ''
        }`
      }

      return option
    })

    return options
  }

  renderWordSelector = (suggestionDropdownIndex) => {
    const suggestion = cloneDeep(this.state.selectedSuggestions[suggestionDropdownIndex])
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

    return (
      <div
        className={`react-autoql-query-validation-selector-container
          ${this.props.showChataIcon ? ' left-padding' : ''}`}
        key={`query-element-${suggestion.id}`}
      >
        <Select
          options={options}
          key={uuid()}
          value={suggestion.id}
          className='react-autoql-query-validation-select'
          popupClassname='validation-select'
          // style={{ width: selectWidth }}
          onChange={(value) => this.onChangeQueryValidationSelectOption(value, suggestionDropdownIndex)}
        />
      </div>
    )
  }

  getQueryValidationQueryText = (newSelectedSuggestions) => {
    const selectedSuggestions = newSelectedSuggestions || this.state.selectedSuggestions

    if (!selectedSuggestions?.length) {
      return this.getPlainTextFromHTML(this.state.html)
    }

    let validationQueryText = ''
    this.plainTextList.forEach((word, dropdownIndex) => {
      validationQueryText = validationQueryText.concat(word)
      const suggestion = selectedSuggestions[dropdownIndex]
      if (suggestion && !suggestion.hidden) {
        validationQueryText = validationQueryText.concat(suggestion.text)
      }
    })

    return validationQueryText
  }

  // ==================================== Input =========================================
  focus = () => {
    if (this.contentEditable?.current) {
      this.contentEditable.current.focus()
    }
    // todo: Autocomplete stuff
    // else {
    //   // Autocomplete option
    //   const autoSuggestElement = document.getElementsByClassName(
    //     `${this.UNIQUE_ID}`
    //   )
    //   if (autoSuggestElement && autoSuggestElement[0]) {
    //     autoSuggestElement[0].focus()
    //   }
    // }
  }

  getPlainTextFromHTML = (html) => {
    const elementToGetText = document.createElement('div')
    elementToGetText.innerHTML = html
    return elementToGetText.innerText
  }

  // TODO - debounce
  runQueryValidation = ({ text }) => {
    runQueryValidation({
      text,
      ...getAuthentication(this.props.authentication),
    })
      .then((response) => {
        const currentQuery = this.getPlainTextFromHTML(this.state.html)
        const newQuery = response?.data?.data?.query

        if (this.isNewQueryAppendedToOldQuery(newQuery, currentQuery) && response?.data?.data?.replacements?.length) {
          this.initializeQueryValidationOptions(cloneDeep(response.data))
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  moveCaretAtEnd = (e) => {
    var temp_value = e.target.innerHTML
    e.target.innerHTML = ''
    e.target.innerHTML = temp_value
  }

  sanitize = (html) => {
    const sanitizeConf = {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'span'],
      allowedAttributes: { a: ['href'] },
    }

    return sanitizeHtml(html, sanitizeConf)
  }

  replaceNbsps = (str) => {
    if (!str) {
      return str
    }

    const nbsps = new RegExp(String.fromCharCode(160), 'g')
    return str.replace(nbsps, ' ')
  }

  isNewQueryAppendedToOldQuery = (newQuery, oldQuery) => {
    if (!oldQuery) {
      return true
    }

    if (!newQuery) {
      return false
    }

    const newQueryText = this.replaceNbsps(newQuery)
    const oldQueryText = this.replaceNbsps(oldQuery)
    return newQueryText.substr(0, oldQueryText.length) === oldQueryText || newQueryText === oldQueryText
  }

  appendNewTextToPlainTextList = (newQuery, oldQuery) => {
    const appendedText = newQuery.substr(oldQuery.length)
    if (this.plainTextList?.length) {
      this.plainTextList[this.plainTextList.length - 1] =
        this.plainTextList[this.plainTextList.length - 1].concat(appendedText)
    }
    // else {
    //   this.plainTextList = [appendedText]
    // }
  }

  onInputChange = (e) => {
    const newPlainTextQuery = this.getPlainTextFromHTML(e.target.value)
    const oldPlainTextQuery = this.getPlainTextFromHTML(this.state.html)
    const isNewQueryAppendedToOldQuery = this.isNewQueryAppendedToOldQuery(newPlainTextQuery, oldPlainTextQuery)

    if (isNewQueryAppendedToOldQuery) {
      // append text to end of plain text list
      this.appendNewTextToPlainTextList(newPlainTextQuery, oldPlainTextQuery)

      this.setState({
        html: this.sanitize(e.target.value),
        isValidationSelectorOpen: false,
      })
    } else {
      // Reset validation values to plain text since query changed
      this.plainTextList = undefined
      this.setState({
        html: newPlainTextQuery,
        validationQueryArray: [],
        selectedSuggestions: undefined,
        isValidationSelectorOpen: false,
      })
    }

    // todo: Autocomplete stuff
    // if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
    //   // keyup or keydown
    //   return // return to let the component handle it...
    // }

    if (e && e.target && (e.target.value || e.target.value === '')) {
      // Dont do anything, let query validation update the text
      this.runQueryValidation({ text: this.replaceNbsps(newPlainTextQuery) })
    }
    // todo: Autocomplete stuff
    // else {
    //   // User clicked on autosuggest item
    //   this.submitQuery({ queryText: this.userSelectedValue })
    // }
  }

  handleKeyDown = (e) => {
    if (e.key == 'Enter') {
      const html = this.getHTML()
      const queryText = this.getPlainTextFromHTML(html)
      this.props.submitQuery({ queryText, skipQueryValidation: true })
      return
    }

    if (e.key === 'ArrowUp' && !this.state.suggestions?.length) {
      this.getPlainTextFromHTML(localStorage.getItem('inputValue'))
    }

    if (e.key == 'Tab') {
      e.preventDefault()
      // loop through options for word from validation
    }
  }

  getHTML = () => {
    let html = this.state.html
    if (this.plainTextList?.length && this.state.selectedSuggestions?.length) {
      html = ''
      this.plainTextList.forEach((textValue, index) => {
        const textElement = `<span key="query-element-${index}">${textValue}</span>`
        // let suggestionElement = this.renderWordSelector(index)
        const suggestion = cloneDeep(this.state.selectedSuggestions[index])
        let suggestionElement = ''

        if (suggestion) {
          const suggestionText = suggestion.text
          const suggestionValueLabel = suggestion.value_label ? ` <em> (${suggestion.value_label})</em>` : ''
          suggestionElement = `<span class="validation-selector-element" data-index="${index}">${suggestionText}</span>`
        }

        html = html.concat(textElement, suggestionElement)
      })
    }
    return html
  }

  render = () => {
    // todo: do not calculate this every time
    // have it set in the state after initialization
    const html = this.getHTML()

    return (
      <>
        <ContentEditable
          data-test='safetynet-input-bar'
          id={this.COMPONENT_KEY}
          ref={(ref) => (this.inputRef = ref)}
          innerRef={this.contentEditable}
          className='query-input-with-validation'
          disabled={this.props.isDisabled}
          onChange={this.onInputChange}
          onKeyDown={this.handleKeyDown}
          data-placeholder={this.props.placeholder}
          onFocus={(e) => {
            // this.moveCaretAtEnd(e)
          }}
          spellCheck='false'
          autoComplete='one-time-code'
          autoCorrect='off'
          autoCapitalize='off'
          autoFocus={true}
          html={html}
        />

        <Popover
          isOpen={this.state.isValidationSelectorOpen}
          positions={['top']}
          padding={20}
          onClickOutside={(e) => {
            if (
              e.clientX !== this.validationSelectorLocation.left &&
              e.clientY !== this.validationSelectorLocation.top
            ) {
              this.setState({ isValidationSelectorOpen: false })
            }
          }}
          content={({ position, nudgedLeft, nudgedTop, targetRect, popoverRect }) => {
            const options = this.getWordSelectorOptions(this.validationSelectorIndex)
            return (
              <div className={'react-autoql-select-popup-container validation-select'}>
                <ul className='react-autoql-select-popup'>
                  {options.map((option) => {
                    return (
                      <li
                        key={`select-option-${this.ID}-${option.value}`}
                        className={`react-autoql-menu-item${option.value === this.props.value ? ' active' : ''}`}
                        onClick={() => {
                          this.setState({ isValidationSelectorOpen: false })
                          this.onChangeQueryValidationSelectOption(option.value)
                        }}
                        data-tooltip-html={option.tooltip || null}
                        data-tooltip-id={`select-tooltip-${this.ID}`}
                      >
                        {option.listLabel || option.label}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          }}
        >
          <div
            id={this.POPOVER_TRIGGER_KEY}
            onClick={(e) => {
              this.setState({ isValidationSelectorOpen: true })
            }}
            style={{ position: 'absolute' }}
          />
        </Popover>
      </>
    )
  }
}
