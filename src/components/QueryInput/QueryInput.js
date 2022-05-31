import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

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
  getAuthentication,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import { setCSSVars } from '../../js/Util'

import { Icon } from '../Icon'
import {
  runQuery,
  runQueryOnly,
  fetchAutocomplete,
  runQueryValidation,
} from '../../js/queryService'
import Autosuggest from 'react-autosuggest'
// import { QueryInputWithValidation } from '../QueryInputWithValidation'

import SpeechToTextButtonBrowser from '../SpeechToTextButton/SpeechToTextButtonBrowser'
// import SpeechToTextBtn from '../SpeechToTextButton/SpeechToTextButton'
import LoadingDots from '../LoadingDots/LoadingDots.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './QueryInput.scss'
import { dprQuery } from '../../js/dprService'

let autoCompleteArray = []

export default class QueryInput extends React.Component {
  constructor(props) {
    super(props)

    setCSSVars(getThemeConfig(this.props.themeConfig))

    this.UNIQUE_ID = uuid()
    this.autoCompleteTimer = undefined

    this.state = {
      inputValue: '',
      lastQuery: '',
      suggestions: [],
      isQueryRunning: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,
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
    placeholder: PropTypes.string.isRequired,
    clearQueryOnSubmit: PropTypes.bool,
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
    isBackButtonClicked: false,
    inputValue: undefined,
    source: [],
    queryFilters: undefined,
    clearQueryOnSubmit: true,
    onSubmit: () => {},
    onResponseCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.focus()
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
    if (this.props.inputValue !== prevProps.inputValue) {
      this.setState({ inputValue: this.props.inputValue })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    if (this.autoCompleteTimer) {
      clearTimeout(this.autoCompleteTimer)
    }

    if (this.queryValidationTimer) {
      clearTimeout(this.queryValidationTimer)
    }
  }

  animateInputTextAndSubmit = ({ query, userSelection, source }) => {
    if (typeof query === 'string' && _get(query, 'length')) {
      for (let i = 1; i <= query.length; i++) {
        setTimeout(() => {
          if (this._isMounted)
            this.setState({
              inputValue: query.slice(0, i),
            })
          if (i === query.length) {
            setTimeout(() => {
              this.submitQuery({
                queryText: query,
                userSelection,
                skipQueryValidation: true,
                source,
              })
            }, 300)
          }
        }, i * 50)
      }
    }
  }

  submitDprQuery = (query) => {
    dprQuery({
      dprKey: this.props.authentication?.dprKey,
      query,
    })
      .then((response) => this.onResponse(response, query))
      .catch((error) => {
        console.error(error)
        this.onResponse(error)
      })
  }

  onResponse = (response, query) => {
    this.props.onResponseCallback(response, query)
    localStorage.setItem('inputValue', query)

    const newState = {
      isQueryRunning: false,
      suggestions: [],
      lastQuery: query || this.state?.lastQuery,
    }
    if (this._isMounted) {
      this.setState(newState)
    }
  }

  submitQuery = ({
    queryText,
    userSelection,
    skipQueryValidation,
    source,
  } = {}) => {
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

    const query = queryText || this.state.inputValue
    const newSource = [...this.props.source, source || 'user']

    if (query.trim()) {
      this.props.onSubmit(query)

      if (
        !this.props.authentication?.token &&
        !!this.props.authentication?.dprKey
      ) {
        this.submitDprQuery(query)
      } else if (skipQueryValidation) {
        runQueryOnly({
          query,
          userSelection,
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          source: newSource,
          AutoAEId: this.props.AutoAEId,
          filters: this.props.queryFilters,
        })
          .then((response) => this.onResponse(response, query))
          .catch((error) => console.error(error))
      } else {
        runQuery({
          query,
          ...getAuthentication(this.props.authentication),
          ...getAutoQLConfig(this.props.autoQLConfig),
          source: newSource,
          AutoAEId: this.props.AutoAEId,
          filters: this.props.queryFilters,
        })
          .then((response) => this.onResponse(response, query))
          .catch((error) => {
            // If there is no error it did not make it past options
            // and this is usually due to an authentication error
            const finalError = error || {
              error: 'Unauthenticated',
            }
            this.onResponse(finalError)
          })
      }
    }
  }

  onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && !_get(this.state.suggestions, 'length')) {
      this.setState({ inputValue: localStorage.getItem('inputValue') })
    }
  }

