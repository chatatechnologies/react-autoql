import React from 'react'
import PropTypes from 'prop-types'
import axios from 'axios'
import Autosuggest from 'react-autosuggest'
import { fetchVLAutocomplete, REQUEST_CANCELLED_ERROR, getAuthentication, authenticationDefault } from 'autoql-fe-utils'
import { CustomScrollbars } from '../CustomScrollbars'

import { authenticationType } from '../../props/types'
import '../FilterLockPopover/FilterLockPopover.scss'

export default class DashboardSlicer extends React.Component {
  constructor(props) {
    super(props)

    this.autoCompleteArray = []
    this.autocompleteDelay = 100
    this.axiosSource = null
    this.autocompleteTimer = null
    this.MAX_RECENT_SELECTIONS = 5
    this.userTypedValue = null
  }

  static propTypes = {
    authentication: authenticationType,
    context: PropTypes.string,
    value: PropTypes.shape({}),
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    dashboardId: PropTypes.string,
    slicerSuggestion: PropTypes.string,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    context: undefined,
    value: null,
    onChange: () => {},
    placeholder: 'Select a slicer...',
    dashboardId: undefined,
    slicerSuggestion: undefined,
  }

  state = {
    suggestions: [],
    inputValue: '',
    isLoadingAutocomplete: false,
    recentSelections: [],
  }

  componentDidMount = () => {
    if (this.props.value) {
      this.setState({ inputValue: this.props.value.format_txt || '' })
    }
    this.loadRecentSelections()
  }

  getRecentSelectionsKey = () => {
    const dashboardId = this.props.dashboardId || 'default'
    return `react-autoql-dashboard-slicer-recent-${dashboardId}`
  }

  loadRecentSelections = () => {
    try {
      const key = this.getRecentSelectionsKey()
      const recentStr = localStorage.getItem(key)
      if (recentStr) {
        const recent = JSON.parse(recentStr)
        if (Array.isArray(recent) && recent.length > 0) {
          this.setState({ recentSelections: recent })
        }
      }
    } catch (error) {
      console.error('Error loading recent selections:', error)
    }
  }

  saveRecentSelections = (selections) => {
    try {
      const key = this.getRecentSelectionsKey()
      localStorage.setItem(key, JSON.stringify(selections))
    } catch (error) {
      console.error('Error saving recent selections:', error)
    }
  }

