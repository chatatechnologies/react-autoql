import React, { Fragment } from 'react'
import { bool, string, func } from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType,
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault,
} from '../../props/defaults'

import { LIGHT_THEME, DARK_THEME } from '../../js/Themes'
import { setStyleVars } from '../../js/Util'

import { Icon } from '../Icon'
import {
  runQuery,
  runQueryOnly,
  fetchAutocomplete,
} from '../../js/queryService'
import Autosuggest from 'react-autosuggest'

import SpeechToTextButton from '../SpeechToTextButton/SpeechToTextButton.js'
import LoadingDots from '../LoadingDots/LoadingDots.js'

import './QueryInput.scss'

let autoCompleteArray = []

export default class QueryInput extends React.Component {
  UNIQUE_ID = uuid.v4()
  autoCompleteTimer = undefined

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,
    enableVoiceRecord: bool,
    isDisabled: bool,
    onSubmit: func,
    onResponseCallback: func,
    className: string,
    autoCompletePlacement: string,
    showLoadingDots: bool,
    showChataIcon: bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,
    enableVoiceRecord: false,
    isDisabled: false,
    autoCompletePlacement: 'above',
    className: null,
    showLoadingDots: true,
    showChataIcon: true,
    source: [],
    onSubmit: () => {},
    onResponseCallback: () => {},
  }

  state = {
    inputValue: '',
    lastQuery: '',
    suggestions: [],
    isQueryRunning: false,
  }

  componentDidMount = () => {
    const { theme } = this.props.themeConfig
    const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
    setStyleVars({ themeStyles, prefix: '--react-autoql-input-' })
  }

  componentDidUpdate = (prevProps) => {
    if (
      _get(prevProps, 'themeConfig.theme') !==
      _get(this.props, 'themeConfig.theme')
    ) {
      const { theme } = this.props.themeConfig
      const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
      setStyleVars({ themeStyles, prefix: '--react-autoql-input-' })
    }
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  animateInputTextAndSubmit = ({
    query,
    userSelection,
    skipSafetyNet,
    source,
  }) => {
    if (typeof query === 'string' && _get(query, 'length')) {
      for (let i = 1; i <= query.length; i++) {
        setTimeout(() => {
          this.setState({
            inputValue: query.slice(0, i),
          })
          if (i === query.length) {
            setTimeout(() => {
              this.submitQuery({
                queryText: query,
                userSelection,
                skipSafetyNet: true,
                source,
              })
            }, 300)
          }
        }, i * 50)
      }
    }
  }

  submitQuery = ({ queryText, userSelection, skipSafetyNet, source } = {}) => {
    // Cancel subscription to autocomplete since query was already submitted
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.setState({ isQueryRunning: true, suggestions: [] })
    const query = queryText || this.state.inputValue
    const newSource = [...this.props.source, source || 'user']

    if (query.trim()) {
      this.props.onSubmit(query)

      if (skipSafetyNet) {
        runQueryOnly({
          query,
          userSelection,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          source: newSource,
        })
          .then((response) => {
            this.props.onResponseCallback(response, query)
            this.setState({ isQueryRunning: false })
          })
          .catch((error) => {
            console.error(error)
            this.props.onResponseCallback(error)
            this.setState({ isQueryRunning: false })
          })
      } else {
        runQuery({
          query,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          source: newSource,
        })
          .then((response) => {
            this.props.onResponseCallback(response, query)
            this.setState({ isQueryRunning: false })
          })
          .catch((error) => {
            // If there is no error it did not make it past options
            // and this is usually due to an authentication error
            const finalError = error || {
              error: 'Unauthenticated',
            }
            this.props.onResponseCallback(finalError)
            this.setState({ isQueryRunning: false })
          })
      }
    }
    this.setState({ inputValue: '' })
  }

  onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && !_get(this.state.suggestions, 'length')) {
      this.setState({ inputValue: this.state.lastQuery })
    }
  }

  onKeyPress = (e) => {
    if (e.key == 'Enter') {
      this.setState({ lastQuery: this.state.inputValue })
      this.submitQuery()
    }
  }

  onTranscriptChange = (newTranscript) => {
    this.setState({ inputValue: newTranscript })
  }

  onFinalTranscript = () => {
    // Disabling auto submit for now
    // this.submitQuery()
    this.focus()
  }

  setInputRef = (ref) => {
    this.inputRef = ref
  }

  focus = () => {
    if (this.inputRef) {
      this.inputRef.focus()
    } else {
      const autoSuggestElement = document.getElementsByClassName(
        `${this.UNIQUE_ID}`
      )
      if (autoSuggestElement && autoSuggestElement[0]) {
        autoSuggestElement[0].focus()
      }
    }
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name
    ) {
      this.userSelectedValue = userSelectedValueFromSuggestionBox.name
      this.userSelectedSuggestion = true
      this.setState({ inputValue: userSelectedValueFromSuggestionBox.name })
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...this.props.authentication,
      })
        .then((response) => {
          const body = _get(response, 'data.data')

          const sortingArray = []
          let suggestionsMatchArray = []
          autoCompleteArray = []
          suggestionsMatchArray = body.matches
          for (let i = 0; i < suggestionsMatchArray.length; i++) {
            sortingArray.push(suggestionsMatchArray[i])

            if (i === 4) {
              break
            }
          }

          sortingArray.sort((a, b) => b.length - a.length)
          for (let idx = 0; idx < sortingArray.length; idx++) {
            const anObject = {
              name: sortingArray[idx],
            }
            autoCompleteArray.push(anObject)
          }

          this.setState({
            suggestions: autoCompleteArray,
          })
        })
        .catch((error) => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  onInputChange = (e) => {
    if (this.userSelectedSuggestion && (e.keyCode === 38 || e.keyCode === 40)) {
      // keyup or keydown
      return // return to let the component handle it...
    }

    if (e && e.target && (e.target.value || e.target.value === '')) {
      this.setState({ inputValue: e.target.value })
    } else {
      // User clicked on autosuggest item
      this.submitQuery({ queryText: this.userSelectedValue })
    }
  }

  moveCaretAtEnd = (e) => {
    var temp_value = e.target.value
    e.target.value = ''
    e.target.value = temp_value
  }

  render = () => {
    return (
      <div
        className={`react-autoql-bar-container ${this.props.className} ${
          this.props.autoCompletePlacement === 'below'
            ? 'autosuggest-bottom'
            : 'autosuggest-top'
        }`}
        data-test="chat-bar"
      >
        {this.props.autoQLConfig.enableAutocomplete ? (
          <Autosuggest
            className="auto-complete-chata"
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            getSuggestionValue={this.userSelectedSuggestionHandler}
            suggestions={this.state.suggestions}
            ref={(ref) => {
              this.autoSuggest = ref
            }}
            renderSuggestion={(suggestion) => (
              <Fragment>{suggestion.name}</Fragment>
            )}
            inputProps={{
              className: `${this.UNIQUE_ID} react-autoql-chatbar-input${
                this.props.showChataIcon ? ' left-padding' : ''
              }`,
              placeholder: this.props.placeholder || 'Type your queries here',
              disabled: this.props.isDisabled,
              onChange: this.onInputChange,
              onKeyPress: this.onKeyPress,
              onKeyDown: this.onKeyDown,
              value: this.state.inputValue,
              onFocus: this.moveCaretAtEnd,
              autoFocus: true,
            }}
          />
        ) : (
          <div className="react-autoql-chatbar-input-container">
            <input
              className={`react-autoql-chatbar-input${
                this.props.showChataIcon ? ' left-padding' : ''
              }`}
              placeholder={this.props.placeholder || 'Type your queries here'}
              value={this.state.inputValue}
              onChange={(e) => this.setState({ inputValue: e.target.value })}
              data-test="chat-bar-input"
              onKeyPress={this.onKeyPress}
              onKeyDown={this.onKeyDown}
              disabled={this.props.isDisabled}
              ref={this.setInputRef}
              onFocus={this.moveCaretAtEnd}
              autoFocus
            />
          </div>
        )}
        {this.props.showChataIcon && (
          <div className="chat-bar-input-icon">
            <Icon type="react-autoql-bubbles-outlined" />
          </div>
        )}
        {this.props.showLoadingDots && this.state.isQueryRunning && (
          <div className="input-response-loading-container">
            <LoadingDots />
          </div>
        )}
        {this.props.enableVoiceRecord && (
          <SpeechToTextButton
            onTranscriptChange={this.onTranscriptChange}
            onFinalTranscript={this.onFinalTranscript}
          />
        )}
      </div>
    )
  }
}
