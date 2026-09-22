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
  fetchDataPreview,
  transformQueryResponse,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import SampleQueryList from '../DataExplorer/SampleQueryList'
import FieldSelector from '../FieldSelector'
import DataPreview from '../DataExplorer/DataPreview'
import { CustomScrollbars } from '../CustomScrollbars'

import { withTheme } from '../../theme'
import { dprQuery } from '../../js/dprService'
import { fetchSubjectListCached } from '../../js/subjectListService'
import { lang } from '../../js/Localization'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './QueryInput.scss'

class QueryInput extends React.Component {
  constructor(props) {
    super(props)

    this.UNIQUE_ID = uuid()
    this.TOOLTIP_ID = `react-autoql-query-input-tooltip-${this.UNIQUE_ID}`
    this.MAX_QUERY_HISTORY = 5
    this.autoCompleteTimer = undefined
    this.autoCompleteArray = []

    // Store selectedColumns per topic context for persistence
    this.selectedColumnsByTopic = {}
    // Store dataPreview per topic context to avoid refetching
    this.dataPreviewByTopic = {}

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
      topicsCollapsed: false,
      leftContentWidth: 0,
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
    quickTopicsPlacement: PropTypes.oneOf(['above', 'below']),
    showChataIcon: PropTypes.bool,
    // Rendered at the left end of the input, inside the pill. For controls that
    // scope the query (the filter lock) rather than compose it.
    leftContent: PropTypes.node,
    inputValue: PropTypes.string,
    queryFilters: PropTypes.arrayOf(PropTypes.shape({})),
    placeholder: PropTypes.string,
    clearQueryOnSubmit: PropTypes.bool,
    // DPR session — sent as the AutoAE-Session-ID header by dprQuery. Unrelated
    // to querySessionId below: different service, different transport.
    sessionId: PropTypes.string,
    // Chat session this input belongs to. Sent to the query endpoint as the
    // AutoQL-Session-ID header, and ONLY from here — the subqueries QueryOutput
    // fires for sorting/filtering/added columns/drilldowns deliberately don't
    // carry it, since a session tracks what the user actually asked for.
    // Undefined unless the consumer enables sessions (see ChatContent's
    // enableSessions), and undefined omits the header entirely.
    querySessionId: PropTypes.string,
    dataPageSize: PropTypes.number,
    shouldRender: PropTypes.bool,
    enableQuerySuggestions: PropTypes.bool,
    enableQueryInputTopics: PropTypes.bool,
    columns: PropTypes.array,
    executeQuery: PropTypes.func,
    disableColumnSelection: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    enableVoiceRecord: false,
    isDisabled: false,
    autoCompletePlacement: 'above',
    quickTopicsPlacement: 'above',
    className: null,
    showChataIcon: true,
    leftContent: undefined,
    isBackButtonClicked: false,
    inputValue: undefined,
    source: null,
    queryFilters: undefined,
    clearQueryOnSubmit: true,
    enableQuerySuggestions: true,
    enableQueryInputTopics: true,
    placeholder: undefined,
    dataPageSize: undefined,
    shouldRender: true,
    onSubmit: () => {},
    onResponseCallback: () => {},
    addResponseMessage: () => {},
    executeQuery: () => {},
    disableColumnSelection: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    document.addEventListener('keydown', this.onEscKeypress)
    document.addEventListener('mousedown', this.handleClickOutside)
    this.observeLeftContent()

    // Fetch topics if enabled
    if (this.props.enableQueryInputTopics) {
      this.fetchTopics()
    }
  }

  // The controls at the head of the pill (a consumer's leftContent — the Data
  // Messenger's filter lock — and the collapsed Quick Topics button) are absolutely
  // positioned, so the text has to be padded clear of them and each has to be
  // offset past the one before it.
  //
  // Those numbers are computed here and applied inline rather than expressed in
  // SCSS: the input's padding is set by several layout-specific ancestor rules (the
  // LLM empty state's is four classes deep), so a class-based rule loses the cascade
  // in exactly the layouts that need it most. leftContent's width is measured rather
  // than assumed, because the filter lock widens when it holds filters.
  observeLeftContent = () => {
    const element = this.leftContentRef

    if (!element) {
      return
    }

    const measure = () => {
      const width = element.offsetWidth ?? 0

      if (this._isMounted && width !== this.state.leftContentWidth) {
        this.setState({ leftContentWidth: width })
      }
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      this.leftContentObserver = new ResizeObserver(measure)
      this.leftContentObserver.observe(element)
    }
  }

