import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import { reviewData } from '../../testData/reviews.js'
import { runQuery, fetchSuggestions } from '../../js/queryService'
import Autosuggest from 'react-autosuggest'

import SpeechToTextButton from '../SpeechToTextButton/SpeechToTextButton.js'

import styles from './ChatBar.css'

let autoCompleteArray = []

export default class ChatBar extends React.Component {
  static propTypes = {
    // apiKey: PropTypes.string.isRequired,
    // dataSourceKey: PropTypes.string.isRequired,
    token: PropTypes.string,
    projectId: PropTypes.number,
    enableVoiceRecord: PropTypes.bool,
    isDisabled: PropTypes.bool,
    onSubmit: PropTypes.func,
    onResponseCallback: PropTypes.func,
    className: PropTypes.string,
    enableAutocomplete: PropTypes.bool,
    autoCompletePlacement: PropTypes.string,
    showLoadingDots: PropTypes.bool,
    enableSafetyNet: PropTypes.bool
  }

  static defaultProps = {
    enableVoiceRecord: false,
    isDisabled: false,
    enableAutocomplete: true,
    autoCompletePlacement: 'top',
    enableSafetyNet: true,
    className: null,
    token: undefined,
    projectId: undefined,
    showLoadingDots: false,
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
        this.props.token,
        this.props.projectId,
        this.props.enableSafetyNet
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
      const autoSuggestElement = document.getElementsByClassName('chata-input')
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
    fetchSuggestions(value, this.props.token, this.props.projectId).then(
      response => {
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
      }
    )
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
                className: 'chata-input',
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
                className="chata-input"
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
