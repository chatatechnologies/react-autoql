import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'
import { isMobile } from 'react-device-detect'
import {
  fetchDataExplorerAutocomplete,
  fetchSubjectList,
  REQUEST_CANCELLED_ERROR,
  animateInputText,
  DataExplorerTypes,
  parseJwt,
  normalizeString,
} from 'autoql-fe-utils'
import { isAbortError, createCancelPair } from '../../utils/abortUtils'

import { Icon } from '../Icon'
import { SubjectName } from './SubjectName'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../props/types'

import './DataExplorerInput.scss'

export default class DataExplorerInput extends React.Component {
  constructor(props) {
    super(props)

    this.MAX_RECENT_SEARCHES = 3
    this.KEY = uuid()

    this.userTypedValue = null
    this.userSelectedValue = null
    this.isDirty = false

    this.state = {
      inputValue: '',
      loadingAutocomplete: false,
      recentSearches: this.getRecentSearchesFromLocalStorage(props),
      suggestions: [],
      allSubjects: [],
    }
  }

  static propTypes = {
    authentication: authenticationType,
    inputPlaceholder: PropTypes.string,
    onClearInputClick: PropTypes.func,
    onSelection: PropTypes.func,
    disableColumnSelection: PropTypes.bool,
  }

  static defaultProps = {
    authentication: {},
    inputPlaceholder: 'Search terms or topics',
    onClearInputClick: () => {},
    onSelection: () => {},
    disableColumnSelection: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.fetchAllSubjects()
  }

