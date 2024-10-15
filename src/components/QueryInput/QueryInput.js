import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _isEqual from 'lodash.isequal'
import { isMobile } from 'react-device-detect'
import Autosuggest from 'react-autosuggest'
import SpeechToTextButtonBrowser from '../SpeechToTextButton/SpeechToTextButtonBrowser'

import {
  runQuery,
  runQueryOnly,
  fetchAutocomplete,
  animateInputText,
  deepEqual,
  mergeSources,
  REQUEST_CANCELLED_ERROR,
  GENERAL_QUERY_ERROR,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
  getAutoQLConfig,
  parseJwt,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import LoadingDots from '../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { withTheme } from '../../theme'
import { dprQuery } from '../../js/dprService'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './QueryInput.scss'

class QueryInput extends React.Component {
  constructor(props) {
    super(props)

    this.UNIQUE_ID = uuid()
    this.MAX_QUERY_HISTORY = 5
    this.autoCompleteTimer = undefined
    this.autoCompleteArray = []

    this.state = {
      inputValue: '',
      lastQuery: '',
      queryHistoryIndex: -1,
      wasInputClicked: false,
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
    source: null,
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
    document.addEventListener('keydown', this.onEscKeypress)
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.props.inputValue !== prevProps.inputValue) {
      this.setState({ inputValue: this.props.inputValue })
    }

    if (this.state.inputValue && !prevState.inputValue && !this.userSelectedSuggestion) {
      this.setState({ suggestions: [] })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.queryValidationTimer)
    clearTimeout(this.caretMoveTimeout)
    document.removeEventListener('keydown', this.onEscKeypress)
  }

  onEscKeypress = (event) => {
    if (event.key === 'Escape') {
      // If esc key was not pressed in combination with ctrl or alt or shift
      const isNotCombinedKey = !(event.ctrlKey || event.altKey || event.shiftKey)
      if (isNotCombinedKey) {
        this.cancelQuery()
      }
    }
  }

  animateInputTextAndSubmit = ({ query, userSelection, source, skipQueryValidation, scope }) => {
    animateInputText({
      text: query,
      inputRef: this.inputRef,
      callback: () => {
        this.submitQuery({
          queryText: query,
          userSelection,
          skipQueryValidation: skipQueryValidation ?? true,
          source,
          scope,
        })
      },
    })
  }

  submitDprQuery = (query, id) => {
    dprQuery({
      dprKey: this.props.authentication?.dprKey,
      dprDomain: this.props.authentication?.dprDomain,
      query,
      sessionId: this.props.sessionId,
    })
      .then((response) => this.onResponse(response, query, id))
      .catch((error) => {
        console.error(error)
        this.onResponse(error, query, id)
      })
  }

  onResponse = (response, query, id) => {
    this.props.onResponseCallback(response, query, id)

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
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR)
  }

  submitQuery = ({ queryText, userSelection, skipQueryValidation, source } = {}) => {
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
      queryHistoryIndex: -1,
      queryValidationResponse: undefined,
      queryValidationComponentId: uuid(),
    }

    if (this.props.clearQueryOnSubmit) {
      newState.inputValue = ''
    }

    if (this._isMounted) {
      this.setState(newState)
    }

    this.axiosSource = axios.CancelToken?.source()

    const requestData = {
      query,
      userSelection,
      ...getAuthentication(this.props.authentication),
      ...getAutoQLConfig(this.props.autoQLConfig),
      source: mergeSources(this.props.source, source ?? 'user'),
      scope: this.props.scope,
      AutoAEId: this.props.AutoAEId,
      filters: this.props.queryFilters,
      pageSize: this.props.dataPageSize,
      cancelToken: this.axiosSource.token,
    }

    if (query.trim()) {
      const id = uuid()

      this.props.onSubmit(query, id)

      this.addQueryToHistory(query)

      if (!this.props.authentication?.token && !!this.props.authentication?.dprKey) {
        this.submitDprQuery(query, id)
      } else if (skipQueryValidation) {
        runQueryOnly(requestData)
          .then((response) => this.onResponse(response, query, id))
          .catch((error) => {
            const finalError = error || {
              error: GENERAL_QUERY_ERROR,
            }
            this.onResponse(finalError, query, id)
          })
      } else {
        runQuery(requestData)
          .then((response) => this.onResponse(response, query, id))
          .catch((error) => {
            // If there is no error it did not make it past options
            // and this is usually due to an authentication error
            const finalError = error || {
              error: GENERAL_QUERY_ERROR,
            }
            this.onResponse(finalError, query, id)
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
    this.setState({ inputValue: transcript, listeningForTranscript: false }, () => {
      this.focus()
    })
  }

  setInputRef = (ref) => {
    this.inputRef = ref
  }

  getQueryHistoryID = () => {
    if (!this.props?.authentication?.token) {
      return
    }

    try {
      const tokenInfo = parseJwt(this.props.authentication.token)
      const id = `query-history-${tokenInfo.user_id}-${tokenInfo.project_id}`
      return id
    } catch (error) {
      console.error(error)
      return
    }
  }

  getQueryHistory = () => {
    try {
      const id = this.getQueryHistoryID()
      const queryHistoryStr = localStorage.getItem(id)

      if (!queryHistoryStr) {
        return []
      }

      const queryHistory = JSON.parse(queryHistoryStr)

      if (queryHistory?.constructor !== Array || !queryHistory?.length) {
        return []
      }

      return queryHistory
    } catch (error) {
      console.error(error)
      return []
    }
  }

  addQueryToHistory = (query) => {
    try {
      const id = this.getQueryHistoryID()

      if (!id) {
        return
      }

      let queryHistory = this.getQueryHistory().filter((q) => {
        return q !== query
      })

      queryHistory.unshift(query)

      if (queryHistory.length > this.MAX_QUERY_HISTORY) {
        queryHistory = queryHistory.slice(0, this.MAX_QUERY_HISTORY)
      }

      localStorage.setItem(id, JSON.stringify(queryHistory))
    } catch (error) {
      console.error(error)
    }
  }

  onKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (this.userSelectedSuggestion || this.state.suggestions?.length) {
        return e // return to let the component handle it...
      }

      let lastQuery = ''
      const queryHistory = this.getQueryHistory()

      let queryIndex = this.state.queryHistoryIndex
      if (e.key === 'ArrowUp' && queryHistory[queryIndex + 1]) {
        queryIndex += 1
      } else if (e.key === 'ArrowDown' && queryIndex >= 0) {
        queryIndex -= 1
      }

      if (queryIndex !== -1) {
        lastQuery = queryHistory[queryIndex]
      }

      if (lastQuery !== undefined && lastQuery !== this.state.inputValue) {
        this.setState({ inputValue: lastQuery, queryHistoryIndex: queryIndex }, this.moveCaretAtEnd)
      } else {
        this.moveCaretAtEnd()
      }
    } else {
      this.userSelectedSuggestion = false
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
    if (userSelectedValueFromSuggestionBox && this._isMounted) {
      if (userSelectedValueFromSuggestionBox.name) {
        this.userSelectedValue = userSelectedValueFromSuggestionBox.name
        this.userSelectedSuggestion = true
        this.setState({ inputValue: userSelectedValueFromSuggestionBox.name })
      }
    }
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (!value) {
      return
    }

    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }
    this.autoCompleteTimer = setTimeout(() => {
      fetchAutocomplete({
        suggestion: value,
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          if (!this.state.inputValue) {
            return
          }

          const body = response?.data?.data

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

  renderSuggestionsContainer = ({ containerProps, children }) => {
    return (
      <div {...containerProps}>
        <div className='react-autoql-data-explorer-suggestion-container'>{children}</div>
      </div>
    )
  }

  renderSectionTitle = (section) => {
    return (
      <>
        <strong>{section.title}</strong>
        {/* {section.emptyState ? (
          <div className='data-explorer-no-suggestions'>
            <em>No results</em>
          </div>
        ) : null} */}
      </>
    )
  }

  getSectionSuggestions = (section) => {
    return section.suggestions
  }

  getSuggestions = () => {
    const isQueryHistory = this.state.suggestions?.find((sugg) => sugg.fromHistory)
    return [{ title: isQueryHistory ? 'Recent queries' : '', suggestions: this.state.suggestions }]
  }

  onInputChange = (e) => {
    if (this.state.listeningForTranscript) {
      // Speech to text is processing, let it control the input
      e.stopPropagation()
      return
    }

    const inputValue = e?.target?.value

    if (!getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete) {
      // Component is using native input, just update the inputValue state
      this.setState({ inputValue })
      return
    }

    if (
      (this.userSelectedSuggestion || this.state.suggestions?.length) &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      // keyup or keydown
      return // return to let the component handle it...
    } else if (e.key === 'Enter') {
      this.setState({ inputValue }, () => this.submitQuery())
      return
    }

    const newState = {}

    if (this.props.isBackButtonClicked) {
      newState.inputValue = ''
    } else if (inputValue || inputValue === '') {
      newState.inputValue = inputValue
    } else {
      // User clicked on autosuggest item
      newState.inputValue = this.userSelectedValue
    }

    if (!inputValue && (e.key === 'Backspace' || e.key === 'Delete')) {
      newState.suggestions = this.getQueryHistory()
    }

    this.setState(newState)
  }

  showQueryHistorySuggestions = () => {
    if (!this.state.inputValue) {
      const suggestions = this.getQueryHistory()
        ?.map((query) => {
          return {
            name: query,
            fromHistory: true,
          }
        })
        .reverse()

      this.setState({ suggestions })
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
      id: this.UNIQUE_ID,
      className: `${this.UNIQUE_ID} react-autoql-query-input react-autoql-chatbar-input${
        this.props.showChataIcon ? ' left-padding' : ''
      }`,
      placeholder: this.props.placeholder,
      disabled: this.props.isDisabled,
      onChange: this.onInputChange,
      onKeyPress: this.onKeyPress,
      onKeyDown: this.onKeyDown,
      value: this.state.inputValue,
      onFocus: this.moveCaretAtEnd,
      onBlur: () => this.setState({ suggestions: [] }),
      onClick: this.showQueryHistorySuggestions,
      spellCheck: false,
      autoFocus: true,
      autoComplete: 'one-time-code',
    }

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-bar-container ${this.props.className} ${
            this.props.autoCompletePlacement === 'below' ? 'autosuggest-bottom' : 'autosuggest-top'
          }`}
          data-test='chat-bar'
        >
          <div className='react-autoql-chatbar-input-container'>
            {getAutoQLConfig(this.props.autoQLConfig).enableAutocomplete ? (
              <Autosuggest
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                renderSuggestionsContainer={this.renderSuggestionsContainer}
                getSuggestionValue={this.userSelectedSuggestionHandler}
                getSectionSuggestions={this.getSectionSuggestions}
                renderSectionTitle={this.renderSectionTitle}
                suggestions={this.getSuggestions()}
                multiSection={true}
                shouldRenderSuggestions={() => !this.props.isDisabled}
                ref={(ref) => (this.autoSuggest = ref)}
                renderSuggestion={(suggestion) => <>{suggestion?.name}</>}
                inputProps={inputProps}
              />
            ) : (
              <input {...inputProps} />
            )}
          </div>
          {this.props.showChataIcon && (
            <div className='chat-bar-input-icon'>
              <Icon type='react-autoql-bubbles-outlined' />
            </div>
          )}
          {this.props.showLoadingDots && this.state.isQueryRunning && (
            <div className='input-response-loading-container'>
              <LoadingDots />
            </div>
          )}
          {!isMobile && this.props.enableVoiceRecord && (
            <SpeechToTextButtonBrowser
              onTranscriptStart={this.onTranscriptStart}
              onTranscriptChange={this.onTranscriptChange}
              onFinalTranscript={this.onFinalTranscript}
              authentication={this.props.authentication}
              tooltipID={this.props.tooltipID}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryInput)
