import React, { Fragment } from 'react'
import { bool, string, func } from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault
} from '../../props/defaults'

import { Icon } from '../Icon'
import { runQuery, runQueryOnly, fetchSuggestions } from '../../js/queryService'
import Autosuggest from 'react-autosuggest'

import SpeechToTextButton from '../SpeechToTextButton/SpeechToTextButton.js'
import LoadingDots from '../../components/LoadingDots/LoadingDots.js'

import './ChatBar.scss'

let autoCompleteArray = []

export default class ChatBar extends React.Component {
  UNIQUE_ID = uuid.v4()
  autoCompleteTimer = undefined

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableVoiceRecord: bool,
    isDisabled: bool,
    onSubmit: func,
    onResponseCallback: func,
    className: string,
    autoCompletePlacement: string,
    showLoadingDots: bool,
    showChataIcon: bool
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableVoiceRecord: false,
    isDisabled: false,
    autoCompletePlacement: 'top',
    className: null,
    showLoadingDots: true,
    showChataIcon: true,
    onSubmit: () => {},
    onResponseCallback: () => {}
  }

  state = {
    inputValue: '',
    suggestions: [],
    isQueryRunning: false
  }

  componentWillUnmount = () => {
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
  }

  animateInputTextAndSubmit = (text, skipSafetyNet, source) => {
    if (typeof text === 'string' && _get(text, 'length')) {
      for (let i = 1; i <= text.length; i++) {
        setTimeout(() => {
          this.setState({
            inputValue: text.slice(0, i)
          })
          if (i === text.length) {
            setTimeout(() => {
              this.submitQuery({ queryText: text, skipSafetyNet: true, source })
            }, 300)
          }
        }, i * 50)
      }
    }
  }

  submitQuery = ({ queryText, skipSafetyNet, source }) => {
    this.setState({ isQueryRunning: true })
    const query = queryText || this.state.inputValue

    if (query.trim()) {
      this.props.onSubmit(query)

      if (skipSafetyNet) {
        runQueryOnly({
          query,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          source: source || 'data_messenger'
        })
          .then(response => {
            this.props.onResponseCallback(response)
            this.setState({ isQueryRunning: false })
          })
          .catch(error => {
            console.error(error)
            this.props.onResponseCallback(error)
            this.setState({ isQueryRunning: false })
          })
      } else {
        runQuery({
          query,
          ...this.props.authentication,
          ...this.props.autoQLConfig,
          source: source || 'data_messenger'
        })
          .then(response => {
            this.props.onResponseCallback(response)
            this.setState({ isQueryRunning: false })
          })
          .catch(error => {
            console.error(error)
            this.props.onResponseCallback(error)
            this.setState({ isQueryRunning: false })
          })
      }
    }
    this.setState({ inputValue: '' })
  }

  onKeyPress = e => {
    if (e.key == 'Enter') {
      this.submitQuery({ source: 'data_messenger' })
    }
  }

  onTranscriptChange = newTranscript => {
    this.setState({ inputValue: newTranscript })
  }

  onFinalTranscript = () => {
    // Disabling auto submit for now
    // this.submitQuery()
    this.focus()
  }

  setInputRef = ref => {
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

  userSelectedSuggestionHandler = userSelectedValueFromSuggestionBox => {
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
      fetchSuggestions({
        suggestion: value,
        ...this.props.authentication
      })
        .then(response => {
          const body = this.props.authentication.demo
            ? response.data
            : _get(response, 'data.data')

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
              name: sortingArray[idx]
            }
            autoCompleteArray.push(anObject)
          }

          this.setState({
            suggestions: autoCompleteArray
          })
        })
        .catch(error => {
          console.error(error)
        })
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: []
    })
  }

  onInputChange = e => {
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

  moveCaretAtEnd = e => {
    var temp_value = e.target.value
    e.target.value = ''
    e.target.value = temp_value
  }

  render = () => {
    return (
      <div
        className={`chata-bar-container ${this.props.className} ${
          this.props.autoCompletePlacement === 'bottom'
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
            ref={ref => {
              this.autoSuggest = ref
            }}
            renderSuggestion={suggestion => (
              <Fragment>{suggestion.name}</Fragment>
            )}
            inputProps={{
              className: `${this.UNIQUE_ID} chata-chatbar-input${
                this.props.showChataIcon ? ' left-padding' : ''
              }`,
              placeholder: this.props.placeholder || 'Ask me anything...',
              disabled: this.props.isDisabled,
              onChange: this.onInputChange,
              onKeyPress: this.onKeyPress,
              value: this.state.inputValue,
              onFocus: this.moveCaretAtEnd,
              autoFocus: true
            }}
          />
        ) : (
          <div className="chata-chatbar-input-container">
            <input
              className={`chata-chatbar-input${
                this.props.showChataIcon ? ' left-padding' : ''
              }`}
              placeholder={this.props.placeholder || 'Ask me anything...'}
              value={this.state.inputValue}
              onChange={e => this.setState({ inputValue: e.target.value })}
              onKeyPress={this.onKeyPress}
              disabled={this.props.isDisabled}
              ref={this.setInputRef}
              onFocus={this.moveCaretAtEnd}
              autoFocus
            />
          </div>
        )}
        {this.props.showChataIcon && (
          <div className="chat-bar-input-icon">
            <Icon type="chata-bubbles" />
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
