import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import axios from 'axios'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
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
  fetchSubjectList,
  fetchDataPreview,
  transformQueryResponse,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import LoadingDots from '../LoadingDots/LoadingDots.js'
import { Spinner } from '../Spinner'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import SampleQueryList from '../DataExplorer/SampleQueryList'
import FieldSelector from '../FieldSelector'

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
      topics: [],
      isInputFocused: false,
      selectedTopic: null,
      isExpanded: false,
      selectedColumns: [],
      dataPreview: undefined,
      isDataPreviewLoading: false,
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
    addResponseMessage: PropTypes.func,
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
    enableQuerySuggestions: PropTypes.bool,
    enableQueryInputTopics: PropTypes.bool,
    columns: PropTypes.array,
    executeQuery: PropTypes.func,
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
    enableQuerySuggestions: true,
    enableQueryInputTopics: true,
    placeholder: 'Type your queries here',
    dataPageSize: undefined,
    shouldRender: true,
    onSubmit: () => {},
    onResponseCallback: () => {},
    addResponseMessage: () => {},
    executeQuery: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    document.addEventListener('keydown', this.onEscKeypress)
    document.addEventListener('mousedown', this.handleClickOutside)

    // Fetch topics if enabled
    if (this.props.enableQueryInputTopics) {
      this.fetchTopics()
    }
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
    document.removeEventListener('mousedown', this.handleClickOutside)
    this.axiosSourceDataPreview?.cancel(REQUEST_CANCELLED_ERROR)
  }

  fetchTopics = () => {
    fetchSubjectList({ ...this.props.authentication })
      .then((subjects) => {
        if (this._isMounted && subjects?.length) {
          // Filter out aggregate seed subjects, similar to DataExplorer
          const filteredSubjects = subjects.filter((subj) => !subj.isAggSeed())
          this.setState({ topics: filteredSubjects })
        }
      })
      .catch((error) => console.error('Error fetching topics:', error))
  }

  onTopicClick = (topic) => {
    // Set the selected topic and expand the container
    this.setState(
      {
        selectedTopic: topic,
        isExpanded: true,
        isDataPreviewLoading: true,
        selectedColumns: [],
        dataPreview: undefined,
      },
      () => {
        // Fetch data preview after state is set
        this.fetchDataPreviewData()
      },
    )
  }

  collapseSuggestions = () => {
    this.setState({
      selectedTopic: null,
      isExpanded: false,
      selectedColumns: [],
      dataPreview: undefined,
      isDataPreviewLoading: false,
    })
  }

  handleClickOutside = (event) => {
    if (!this.state.isExpanded || !this.queryInputWrapperRef) {
      return
    }

    // Check if the click is on a dropdown or popup that should not close the suggestions
    const isDropdownClick =
      event.target.closest('.react-autoql-multiselect-popup') ||
      event.target.closest('.react-autoql-sample-queries-filter-dropdown') ||
      event.target.closest('[data-tooltip-id]') ||
      event.target.closest('.VLAutocompleteInputPopover') ||
      event.target.closest('.VLAutocompleteInput') ||
      event.target.closest('.react-autosuggest__suggestions-container') ||
      event.target.closest('.react-autosuggest__input') ||
      event.target.closest('.react-autosuggest__container') ||
      event.target.closest('.VLAutocompleteInputPopover__container') ||
      event.target.closest('.VLAutocompleteInputPopover__list') ||
      event.target.closest('.VLAutocompleteInput__container')

    // Don't close if clicking on a dropdown
    if (isDropdownClick) {
      return
    }

    // Only close if clicking outside the wrapper
    if (!this.queryInputWrapperRef.contains(event.target)) {
      this.collapseSuggestions()
    }
  }

  renderSampleQueriesHeader = () => {
    const columns = this.state.dataPreview?.data?.data?.columns

    return (
      <div className='react-autoql-data-explorer-title-text'>
        <div className='react-autoql-data-explorer-title-row'>
          <span className='react-autoql-data-explorer-title-text-sample-queries'>
            <Icon type='light-bulb-on' /> What can I query?
          </span>
          {this.renderDataPreviewButton()}
          <FieldSelector
            columns={columns}
            selectedColumns={this.state.selectedColumns}
            onColumnsChange={(selectedColumns) => this.setState({ selectedColumns })}
            selectedSubject={this.state.selectedTopic}
            selectedTopic={null}
            loading={this.state.isDataPreviewLoading}
          />
        </div>
      </div>
    )
  }

  renderDataPreviewButton = () => {
    return (
      <button
        className='data-preview-button'
        onClick={this.triggerDataPreviewQuery}
        disabled={this.state.isDataPreviewLoading}
        type='button'
      >
        <Icon type='send' /> Show <strong>Data Preview</strong>
      </button>
    )
  }

  onCloseExpanded = () => {
    this.collapseSuggestions()
  }

  getColumnsForSuggestions = () => {
    // Only include columns if user has explicitly selected them
    // Otherwise return undefined to prevent re-fetching when data preview loads
    if (!this.state.selectedColumns?.length) {
      return undefined
    }

    let columns = {}

    this.state.selectedColumns.forEach((columnIndex) => {
      const column = this.state.dataPreview?.data?.data?.columns[columnIndex]
      if (column && !columns[column.name]) {
        columns[column.name] = { value: '' }

        if (column.alt_name) {
          columns[column.name].alternative_column_names = [column.alt_name]
        }
      }
    })

    return columns
  }

  fetchDataPreviewData = () => {
    if (!this.state.selectedTopic?.context) {
      return
    }

    // Cancel any previous data preview request
    this.axiosSourceDataPreview?.cancel(REQUEST_CANCELLED_ERROR)
    this.axiosSourceDataPreview = axios.CancelToken.source()

    fetchDataPreview({
      ...this.props.authentication,
      subject: this.state.selectedTopic?.context,
      numRows: 1,
      source: 'query_input.query_suggestions',
      cancelToken: this.axiosSourceDataPreview.token,
    })
      .then((response) => {
        if (this._isMounted) {
          // Add metadata to determine whether or not a user can generate sample queries from the column
          if (response?.data?.data?.columns?.length) {
            response.data.data.columns.forEach((column) => {
              column.isGroupable = this.isColumnGroupable(column)
              column.isFilterable = this.isColumnFilterable(column)
            })
          }

          this.setState({ dataPreview: response, isDataPreviewLoading: false })
        }
      })
      .catch((error) => {
        if (this._isMounted) {
          if (error?.message !== REQUEST_CANCELLED_ERROR) {
            console.error(error)
            this.setState({ isDataPreviewLoading: false })
          }
        }
      })
  }

  isColumnGroupable = (column) => {
    const groupsNotProvided = !this.state.selectedTopic?.groups
    const existsInGroups = !!this.state.selectedTopic?.groups?.find((groupby) => groupby.table_column === column.name)
    const groupbysAllowed = groupsNotProvided || existsInGroups
    return groupbysAllowed
  }

  isColumnFilterable = (column) => {
    const filtersNotProvided = !this.state.selectedTopic?.filters
    const existsInFilters = !!this.state.selectedTopic?.filters?.find((filter) => filter.table_column === column.name)
    const filtersAllowed = filtersNotProvided || existsInFilters
    return filtersAllowed
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

  triggerDataPreviewQuery = () => {
    if (!this.state.selectedTopic) {
      return
    }

    const topicName = this.state.selectedTopic?.displayName || 'this topic'
    const queryText = `Data Preview - ${topicName}`

    // Collapse the suggestions
    this.collapseSuggestions()

    // Submit immediately without animating
    this.submitDataPreviewQuery(queryText)
  }

  submitDataPreviewQuery = (queryText) => {
    if (!this.state.selectedTopic?.context) {
      return
    }

    const id = uuid()
    const numRows = 20
    const topicName = this.state.selectedTopic?.displayName || 'this topic'

    // Notify parent that we're submitting a query (this shows the request message)
    this.props.onSubmit(queryText, id)

    // Set query running state
    this.setState({ isQueryRunning: true })

    // Cancel any previous data preview request
    this.axiosSourceDataPreview?.cancel(REQUEST_CANCELLED_ERROR)
    this.axiosSourceDataPreview = axios.CancelToken.source()

    // Fetch data preview with more rows for display
    fetchDataPreview({
      ...this.props.authentication,
      subject: this.state.selectedTopic?.context,
      numRows: numRows,
      source: 'query_input.data_preview_query',
      scope: this.props.scope,
      cancelToken: this.axiosSourceDataPreview.token,
    })
      .then((response) => {
        // Mark this response as a data preview type
        if (response?.data?.data) {
          response.data.data.isDataPreview = true
          // Disable infinite scroll to enable local sorting
          response.data.data.useInfiniteScroll = false
        }

        const formattedResponse = transformQueryResponse(response)

        // Send an informational text message first
        const actualRows = formattedResponse?.data?.data?.rows?.length || numRows
        const infoMessage = `Displaying the first ${actualRows} rows from "${topicName}"`

        // Add the text content message using the same approach as ChatContent
        this.props.addResponseMessage({
          content: infoMessage,
          queryMessageID: id,
        })

        // Add a small delay to ensure the informational message appears before the data table
        setTimeout(() => {
          // Format the response to look like a regular query response
          // This allows it to be rendered in the DataMessenger
          this.onResponse(formattedResponse, queryText, id)
        }, 100)
      })
      .catch((error) => {
        if (error?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
          this.onResponse(error, queryText, id)
        }
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

    // Collapse suggestions when submitting a query
    if (this.state.isExpanded) {
      this.collapseSuggestions()
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
        <div className='react-autoql-query-input-wrapper' ref={(ref) => (this.queryInputWrapperRef = ref)}>
          {/* Query Suggestions - Always visible buttons */}
          {this.props.enableQuerySuggestions && this.props.enableQueryInputTopics && this.state.topics.length > 0 && (
            <div className={`react-autoql-input-query-suggestions ${this.state.isExpanded ? 'expanded' : ''}`}>
              {/* Expanded Sample Queries Section */}
              {this.state.isExpanded && this.state.selectedTopic && (
                <div className='query-suggestions-expanded'>
                  <div className='query-suggestions-expanded-header'>
                    {this.renderSampleQueriesHeader()}
                    <div className='query-suggestions-expanded-header-actions'>
                      <button className='query-suggestions-main-close' onClick={this.collapseSuggestions} type='button'>
                        <Icon type='close' />
                      </button>
                    </div>
                  </div>
                  <div className='query-suggestions-sample-list'>
                    <SampleQueryList
                      authentication={this.props.authentication}
                      columns={this.getColumnsForSuggestions()}
                      context={this.state.selectedTopic.context}
                      valueLabel={this.state.selectedTopic.valueLabel}
                      searchText=''
                      executeQuery={this.props.executeQuery}
                      skipQueryValidation={false}
                      userSelection={null}
                      tooltipID={this.props.tooltipID}
                      scope={this.props.scope}
                      shouldRender={this.props.shouldRender}
                      onSuggestionListResponse={() => {}}
                    />
                  </div>
                </div>
              )}

              {/* <div className='query-suggestions-label'>Quick Topics:</div> */}
              <div className='query-suggestions-buttons'>
                <span className='query-suggestions-buttons-label'>
                  <Icon type='lightning' /> Quick Topics:{' '}
                </span>
                {this.state.topics.map((topic, index) => (
                  <button
                    key={topic.context || index}
                    className={`query-suggestion-button ${
                      this.state.selectedTopic?.context === topic.context ? 'selected' : ''
                    }`}
                    onClick={() => this.onTopicClick(topic)}
                    type='button'
                  >
                    {topic.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={`react-autoql-bar-container ${this.props.className} ${
              this.props.autoCompletePlacement === 'below' ? 'autosuggest-bottom' : 'autosuggest-top'
            }`}
            data-test='chat-bar'
          >
            <div className='react-autoql-input-row'>
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
                {/* Microphone button inside input */}
                {!isMobile && this.props.enableVoiceRecord && (
                  <div className='input-microphone-button'>
                    <SpeechToTextButtonBrowser
                      onTranscriptStart={this.onTranscriptStart}
                      onTranscriptChange={this.onTranscriptChange}
                      onFinalTranscript={this.onFinalTranscript}
                      authentication={this.props.authentication}
                      tooltipID={this.props.tooltipID}
                    />
                  </div>
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
              {/* Send button */}
              <button
                className='react-autoql-input-send-button'
                onClick={() => this.submitQuery()}
                disabled={!this.state.inputValue || this.props.isDisabled}
                type='button'
              >
                <Icon type='send' />
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryInput)
