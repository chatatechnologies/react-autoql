import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import { runQuery, fetchSuggestions } from '../../js/queryService'
import Autosuggest from 'react-autosuggest'

import SpeechToTextButton from '../SpeechToTextButton/SpeechToTextButton.js'
import chataBubblesSVG from '../../images/chata-bubbles.svg'

import styles from './ChatBar.css'

let autoCompleteArray = []

export default class ChatBar extends React.Component {
  UNIQUE_ID = uuid.v4()

  static propTypes = {
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    domain: PropTypes.string,
    enableVoiceRecord: PropTypes.bool,
    isDisabled: PropTypes.bool,
    onSubmit: PropTypes.func,
    onResponseCallback: PropTypes.func,
    className: PropTypes.string,
    enableAutocomplete: PropTypes.bool,
    autoCompletePlacement: PropTypes.string,
    showLoadingDots: PropTypes.bool,
    enableSafetyNet: PropTypes.bool,
    showChataIcon: PropTypes.bool,
    demo: PropTypes.bool,
    debug: PropTypes.bool
    // clearQueryOnSubmit: PropTypes.bool
  }

  static defaultProps = {
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    enableVoiceRecord: false,
    isDisabled: false,
    enableAutocomplete: true,
    autoCompletePlacement: 'top',
    enableSafetyNet: true,
    className: null,
    showLoadingDots: true,
    showChataIcon: true,
    demo: false,
    debug: false,
    onSubmit: () => {},
    onResponseCallback: () => {}
  }

  state = {
    inputValue: '',
    suggestions: [],
    isQueryRunning: false
  }

  submitQuery = queryText => {
    this.setState({ isQueryRunning: true })
    const query = queryText || this.state.inputValue

    if (query.trim()) {
      this.props.onSubmit(query)
      runQuery(
        query,
        this.props.demo,
        this.props.debug,
        this.props.enableSafetyNet,
        this.props.domain,
        this.props.apiKey,
        this.props.customerId,
        this.props.userId
      )
        .then(response => {
          this.props.onResponseCallback(response)
          this.setState({ isQueryRunning: false })
        })
        .catch(error => {
          this.props.onResponseCallback(error)
          this.setState({ isQueryRunning: false })
        })
    }
    this.setState({ inputValue: '' })
  }

  onKeyPress = e => {
    if (e.key == 'Enter') {
      this.submitQuery()
    }
  }

  onTranscriptChange = newTranscript => {
    this.setState({ inputValue: newTranscript })
  }

  onFinalTranscript = () => {
    this.submitQuery()
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
    fetchSuggestions(
      value,
      this.props.demo,
      this.props.domain,
      this.props.apiKey,
      this.props.customerId,
      this.props.userId
    )
      .then(response => {
        const body = response.data
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
      .catch(() => {
        console.warn('Autocomplete operation cancelled by the user.')
      })
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
      this.submitQuery(this.userSelectedValue)
    }
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          className={`chata-bar-container ${this.props.className} ${
            this.props.autoCompletePlacement === 'bottom'
              ? 'autosuggest-bottom'
              : 'autosuggest-top'
          }`}
        >
          {this.props.enableAutocomplete ? (
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
                className: `${this.UNIQUE_ID} chata-input${
                  this.props.showChataIcon ? ' left-padding' : ''
                }`,
                placeholder: 'Ask me anything',
                disabled: this.props.isDisabled,
                onChange: this.onInputChange,
                onKeyPress: this.onKeyPress,
                value: this.state.inputValue,
                autoFocus: true
              }}
            />
          ) : (
            <div className="chata-input-container">
              <input
                className={`chata-input${
                  this.props.showChataIcon ? ' left-padding' : ''
                }`}
                placeholder="Ask me anything"
                value={this.state.inputValue}
                onChange={e => this.setState({ inputValue: e.target.value })}
                onKeyPress={this.onKeyPress}
                disabled={this.props.isDisabled}
                ref={this.setInputRef}
                autoFocus
              />
            </div>
          )}
          {this.props.showChataIcon && (
            <div className="chat-bar-input-icon">
              <img
                className="chata-bubbles-icon"
                src={chataBubblesSVG}
                alt="chata.ai"
                height="22px"
                width="22px"
                draggable="false"
              />
            </div>
          )}
          {this.props.showLoadingDots && this.state.isQueryRunning && (
            <div className="input-response-loading-container">
              <div className="response-loading">
                <div />
                <div />
                <div />
                <div />
              </div>
            </div>
          )}
          {this.props.enableVoiceRecord && (
            <SpeechToTextButton
              onTranscriptChange={this.onTranscriptChange}
              onFinalTranscript={this.onFinalTranscript}
            />
          )}
        </div>
      </Fragment>
    )
  }
}