  onKeyPress = (e) => {
    if (e.key == 'Enter') {
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
    // if (this.queryValidationInputRef) {
    //   this.queryValidationInputRef.focus()
    // }
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
      userSelectedValueFromSuggestionBox.name &&
      this._isMounted
    ) {
      this.userSelectedValue = userSelectedValueFromSuggestionBox.name
      this.userSelectedSuggestion = true
      this.setState({ inputValue: userSelectedValueFromSuggestionBox.name })
    }
  }

  runValidation = ({ text }) => {
    // Reset validation configuration since text has changed
    this.setState({
      queryValidationResponse: undefined,
      queryValidationComponentId: uuid(),
    })

    if (this.queryValidationTimer) {
      clearTimeout(this.queryValidationTimer)
    }

    this.queryValidationTimer = setTimeout(() => {
      runQueryValidation({
        text,
        ...getAuthentication(this.props.authentication),
      })
        .then((response) => {
          if (this.state.inputValue === _get(response, 'data.data.query')) {
            this.setState({
              queryValidationResponse: response,
              queryValidationComponentId: uuid(),
            })
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }, 300)
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
    //WIP
    // this.runValidation({ text: e.target.value })
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
    var temp_value = e.target.value
    e.target.value = ''
    e.target.value = temp_value
  }

  render = () => {
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
                lassName="auto-complete-chata"
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
                  placeholder: this.props.placeholder,
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
              // <QueryInputWithValidation
              //   authentication={getAuthentication(this.props.authentication)}
              //   themeConfig={getThemeConfig(this.props.themeConfig)}
              //   ref={(ref) => (this.queryValidationInputRef = ref)}
              //   key={this.state.queryValidationComponentId}
              //   response={this.state.queryValidationResponse}
              //   placeholder={this.props.placeholder}
              //   disabled={this.props.isDisabled}
              //   showChataIcon={this.props.showChataIcon}
              //   showLoadingDots={this.props.showLoadingDots}
              //   submitQuery={this.submitQuery}
              //   onKeyDown={this.onKeyDown}
              //   onQueryValidationSelectOption={(query) => {
              //     this.setState({ inputValue: query })
              //     this.focus()
              //   }}
              // />
              <input
                className={`react-autoql-chatbar-input${
                  this.props.showChataIcon ? ' left-padding' : ''
                }`}
                placeholder={this.props.placeholder || 'Type your queries here'}
                value={this.state.inputValue}
                onChange={(e) => {
                  this.setState({ inputValue: e.target.value })
                }}
                data-test="chat-bar-input"
                onKeyPress={this.onKeyPress}
                onKeyDown={this.onKeyDown}
                disabled={this.props.isDisabled}
                ref={this.setInputRef}
                onFocus={this.moveCaretAtEnd}
                autoFocus
              />
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
            // KEEP THIS FOR NOW
            // <SpeechToTextBtn
            //   onTranscriptChange={this.onTranscriptChange}
            //   onFinalTranscript={this.onFinalTranscript}
            //   themeConfig={this.props.themeConfig}
            //   authentication={getAuthentication(this.props.authentication)}
            // />
            <SpeechToTextButtonBrowser
              onTranscriptChange={this.onTranscriptChange}
              onFinalTranscript={this.onFinalTranscript}
              themeConfig={this.props.themeConfig}
              authentication={getAuthentication(this.props.authentication)}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