  // Where the head-of-pill controls start, measured from the input CONTAINER's edge,
  // and how far the input's own left edge is inside that container.
  getLeftControlGeometry = () => {
    return {
      controlsStart: 18,
      // .react-autoql-chatbar-input's own margin.
      inputMargin: 10,
      gap: 6,
      // .topics-collapsed-icon's fixed size.
      collapsedIconWidth: 24,
      // Air between the last control and the first character.
      textGap: 10,
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

    if (prevProps.isDisabled && !this.props.isDisabled) {
      this.focus()
    }

    // leftContent can arrive after mount — a session tab that mounts in the
    // background has none until it becomes the active tab — so the measurement has
    // to be (re)started here as well, or the padding stays at the unmeasured default.
    if (!!this.props.leftContent !== !!prevProps.leftContent) {
      this.leftContentObserver?.disconnect()
      this.leftContentObserver = undefined

      if (this.props.leftContent) {
        this.observeLeftContent()
      } else if (this.state.leftContentWidth) {
        this.setState({ leftContentWidth: 0 })
      }
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    this.leftContentObserver?.disconnect()
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.queryValidationTimer)
    clearTimeout(this.caretMoveTimeout)
    document.removeEventListener('keydown', this.onEscKeypress)
    document.removeEventListener('mousedown', this.handleClickOutside)
    this.axiosSourceDataPreview?.cancel(REQUEST_CANCELLED_ERROR)
  }

  fetchTopics = () => {
    // Cached: every session tab mounts its own QueryInput, all asking for the same list.
    fetchSubjectListCached(this.props.authentication)
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
    // Restore selectedColumns and dataPreview for this topic if they exist
    const topicKey = topic?.context || 'default'
    const savedColumns = this.selectedColumnsByTopic[topicKey] || []
    const cachedDataPreview = this.dataPreviewByTopic[topicKey]

    // Set the selected topic and expand the container
    this.setState(
      {
        selectedTopic: topic,
        isExpanded: true,
        isDataPreviewLoading: !cachedDataPreview, // Only show loading if we don't have cached data
        selectedColumns: savedColumns,
        dataPreview: cachedDataPreview, // Use cached data if available
      },
      () => {
        // Only fetch data preview if we don't have cached data
        if (!cachedDataPreview) {
          this.fetchDataPreviewData()
        }
      },
    )
  }

  collapseSuggestions = () => {
    // Save selectedColumns and dataPreview for current topic before collapsing (even if empty)
    if (this.state.selectedTopic?.context) {
      const topicKey = this.state.selectedTopic.context
      this.selectedColumnsByTopic[topicKey] = [...(this.state.selectedColumns || [])]
      // Cache dataPreview if it exists
      if (this.state.dataPreview) {
        this.dataPreviewByTopic[topicKey] = this.state.dataPreview
      }
    }

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
            onColumnsChange={(selectedColumns) => {
              this.setState({ selectedColumns })
              // Persist selectedColumns for current topic
              if (this.state.selectedTopic?.context) {
                const topicKey = this.state.selectedTopic.context
                this.selectedColumnsByTopic[topicKey] = [...selectedColumns]
              }
            }}
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
    // QueryInput quick topics should never include valueLabel
    // For quick topics, pass columns without values to keep query_to_start empty
    if (!this.state.selectedColumns?.length) {
      return undefined
    }

    let columns = {}

    this.state.selectedColumns.forEach((columnIndex) => {
      const column = this.state.dataPreview?.data?.data?.columns[columnIndex]
      if (column && !columns[column.name]) {
        // Pass columns without values for quick topics to keep query_to_start empty
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

          // Cache the data preview for this topic
          if (this.state.selectedTopic?.context) {
            const topicKey = this.state.selectedTopic.context
            this.dataPreviewByTopic[topicKey] = response
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
        if (error?.message === REQUEST_CANCELLED_ERROR) {
          // onResponse is what normally clears isQueryRunning, and a cancel skips it -
          // without this the input stays stuck showing the stop button.
          if (this._isMounted) {
            this.setState({ isQueryRunning: false })
          }
          return
        }

        console.error(error)
        this.onResponse(error, queryText, id)
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
    // A data preview sets isQueryRunning just like a regular query, so the stop button
    // has to reach its request too - otherwise the preview lands after the stop (or
    // after the thread was cleared) and repopulates it.
    this.axiosSourceDataPreview?.cancel(REQUEST_CANCELLED_ERROR)
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
      sessionId: this.props.querySessionId,
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
    if (value === undefined || value === null || value === '') {
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

  moveCaretAtEnd = () => {
    clearTimeout(this.caretMoveTimeout)
    this.caretMoveTimeout = setTimeout(() => {
      try {
        const length = this.inputRef?.value?.length
        this.inputRef?.setSelectionRange(length, length)
      } catch (error) {}
    }, 0)
  }

  render = () => {
    const isQueryRunning = this.state.isQueryRunning
    const hasMicrophone = !isMobile && this.props.enableVoiceRecord

    const showTopics =
      this.props.enableQuerySuggestions && this.props.enableQueryInputTopics && this.state.topics.length > 0
    const showCollapsedIcon = showTopics && this.state.topicsCollapsed
    const { controlsStart, inputMargin, gap, collapsedIconWidth, textGap } = this.getLeftControlGeometry()

    // Widths of the controls at the head of the pill, in the order they sit.
    const leftControlWidths = []
    if (this.props.leftContent) {
      leftControlWidths.push(this.state.leftContentWidth || collapsedIconWidth)
    }
    if (showCollapsedIcon) {
      leftControlWidths.push(collapsedIconWidth)
    }

    const leftControlsWidth = leftControlWidths.reduce(
      (total, width, index) => total + width + (index ? gap : 0),
      0,
    )
    // The collapsed Quick Topics button follows anything before it.
    const collapsedIconLeft = controlsStart + (this.props.leftContent ? leftControlWidths[0] + gap : 0)
    const inputPaddingLeft = leftControlsWidth
      ? controlsStart + leftControlsWidth + textGap - inputMargin
      : undefined

    const inputProps = {
      ref: this.setInputRef,
      id: this.UNIQUE_ID,
      className: `${this.UNIQUE_ID} react-autoql-query-input react-autoql-chatbar-input${
        this.props.showChataIcon ? ' left-padding' : ''
      }`,
      placeholder: this.props.placeholder ?? lang.queryPrompt,
      disabled: this.props.isDisabled,
      onChange: this.onInputChange,
      onKeyPress: this.onKeyPress,
      onKeyDown: this.onKeyDown,
      value: this.state.inputValue,
      onBlur: () => this.setState({ suggestions: [] }),
      onClick: this.showQueryHistorySuggestions,
      spellCheck: false,
      autoFocus: true,
      autoComplete: 'one-time-code',
      // Inline, so no layout-specific ancestor rule can outrank it.
      style: inputPaddingLeft ? { paddingLeft: `${inputPaddingLeft}px` } : undefined,
    }

    const isTopicsBelow = this.props.quickTopicsPlacement === 'below'

    const toggleTopicsCollapsed = () =>
      this.setState((s) => ({
        topicsCollapsed: !s.topicsCollapsed,
        isExpanded: s.topicsCollapsed ? s.isExpanded : false,
      }))

    const renderExpandedContent = () => (
      <>
        {this.state.isExpanded && this.state.selectedTopic && (
          <div className='query-suggestions-expanded'>
            <div className='query-suggestions-expanded-header'>
              {this.props.disableColumnSelection ? (
                <div className='react-autoql-data-explorer-title-text'>
                  <span className='react-autoql-data-explorer-title-text-sample-queries'>
                    {this.state.selectedTopic.displayName}
                  </span>
                </div>
              ) : (
                this.renderSampleQueriesHeader()
              )}
              <div className='query-suggestions-expanded-header-actions'>
                <button className='query-suggestions-main-close' onClick={this.collapseSuggestions} type='button'>
                  <Icon type='close' />
                </button>
              </div>
            </div>
            {this.props.disableColumnSelection ? (
              <div className='query-suggestions-data-preview'>
                <DataPreview
                  authentication={this.props.authentication}
                  dataFormatting={this.props.dataFormatting}
                  subject={this.state.selectedTopic}
                  // Columns are picked through the FieldSelector in the header
                  // above, so this preview is only ever a table.
                  selectable={false}
                  shouldRender={this.props.shouldRender}
                  tooltipID={this.props.tooltipID}
                />
              </div>
            ) : (
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
            )}
          </div>
        )}
      </>
    )

    const renderQuerySuggestions = () => {
      return (
        <div
          className={`react-autoql-input-query-suggestions ${this.state.isExpanded ? 'expanded' : ''} ${
            this.state.topicsCollapsed ? 'topics-collapsed' : ''
          } placement-${isTopicsBelow ? 'below' : 'above'}`}
        >
          {renderExpandedContent()}

          <CustomScrollbars suppressScrollY className='query-suggestions-buttons-wrapper' style={{ width: '100%' }}>
            <div className='query-suggestions-buttons'>
              <button
                className='query-suggestions-collapse-btn'
                onClick={toggleTopicsCollapsed}
                type='button'
                data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
                data-tooltip-content='Hide Quick Topics'
                data-tooltip-place='top'
              >
                <Icon type='caret-down' />
                <span className='query-suggestions-buttons-label'>
                  <Icon type='lightning' /> Quick Topics:{' '}
                </span>
              </button>
              {this.state.topics.map((topic, index) => (
                <button
                  key={`topic-${index}-${topic.context || ''}`}
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
          </CustomScrollbars>
        </div>
      )
    }

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-query-input-wrapper ${isTopicsBelow ? 'topics-below' : 'topics-above'}`}
          ref={(ref) => (this.queryInputWrapperRef = ref)}
        >
          {/* Query Suggestions - Render ABOVE input when placement is 'above' */}
          {showTopics && !isTopicsBelow && renderQuerySuggestions()}

          <div
            className={`react-autoql-bar-container ${this.props.className} ${
              this.props.autoCompletePlacement === 'below' ? 'autosuggest-bottom' : 'autosuggest-top'
            }`}
            data-test='chat-bar'
          >
            <div className='react-autoql-input-row'>
              <div
                className={`react-autoql-chatbar-input-container${
                  showCollapsedIcon ? ' has-collapsed-icon' : ''
                }${this.props.leftContent ? ' has-left-content' : ''}${hasMicrophone ? ' has-microphone' : ''}`}
              >
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
                {/* Controls that scope the query rather than compose it (the filter
                    lock) sit at the head of the input, where you'd read them before
                    typing. */}
                {this.props.leftContent && (
                  <div className='react-autoql-input-left-content' ref={(r) => (this.leftContentRef = r)}>
                    {this.props.leftContent}
                  </div>
                )}
                {/* Lightning bolt icon inside input when topics are collapsed */}
                {showTopics && (
                  <button
                    className={`topics-collapsed-icon${this.state.topicsCollapsed ? ' visible' : ''}`}
                    style={{ left: `${collapsedIconLeft}px` }}
                    onClick={toggleTopicsCollapsed}
                    type='button'
                    data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
                    data-tooltip-content='Show Quick Topics'
                    data-tooltip-place='right'
                  >
                    <Icon type='lightning' />
                  </button>
                )}
                {/* Microphone button inside input */}
                {hasMicrophone && (
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
                {/* Send, inside the pill at the right end - the same place the Data
                    Agent composer puts it. While a query is running it becomes a
                    stop button, cancelling the request exactly as Escape does; a
                    greyed-out button in that moment offered nothing. */}
                <button
                  className={`react-autoql-input-send-button${isQueryRunning ? ' is-stop' : ''}`}
                  onClick={() => (isQueryRunning ? this.cancelQuery() : this.submitQuery())}
                  // isDisabled is set by the consumer while a query runs, so the
                  // stop state deliberately ignores it - that is the one moment the
                  // button has something to do.
                  disabled={!isQueryRunning && (!this.state.inputValue || this.props.isDisabled)}
                  type='button'
                  aria-label={isQueryRunning ? 'Stop query' : 'Send query'}
                  data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
                  data-tooltip-content={isQueryRunning ? 'Stop query' : undefined}
                >
                  {isQueryRunning ? <span className='react-autoql-input-stop-glyph' /> : <Icon type='send' />}
                </button>
              </div>
              {this.props.showChataIcon && (
                <div className='chat-bar-input-icon'>
                  <Icon type='react-autoql-bubbles-outlined' />
                </div>
              )}
              {/* No loading dots here: the stop button occupies this corner while a
                  query runs and already carries the "working on it" meaning, so the
                  dots would be both redundant and on top of it. */}
            </div>
          </div>

          {/* Query Suggestions - Render BELOW input when placement is 'below' */}
          {showTopics && isTopicsBelow && renderQuerySuggestions()}
        </div>
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} positionStrategy='fixed' />}
      </ErrorBoundary>
    )
  }
}

export default withTheme(QueryInput)