  componentDidUpdate = () => {
    this.setRecentSearchesInLocalStorage()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.inputAnimationTimeout)
  }

  getRecentSearchesFromLocalStorage = (props) => {
    try {
      const id = this.getRecentSelectionID(props)

      if (!id) {
        return []
      }

      const recentSearchesStr = localStorage.getItem(id)
      const recentSearchesArray = JSON.parse(recentSearchesStr)

      if (recentSearchesArray?.constructor !== Array || !recentSearchesArray?.length) {
        return []
      }

      const filteredRecentSearchesArray = recentSearchesArray.filter((subject, i, self) => {
        return self.findIndex((subj) => subj.displayName === subject.displayName) === i
      })

      if (filteredRecentSearchesArray?.length) {
        return filteredRecentSearchesArray
      }
    } catch (error) {
      console.error(error)
    }

    return []
  }

  getRecentSelectionID = (props) => {
    if (!props?.authentication?.token) {
      return
    }

    try {
      const tokenInfo = parseJwt(props.authentication.token)
      const id = `data-explorer-recent-${tokenInfo.user_id}-${tokenInfo.project_id}`
      return id
    } catch (error) {
      console.error(error)
      return
    }
  }

  setRecentSearchesInLocalStorage = () => {
    try {
      const id = this.getRecentSelectionID(this.props)
      if (!id) {
        return
      }

      const recentSearchesStr = JSON.stringify(this.state.recentSearches)
      localStorage.setItem(id, recentSearchesStr)
    } catch (error) {
      console.error(error)
    }
  }

  fetchAllSubjects = () => {
    fetchSubjectList({ ...this.props.authentication })
      .then((subjects) => {
        if (this._isMounted) {
          if (subjects?.length) {
            const filteredSubjects = subjects.filter((subj) => !subj.isAggSeed())
            this.setState({ allSubjects: filteredSubjects })
          }
        }
      })
      .catch((error) => console.error(error))
  }

  blurInput = () => {
    this.autoSuggest?.input?.blur()
  }

  // Filter subjects from the local list based on input
  subjectAutocompleteMatch = (input) => {
    if (input === '') {
      return []
    }

    const reg = new RegExp(`^${input.toLowerCase()}`)
    return this.state.allSubjects.filter((subject) => {
      const term = subject.displayName.toLowerCase()
      if (term.match(reg)) {
        return subject
      }
    })
  }

  getNewrecentSearches = (subject) => {
    const recentSearches = _cloneDeep(this.state.recentSearches)

    // If value already exists in recent list, move it to the top
    const index = recentSearches.findIndex((subj) => subj.displayName === subject.displayName)
    if (index > -1) {
      recentSearches.splice(index, 1)
    }

    // Maximum length of list should be 5
    if (recentSearches.length === this.MAX_RECENT_SEARCHES) {
      recentSearches.splice(-1)
    }

    recentSearches.unshift(subject)
    return recentSearches
  }

  selectSubject = (subject) => {
    if (this._isMounted) {
      this.userSelectedValue = null
      this.setState({
        inputValue: subject.displayName,
        recentSearches: this.getNewrecentSearches(subject),
      })
      this.props.onSelection(subject)
    }
  }

  submitRawText = (text = '', skipQueryValidation) => {
    const subject = this.state.allSubjects.find((subj) => normalizeString(subj?.displayName) === normalizeString(text))

    if (subject) {
      this.selectSubject(subject)
      return
    }

    const vl = this.state.suggestions.find(
      (sugg) => normalizeString(sugg?.valueLabel?.format_txt) === normalizeString(text),
    )

    if (vl) {
      this.selectSubject(vl)
      return
    }

    const topic = {
      type: DataExplorerTypes.TEXT_TYPE,
      displayName: text,
    }

    this.props.onSelection(topic, skipQueryValidation)
    this.setState({
      recentSearches: this.getNewrecentSearches(topic),
      inputValue: topic.displayName,
    })
  }

  animateTextAndSubmit = (text) => {
    animateInputText({
      text,
      inputRef: this.inputRef,
      totalAnimationTime: 500,
      callback: () => {
        this.submitRawText(text, true)
      },
    })
  }

  onInputChange = (e) => {
    if (this._isMounted) {
      if (!!this.userSelectedValue && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        // keyup or keydown
        return // return to let the component handle it...
      }

      if ((e?.target?.value || e?.target?.value === '') && e.key !== 'Enter') {
        this.userSelectedValue = null
        this.userTypedValue = e.target.value
        this.isDirty = true
        this.setState({ inputValue: e.target.value })
      } else {
        // User clicked on autosuggest item
        this.selectSubject(this.userSelectedValue)
      }
    }
  }

  onInputFocus = () => {
    if (this._isMounted) {
      this.setState({ inputFocused: true })
    }
  }

  onInputBlur = () => {
    if (this._isMounted) {
      this.setState({ inputFocused: false })
    }
  }

  onKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (this.userSelectedValue) {
        this.selectSubject(this.userSelectedValue)
      } else if (this.state.inputValue) {
        this.submitRawText(this.state.inputValue)
      }
      this.blurInput()
    }
  }

  clearInput = () => {
    if (this._isMounted) {
      this.setState({ inputValue: '' })
      this.userTypedValue = null
      this.userSelectedValue = null
      this.props.onClearInputClick()
    }
  }

  userSelectedSuggestionHandler = (selectedItem) => {
    this.userSelectedValue = selectedItem
    const itemName = selectedItem?.displayName
    if (itemName && this._isMounted) {
      this.setState({ inputValue: itemName })
    }
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.controller?.abort(REQUEST_CANCELLED_ERROR)
  }

  requestSuggestions = (value) => {
    this.setState({ loadingAutocomplete: true, loadingAutocompleteText: value })

    clearTimeout(this.autoCompleteTimer)
    this.cancelCurrentRequest()
    this.axiosSource = createCancelPair()
    this.autoCompleteTimer = setTimeout(() => {
      fetchDataExplorerAutocomplete({
        suggestion: value,
        ...this.props.authentication,
        signal: this.axiosSource?.signal,
        cancelToken: this.axiosSource?.cancelToken,
      })
        .then((suggestions) => {
          this.setState({
            suggestions,
            loadingAutocomplete: false,
          })
        })
        .catch((error) => {
          if (!isAbortError(error)) {
            console.error(error)
            this.setState({ suggestions: [], loadingAutocomplete: false })
          }
        })
    }, 100)
  }

  onSuggestionsFetchRequested = ({ value }) => {
    if (!value || !this.isDirty) {
      return
    }

    // Skip VLAutocomplete API call if column selection is disabled, but still search local subjects
    if (this.props.disableColumnSelection) {
      if (this._isMounted) {
        const matchedSubjects = this.subjectAutocompleteMatch(value)
        this.setState({
          suggestions: matchedSubjects,
          loadingAutocomplete: false,
          loadingAutocompleteText: value,
        })
      }
      return
    }

    if (this._isMounted) {
      this.requestSuggestions(value)
    }
  }

  onSuggestionsClearRequested = () => {
    if (this._isMounted) {
      this.setState({
        suggestions: [],
      })
    }
  }

  renderSectionTitle = (section) => {
    return (
      <>
        <div className='data-explorer-section-title-wrapper'>
          <strong>{section.title}</strong>
          {section?.action ?? null}
        </div>
        {section.emptyState ? (
          <div className='data-explorer-no-suggestions'>
            <em>No results</em>
          </div>
        ) : null}
      </>
    )
  }

  getSectionSuggestions = (section) => {
    return section.suggestions
  }

  hasNoSuggestions = () => {
    return !this.state.suggestions?.length && !this.state.loadingAutocomplete && !!this.userTypedValue
  }

  getSuggestions = () => {
    const sections = []
    const hasrecentSearches = !!this.state.recentSearches?.length
    const inputIsEmpty = !this.userTypedValue
    const doneLoading = !this.state.loadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length // && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading

    // Recently used
    if (hasrecentSearches) {
      sections.push({
        title: <span>Recent</span>,
        action: (
          <span className='data-explorer-clear-history-btn' onClick={() => this.setState({ recentSearches: [] })}>
            Clear history
          </span>
        ),
        suggestions: this.state.recentSearches,
      })
    }

    // Suggestion list
    if (inputIsEmpty) {
      sections.push({
        title: 'Topics',
        suggestions: this.state.allSubjects,
      })
    } else if (hasSuggestions) {
      const title = this.props.disableColumnSelection ? 'Topics' : `Related to "${this.state.loadingAutocompleteText}"`
      sections.push({
        title,
        suggestions: this.state.suggestions,
      })
    } else if (noSuggestions && !this.props.disableColumnSelection) {
      // Only show "no suggestions" state when using autocomplete API
      sections.push({
        title: `Related to "${this.state.loadingAutocompleteText}"`,
        suggestions: [{ displayName: '' }],
        emptyState: true,
      })
    }

    return sections
  }

  renderSuggestion = (suggestion) => {
    return <SubjectName subject={suggestion} />
  }

  renderSuggestionsContainer = ({ containerProps, children }) => {
    let maxHeight = 250
    const dataExplorerHeight = this.props.dataExplorerRef?.clientHeight - 200
    if (!isNaN(dataExplorerHeight) && dataExplorerHeight > 250) {
      maxHeight = dataExplorerHeight
    }

    return (
      <div {...containerProps}>
        <div className='react-autoql-data-explorer-suggestion-container'>
          <CustomScrollbars autoHeight autoHeightMin={0} maxHeight={maxHeight}>
            {children}
          </CustomScrollbars>
        </div>
      </div>
    )
  }

  renderInputIcon = () => {
    return (
      <div className='chat-bar-input-icon'>
        <Icon
          type='search'
          style={{
            width: '19px',
            height: '20px',
            color: 'var(--react-autoql-text-color-placeholder)',
          }}
        />
      </div>
    )
  }

  renderClearInputBtn = () => {
    return (
      <div
        className={`chat-bar-clear-btn ${this.state.inputValue ? 'visible' : ''}`}
        data-tooltip-id={this.props.tooltipID ?? 'explore-queries-tooltips'}
        data-tooltip-content='Clear Search'
      >
        <Icon type='close' onClick={this.clearInput} />
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-chatbar-input-container data-explorer ${
            this.hasNoSuggestions() ? 'no-suggestions' : ''
          } ${isMobile ? 'mobile' : ''}`}
          data-test='data-explorer-autocomplete'
        >
          <Autosuggest
            id={`data-explorer-autosuggest-${this.KEY}`}
            className='react-autoql-data-explorer-autosuggest'
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            getSuggestionValue={this.userSelectedSuggestionHandler}
            renderSuggestionsContainer={this.renderSuggestionsContainer}
            suggestions={this.getSuggestions()}
            multiSection={true}
            renderSectionTitle={this.renderSectionTitle}
            getSectionSuggestions={this.getSectionSuggestions}
            shouldRenderSuggestions={() => true}
            ref={(ref) => (this.autoSuggest = ref)}
            renderSuggestion={this.renderSuggestion}
            focusInputOnSuggestionClick={false}
            inputProps={{
              ref: (r) => (this.inputRef = r),
              className: 'react-autoql-chatbar-input',
              placeholder: this.props.inputPlaceholder,
              'data-test': 'data-explorer-input-component',
              value: this.state.inputValue,
              onChange: this.onInputChange,
              onKeyPress: this.onKeyPress,
              onFocus: this.onInputFocus,
              onBlur: this.onInputBlur,
            }}
          />
          {this.renderInputIcon()}
          {this.renderClearInputBtn()}
        </div>
      </ErrorBoundary>
    )
  }
}