  addToRecentSelections = (selection) => {
    // Remove if already exists
    const filtered = this.state.recentSelections.filter((s) => {
      return s.key !== selection.key || s.value !== selection.value
    })

    // Add to beginning
    const updated = [selection, ...filtered].slice(0, this.MAX_RECENT_SELECTIONS)

    this.setState({ recentSelections: updated })
    this.saveRecentSelections(updated)
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.value !== this.props.value) {
      this.setState({ inputValue: this.props.value?.format_txt || '' })
    }
  }

  componentWillUnmount = () => {
    if (this.axiosSource) {
      this.axiosSource.cancel(REQUEST_CANCELLED_ERROR)
    }
    if (this.autocompleteTimer) {
      clearTimeout(this.autocompleteTimer)
    }
  }

  fetchSuggestions = ({ value }) => {
    // If already fetching autocomplete, cancel it
    if (this.axiosSource) {
      this.axiosSource.cancel(REQUEST_CANCELLED_ERROR)
    }

    this.setState({ isLoadingAutocomplete: true })
    this.axiosSource = axios.CancelToken?.source()

    fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
      context: this.props.context,
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        const body = response?.data?.data
        const sortingArray = []
        let suggestionsMatchArray = []
        this.autoCompleteArray = []
        suggestionsMatchArray = body.matches || []

        for (let i = 0; i < suggestionsMatchArray.length; i++) {
          sortingArray.push(suggestionsMatchArray[i])
        }

        sortingArray.sort((a, b) => {
          const aText = a.format_txt ?? a.keyword
          const bText = b.format_txt ?? b.keyword
          return aText.toUpperCase() < bText.toUpperCase() ? -1 : aText > bText ? 1 : 0
        })

        for (let idx = 0; idx < sortingArray.length; idx++) {
          const anObject = {
            name: sortingArray[idx],
          }
          this.autoCompleteArray.push(anObject)
        }

        this.setState({
          suggestions: this.autoCompleteArray,
          isLoadingAutocomplete: false,
        })
      })
      .catch((error) => {
        if (error?.data?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
        }
        this.setState({ isLoadingAutocomplete: false })
      })
  }

  onSuggestionsFetchRequested = ({ value }) => {
    // Determine what to fetch suggestions for
    let suggestionValue = value

    // If no value and user hasn't typed, use the slicerSuggestion prop if available
    if (!value && !this.userTypedValue && this.props.slicerSuggestion) {
      suggestionValue = this.props.slicerSuggestion
    } else if (!value) {
      // No value, no user typing, and no suggestion prop - just return
      return
    }

    // Track when user starts typing
    if (value && !this.userTypedValue) {
      this.userTypedValue = value
    }

    this.setState({ isLoadingAutocomplete: true })

    // Only debounce if a request has already been made
    if (this.axiosSource) {
      clearTimeout(this.autocompleteTimer)
      this.autocompleteTimer = setTimeout(() => {
        this.fetchSuggestions({ value: suggestionValue })
      }, this.autocompleteDelay)
    } else {
      this.fetchSuggestions({ value: suggestionValue })
    }
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  createNewFilterFromSuggestion = (suggestion) => {
    const newFilter = {
      value: suggestion.keyword,
      format_txt: suggestion.format_txt,
      show_message: suggestion.show_message,
      key: suggestion.canonical,
      filter_type: 'include',
      canonical_key: suggestion.column_name,
      isSession: true,
    }

    return newFilter
  }

  getSuggestionValue = (sugg) => {
    // If it's a recent selection (already a filter object), return it directly
    if (sugg.format_txt || sugg.value) {
      return sugg
    }

    // Otherwise, it's an autocomplete suggestion with a 'name' property
    const name = sugg.name
    const selectedFilter = this.createNewFilterFromSuggestion(name)
    return selectedFilter
  }

  onInputChange = (e, { newValue, method }) => {
    if (method === 'up' || method === 'down') {
      return
    }

    if (method === 'enter' || method === 'click') {
      // newValue is the filter object returned from getSuggestionValue
      const sessionFilterLock = newValue


      // Add to recent selections
      this.addToRecentSelections(sessionFilterLock)

      this.setState({
        inputValue: sessionFilterLock.format_txt || '',
      })
      this.userTypedValue = null // Reset typing state
      this.props.onChange(sessionFilterLock)
    }

    if (typeof e?.target?.value === 'string') {
      this.setState({ inputValue: e.target.value })
      // Track when user starts typing
      if (e.target.value && !this.userTypedValue) {
        this.userTypedValue = e.target.value
      } else if (!e.target.value) {
        this.userTypedValue = null // Reset when cleared
      }
    }
  }

  onInputFocus = () => {
    // Reset typing state when input is focused (if empty)
    if (!this.state.inputValue) {
      this.userTypedValue = null
      
      // If we have a slicerSuggestion prop and no value, fetch suggestions for it
      if (this.props.slicerSuggestion) {
        this.onSuggestionsFetchRequested({ value: '' })
      }
    }
  }

  renderSuggestion = (suggestion) => {
    // Handle recent selections (they're already filter objects)
    if (suggestion.format_txt || suggestion.value) {
      const displayName = suggestion.format_txt || suggestion.value
      const showMessage = suggestion.show_message

      return (
        <ul className='filter-lock-suggestion-item' data-tooltip-delay-show={800}>
          <span>
            <strong>{displayName}</strong> {showMessage && <em>({showMessage})</em>}
          </span>
        </ul>
      )
    }

    // Handle autocomplete suggestions (they have a 'name' property)
    const name = suggestion.name
    const displayName = name?.format_txt ?? name?.keyword

    if (!displayName) {
      return null
    }

    return (
      <ul className='filter-lock-suggestion-item' data-tooltip-delay-show={800}>
        <span>
          {displayName} <em>({name.show_message})</em>
        </span>
      </ul>
    )
  }

  renderSuggestionsContainer = ({ containerProps, children, query }) => {
    const maxHeight = 150

    return (
      <div {...containerProps}>
        <div className='react-autoql-filter-suggestion-container'>
          <CustomScrollbars autoHeight autoHeightMin={0} maxHeight={maxHeight}>
            {children}
          </CustomScrollbars>
        </div>
      </div>
    )
  }

  getSuggestions = () => {
    const sections = []
    const doneLoading = !this.state.isLoadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading && this.state.inputValue
    const inputIsEmpty = !this.userTypedValue && !this.state.inputValue

    // When input is empty, show Recent and Suggested sections
    if (inputIsEmpty) {
      // Show recent selections
      if (this.state.recentSelections?.length > 0) {
        sections.push({
          title: 'Recent',
          suggestions: this.state.recentSelections,
        })
      }

      // Show suggested items from slicerSuggestion prop
      if (hasSuggestions) {
        sections.push({
          title: 'Suggested',
          suggestions: this.state.suggestions,
        })
      }
    } else {
      // When user is typing, show "Related to..." section
      if (hasSuggestions) {
        sections.push({
          title: `Related to "${this.state.inputValue}"`,
          suggestions: this.state.suggestions,
        })
      } else if (noSuggestions) {
        sections.push({
          title: `Related to "${this.state.inputValue}"`,
          suggestions: [{ name: '' }],
          emptyState: true,
        })
      }
    }

    return sections
  }

  renderSectionTitle = (section) => {
    return (
      <React.Fragment>
        <strong>{section.title}</strong>
        {section.emptyState ? (
          <div className='filter-locking-no-suggestions-text'>
            <em>No results</em>
          </div>
        ) : null}
      </React.Fragment>
    )
  }

  shouldRenderSuggestions = (value) => {
    // Always render suggestions if we have them, even when input is empty
    // This allows us to show slicerSuggestion results on focus
    return true
  }

  render = () => {
    const inputValue = this.props.value?.format_txt || this.state.inputValue

    return (
      <span className='react-autoql-vl-autocomplete-input-wrapper'>
        <Autosuggest
          id='react-autoql-dashboard-slicer-input'
          className='react-autoql-vl-autocomplete-input'
          highlightFirstSuggestion
          suggestions={this.getSuggestions()}
          renderSuggestion={this.renderSuggestion}
          getSuggestionValue={this.getSuggestionValue}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          renderSuggestionsContainer={this.renderSuggestionsContainer}
          getSectionSuggestions={(section) => section.suggestions}
          renderSectionTitle={this.renderSectionTitle}
          shouldRenderSuggestions={this.shouldRenderSuggestions}
          multiSection={true}
          inputProps={{
            onChange: this.onInputChange,
            onFocus: this.onInputFocus,
            value: inputValue,
            placeholder: this.props.placeholder,
            className: 'react-autoql-vl-autocomplete-input',
            ['data-test']: 'react-autoql-dashboard-slicer-input',
          }}
        />
      </span>
    )
  }
}
