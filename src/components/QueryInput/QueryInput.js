import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import errorMessages, { responseErrors } from '../../js/errorMessages'
import ReactTooltip from 'react-tooltip'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getAutoQLConfig,
} from '../../props/defaults'

import { Icon } from '../Icon'
import {
  runQuery,
  runQueryOnly,
  fetchAutocomplete,
} from '../../js/queryService'
import Autosuggest from 'react-autosuggest'
import SpeechToTextButtonBrowser from '../SpeechToTextButton/SpeechToTextButtonBrowser'
import LoadingDots from '../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { animateInputText } from '../../js/Util'
import { dprQuery } from '../../js/dprService'
import { withTheme } from '../../theme'

import './QueryInput.scss'

class QueryInput extends React.Component {
  constructor(props) {
    super(props)

    this.UNIQUE_ID = uuid()
    this.autoCompleteTimer = undefined
    this.autoCompleteArray = []

    this.state = {
      inputValue: '',
      lastQuery: '',
      suggestions: [],
      isQueryRunning: false,
      listeningForTranscript: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    enableVoiceRecord: PropTypes.bool,
    isDisabled: PropTypes.bool,
    onSubmit: PropTypes.func,
    onResponseCallback: PropTypes.func,
    className: PropTypes.string,
    autoCompletePlacement: PropTypes.string,
    showLoadingDots: PropTypes.bool,
    showChataIcon: PropTypes.bool,
    inputValue: PropTypes.string,
    queryFilters: PropTypes.arrayOf(PropTypes.shape({})),
    placeholder: PropTypes.string,
    clearQueryOnSubmit: PropTypes.bool,
    sessionId: PropTypes.string,
    dataPageSize: PropTypes.number,
    shouldRender: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableVoiceRecord: false,
    isDisabled: false,
    autoCompletePlacement: 'above',
    className: null,
    showLoadingDots: true,
    showChataIcon: true,
    isBackButtonClicked: false,
    inputValue: undefined,
    source: [],
    queryFilters: undefined,
    clearQueryOnSubmit: true,
    placeholder: 'Type your queries here',
    dataPageSize: undefined,
    shouldRender: true,
    onSubmit: () => {},
    onResponseCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.inputValue !== prevProps.inputValue) {
      this.setState({ inputValue: this.props.inputValue })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.queryValidationTimer)
    clearTimeout(this.caretMoveTimeout)
  }
  animateInputTextAndSubmit = ({ query, userSelection, source }) => {
    animateInputText({
      text: query,
      inputRef: this.inputRef,
      callback: () => {
        this.submitQuery({
          queryText: query,
          userSelection,
          skipQueryValidation: true,
          source,
        })
      },
    })
  }

  submitDprQuery = (query) => {
    dprQuery({
      dprKey: this.props.authentication?.dprKey,
      dprDomain: this.props.authentication?.dprDomain,
      query,
      sessionId: this.props.sessionId,
    })
      .then((response) => this.onResponse(response, query))
      .catch((error) => {
        console.error(error)
        this.onResponse(error, query)
      })
  }

  onResponse = (response, query) => {
    this.props.onResponseCallback(response, query)

    const newState = {
      isQueryRunning: false,
      suggestions: [],
      lastQuery: query || this.state?.lastQuery,
    }
    if (this._isMounted) {
      this.setState(newState)
    }
  }

  cancelQuery = () => {
    this.axiosSource.cancel(responseErrors.CANCELLED)
  }

  submitQuery = ({
    queryText,
    userSelection,
    skipQueryValidation,
    source,
  } = {}) => {
    const query = queryText || this.state.inputValue
    if (!query) {
      return
    }

    // Cancel subscription to autocomplete since query was already submitted
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }

    const newState = {
      isQueryRunning: true,
      suggestions: [],
      queryValidationResponse: undefined,
      queryValidationComponentId: uuid(),
    }

    if (this.props.clearQueryOnSubmit) {
      newState.inputValue = ''
    }

    if (this._isMounted) this.setState(newState)

    let newSource = this.props.source
    if (source?.length) {
      newSource = [...this.props.source, ...source]
    } else if (source) {
      newSource.push('user')
    }

    this.axiosSource = axios.CancelToken.source()
    const requestData = {
      query,
      userSelection,
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      source: newSource,
      AutoAEId: this.props.AutoAEId,
      filters: this.props.queryFilters,
      pageSize: this.props.dataPageSize,
      cancelToken: this.axiosSource.token,
    }

