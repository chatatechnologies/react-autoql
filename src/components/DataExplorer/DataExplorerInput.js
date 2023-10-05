import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'

import {
  fetchDataExplorerAutocomplete,
  fetchSubjectList,
  REQUEST_CANCELLED_ERROR,
  animateInputText,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { TopicName } from './TopicName'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType } from '../../props/types'

import './DataExplorerInput.scss'

export default class DataExplorerInput extends React.Component {
  constructor(props) {
    super(props)

    this.componentKey = uuid()
    this.userTypedValue = null
    this.userSelectedValue = null
    this.isDirty = false

    this.state = {
      inputValue: '',
      loadingAutocomplete: false,
      recentSuggestions: [],
      suggestions: [],
      allSubjects: [],
    }
  }

  static propTypes = {
    authentication: authenticationType,
    inputPlaceholder: PropTypes.string,
    onClearInputClick: PropTypes.func,
    onSelection: PropTypes.func,
  }

  static defaultProps = {
    authentication: {},
    inputPlaceholder: 'Search terms or topics',
    onClearInputClick: () => {},
    onSelection: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.fetchAllSubjects()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.autoCompleteTimer)
    clearTimeout(this.inputAnimationTimeout)
  }

  isAggSeed(subject) {
    return (
      subject.displayName.toLowerCase().endsWith('by week') ||
      subject.displayName.toLowerCase().endsWith('by month') ||
      subject.displayName.toLowerCase().endsWith('by day') ||
      subject.displayName.toLowerCase().endsWith('by year')
    )
  }
  fetchAllSubjects = () => {
    fetchSubjectList({ ...this.props.authentication })
      .then((subjects) => {
        if (!subjects?.length) {
          return
        }

        const allSubjects = subjects
          .filter((subject) => !this.isAggSeed(subject))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))

        if (this._isMounted) {
          this.setState({
            allSubjects,
          })
        }
      })
      .catch((error) => console.error(error))
  }

  blurInput = () => {
    this.autoSuggest?.input?.blur()
  }

  // Keep this in case we want to revert back
  // It seems to be much faster than QC searching the cache
  // subjectAutocompleteMatch = (input) => {
  //   if (input == '') {
  //     return []
  //   }

  //   var reg = new RegExp(`^${input.toLowerCase()}`)
  //   return this.state.allSubjects.filter((subject) => {
  //     const term = subject.displayName.toLowerCase()
  //     if (term.match(reg)) {
  //       return subject
  //     }
  //   })
  // }

  getNewRecentSuggestions = (subject) => {
    const recentSuggestions = _cloneDeep(this.state.recentSuggestions)

    // If value already exists in recent list, move it to the top
    const index = recentSuggestions.findIndex((subj) => _isEqual(subj, subject))
    if (index > -1) {
      recentSuggestions.splice(index, 1)
    }

    // Maximum length of list should be 5
    if (recentSuggestions.length === 5) {
      recentSuggestions.splice(-1)
    }

    recentSuggestions.unshift(subject)
    return recentSuggestions
  }

  selectSubject = (subject) => {
    if (this._isMounted) {
      this.userSelectedValue = null
      this.setState({
        inputValue: subject.displayName,
        recentSuggestions: this.getNewRecentSuggestions(subject),
      })
      this.props.onSelection(subject)
    }
  }

  submitRawText = (text = '', skipQueryValidation) => {
    let subject = this.state.allSubjects.find(
      (subj) => subj.displayName.toLowerCase().trim() === text.toLowerCase().trim(),
    )

    if (subject) {
      this.selectSubject(subject)
    } else {
      subject = {
        type: 'text',
        displayName: text,
      }
    }

    this.props.onSelection(subject, skipQueryValidation)
    this.setState({
      recentSuggestions: this.getNewRecentSuggestions(subject),
      inputValue: subject.displayName,
    })
  }

  animateTextAndSubmit = (text) => {
    animateInputText({
      text,
      inputRef: this.inputRef,
      callback: () => this.submitRawText(text, true),
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
    if (e.key == 'Enter') {
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
    if (selectedItem?.displayName && this._isMounted) {
      this.setState({ inputValue: selectedItem.displayName })
    }
  }

  cancelCurrentRequest = () => {
    this.axiosSource?.cancel(REQUEST_CANCELLED_ERROR.CANCELLED)
  }

  requestSuggestions = (value) => {
    // const value = this.userTypedValue
    this.setState({ loadingAutocomplete: true, loadingAutocompleteText: value })

    clearTimeout(this.autoCompleteTimer)
    this.cancelCurrentRequest()
    this.axiosSource = axios.CancelToken?.source()
    this.autoCompleteTimer = setTimeout(() => {
      fetchDataExplorerAutocomplete({
        suggestion: value,
        ...this.props.authentication,
        cancelToken: this.axiosSource?.token,
      })
        .then((suggestions) => {
          this.setState({
            suggestions,
            loadingAutocomplete: false,
          })
        })
        .catch((error) => {
          if (error?.data?.message !== REQUEST_CANCELLED_ERROR.CANCELLED) {
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
        <strong>{section.title}</strong>
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
    const hasRecentSuggestions = !!this.state.recentSuggestions?.length
    const inputIsEmpty = !this.userTypedValue
    const doneLoading = !this.state.loadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length // && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading

    // Recently used
    if (hasRecentSuggestions) {
      sections.push({
        title: 'Recent',
        suggestions: this.state.recentSuggestions,
      })
    }

    // Suggestion list
    if (inputIsEmpty) {
      sections.push({
        title: 'All Topics',
        suggestions: this.state.allSubjects,
      })
    } else if (hasSuggestions) {
      sections.push({
        title: `Related to "${this.state.loadingAutocompleteText}"`,
        suggestions: this.state.suggestions,
      })
    } else if (noSuggestions) {
      sections.push({
        title: `Related to "${this.state.loadingAutocompleteText}"`,
        suggestions: [{ name: '' }],
        emptyState: true,
      })
    }

    return sections
  }

  renderSuggestion = (suggestion) => {
    return <TopicName topic={suggestion} />
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
        data-for={this.props.tooltipID ?? 'explore-queries-tooltips'}
        data-tip='Clear Search'
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
          }`}
          data-test='data-explorer-autocomplete'
        >
          <Autosuggest
            id={`data-explorer-autosuggest-${this.componentKey}`}
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