    if (query.trim()) {
      this.props.onSubmit(query)
      localStorage.setItem('inputValue', query)
      if (
        !this.props.authentication?.token &&
        !!this.props.authentication?.dprKey
      ) {
        this.submitDprQuery(query)
      } else if (skipQueryValidation) {
        runQueryOnly(requestData)
          .then((response) => this.onResponse(response, query))
          .catch((error) => {
            const finalError = error || {
              error: errorMessages.GENERAL_QUERY,
            }
            this.onResponse(finalError, query)
          })
      } else {
        runQuery(requestData)
          .then((response) => this.onResponse(response, query))
          .catch((error) => {
            // If there is no error it did not make it past options
            // and this is usually due to an authentication error
            const finalError = error || {
              error: errorMessages.GENERAL_QUERY,
            }
            this.onResponse(finalError, query)
          })
      }
    }
  }

  onTranscriptStart = () => {
    this.setState({ listeningForTranscript: true })
  }

  onTranscriptChange = (transcript) => {
    this.setState({ inputValue: transcript })
  }

  onFinalTranscript = (transcript) => {
    this.setState(
      { inputValue: transcript, listeningForTranscript: false },
      () => {
        this.focus()
        ReactTooltip.hide()
      }
    )
  }

  setInputRef = (ref) => {
    this.inputRef = ref
  }

  onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && !_get(this.state.suggestions, 'length')) {
      const lastQuery = localStorage.getItem('inputValue')
      if (lastQuery && lastQuery !== 'undefined') {
        this.setState({ inputValue: lastQuery }, this.moveCaretAtEnd)
      }
    } else if (
      this.userSelectedSuggestion &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      // keyup or keydown
      return e // return to let the component handle it...
    }

    return e
  }

  onKeyPress = (e) => {
    if (e.key == 'Enter') {
      this.submitQuery()
    }
  }

  focus = () => {
    if (this.inputRef?.focus) {
      this.inputRef.focus()
    }
  }

  userSelectedSuggestionHandler = (userSelectedValueFromSuggestionBox) => {
    if (
      userSelectedValueFromSuggestionBox &&
      userSelectedValueFromSuggestionBox.name &&
      this._isMounted
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
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          const body = _get(response, 'data.data')

          const sortingArray = []
          let suggestionsMatchArray = []
          this.autoCompleteArray = []
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
            this.autoCompleteArray.push(anObject)
          }

          this.setState({
            suggestions: this.autoCompleteArray,
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
    if (this.state.listeningForTranscript) {
      // Speech to text is processing, let it control the input
      e.stopPropagation()
      return
    }

    if (!getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete) {
      // Component is using native input, just update the inputValue state
      this.setState({ inputValue: e.target.value })
      return
    }

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

    if (this.props.isBackButtonClicked) {
      this.setState({ inputValue: '' })
    }
  }

  moveCaretAtEnd = (e) => {
    clearTimeout(this.caretMoveTimeout)
    this.caretMoveTimeout = setTimeout(() => {
      try {
        const length = this.inputRef?.value?.length
        this.inputRef?.setSelectionRange(length, length)
      } catch (error) {}
    }, 0)
  }

  render = () => {
    const inputProps = {
      ref: this.setInputRef,
      className: `${this.UNIQUE_ID} react-autoql-chatbar-input${
        this.props.showChataIcon ? ' left-padding' : ''
      }`,
      placeholder: this.props.placeholder,
      disabled: this.props.isDisabled,
      onChange: this.onInputChange,
      onKeyPress: this.onKeyPress,
      onKeyDown: this.onKeyDown,
      value: this.state.inputValue,
      onFocus: this.moveCaretAtEnd,
      spellCheck: false,
      autoFocus: true,
    }

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-bar-container ${this.props.className} ${
            this.props.autoCompletePlacement === 'below'
              ? 'autosuggest-bottom'
              : 'autosuggest-top'
          }`}
          data-test="chat-bar"
        >
          <div className="react-autoql-chatbar-input-container">
            {getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete ? (
              <Autosuggest
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
                inputProps={inputProps}
              />
            ) : (
              <input {...inputProps} />
            )}
          </div>
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
            <SpeechToTextButtonBrowser
              onTranscriptStart={this.onTranscriptStart}
              onTranscriptChange={this.onTranscriptChange}
              onFinalTranscript={this.onFinalTranscript}
              authentication={this.props.authentication}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryInput)
