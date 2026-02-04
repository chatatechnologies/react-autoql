import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'

import {
  fetchVLAutocomplete,
  REQUEST_CANCELLED_ERROR,
  authenticationDefault,
  getAuthentication,
  deepEqual,
} from 'autoql-fe-utils'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { authenticationType } from '../../props/types'

export default class VLAutocompleteInput extends React.Component {
  constructor(props) {
    super(props)

    this.contentKey = uuid()
    this.autoCompleteArray = []
    this.autocompleteDelay = 100
    this.TOOLTIP_ID = 'filter-locking-tooltip'
    this.MAX_SUGGESTIONS = 10

    this.state = {
      suggestions: undefined,
      inputValue: '',
      isLoadingAutocomplete: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    popoverPosition: PropTypes.string,
    column: PropTypes.string,
    context: PropTypes.string,
    onChange: PropTypes.func,
    inputProps: PropTypes.shape({}),
  }

  static defaultProps = {
    authentication: authenticationDefault,
    popoverPosition: 'bottom',
    column: undefined,
    context: undefined,
    onChange: () => {},
    inputProps: {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.focusInputTimeout)
    clearTimeout(this.highlightFilterEndTimeout)
    clearTimeout(this.highlightFilterStartTimeout)
    clearTimeout(this.savingIndicatorTimeout)
    clearTimeout(this.autocompleteTimer)
  }

  showSavingIndicator = () => {
    if (this.savingIndicatorTimeout) {
      clearTimeout(this.savingIndicatorTimeout)
    }
    this.setState({ isSaving: true })
    this.savingIndicatorTimeout = setTimeout(() => {
      this.setState({ isSaving: false })
    }, 1500)
  }

  handleHighlightFilterRow(filterKey) {
    this.props.onToast?.('This filter has already been applied.')
    const startAt = 0
    const duration = 1300

    this.highlightFilterStartTimeout = setTimeout(() => {
      this.setState({ highlightedFilter: filterKey })
    }, startAt)

    this.highlightFilterEndTimeout = setTimeout(() => {
      this.setState({ highlightedFilter: undefined })
    }, duration)
  }

  animateInputTextAndSubmit = (text) => {
    if (typeof text === 'string' && text?.length) {
      const totalTime = 500
      const timePerChar = totalTime / text.length
      for (let i = 0; i < text.length; i++) {
        setTimeout(() => {
          if (this._isMounted) {
            this.setState({ inputValue: text.slice(0, i + 1) })
            if (i === text.length - 1) {
              this.focusInputTimeout = setTimeout(() => {
                this.inputElement = document.querySelector('#react-autoql-filter-menu-input')
                this.inputElement?.focus()
              }, 300)
            }
          }
        }, i * timePerChar)
      }
    }
  }

  insertFilter = (filterText) => {
    const existingFilter = this.findFilter({ filterText })
    if (filterText && existingFilter) {
      this.handleHighlightFilterRow(this.getKey(existingFilter))
    } else {
      this.animateInputTextAndSubmit(filterText)
    }
  }

  findFilter = ({ filterText, value, key }) => {
    const allFilters = this.props.filters

    if (!allFilters?.length) {
      return
    }

    if (value && key) {
      return allFilters.find((filter) => filter.key === key && filter.value === value)
    } else if (filterText) {
      return allFilters.find((filter) => filter.value === filterText)
    }

    return undefined
  }

  fetchAllSuggestions = () => {
    if (!this.allSuggestions) {
      this.fetchSuggestions({ value: '' })
    }
  }

  fetchSuggestions = ({ value }) => {
    // If already fetching autocomplete, cancel it
    if (this.axiosSource) {
      this.axiosSource.abort(REQUEST_CANCELLED_ERROR)
    }

    this.setState({ isLoadingAutocomplete: true })

    this.axiosSource = new AbortController()

    return fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
      context: this.props.context,
      filter: this.props.column,
      signal: this.axiosSource.signal,
    })
      .then((response) => {
        const body = response?.data?.data
        const sortingArray = []
        let suggestionsMatchArray = []
        this.autoCompleteArray = []
        suggestionsMatchArray = [...body.matches]

        let numMatches = suggestionsMatchArray.length
        if (numMatches > this.MAX_SUGGESTIONS) {
          numMatches = this.MAX_SUGGESTIONS
        }

        for (let i = 0; i < numMatches; i++) {
          sortingArray.push(suggestionsMatchArray[i])
        }

        sortingArray.sort((a, b) => {
          const aText = a.format_txt
          const bText = b.format_txt
          return aText.toUpperCase() < bText.toUpperCase() ? -1 : aText > bText ? 1 : 0
        })
        for (let idx = 0; idx < sortingArray.length; idx++) {
          const anObject = {
            name: sortingArray[idx],
          }
          this.autoCompleteArray.push(anObject)
        }

        if (!value) {
          this.allSuggestions = this.autoCompleteArray
        }

        this.setState({
          suggestions: this.autoCompleteArray,
          isLoadingAutocomplete: false,
        })

        return this.autoCompleteArray
      })
      .catch((error) => {
        const isCancelled = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.message === REQUEST_CANCELLED_ERROR
        if (!isCancelled && error?.data?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
        }

        this.setState({ isLoadingAutocomplete: false })
      })
  }

  onSuggestionsFetchRequested = ({ value }) => {
    // Only debounce if a request has already been made
    if (this.axiosSource) {
      clearTimeout(this.autocompleteTimer)
      this.autocompleteStart = Date.now()
      this.autocompleteTimer = setTimeout(() => {
        this.fetchSuggestions({ value })
      }, this.autocompleteDelay)
    } else {
      this.fetchSuggestions({ value })
    }
  }

  onSuggestionsClearRequested = () => {}

  createNewFilterFromSuggestion = (suggestion) => {
    let filterType = 'include'
    const filterSameCategory = this.props.filters?.find?.((filter) => filter.show_message === suggestion.show_message)
    if (filterSameCategory) {
      filterType = filterSameCategory.filter_type
    }

    const newFilter = {
      value: suggestion.keyword,
      format_txt: suggestion.format_txt,
      show_message: suggestion.show_message,
      key: suggestion.canonical,
      filter_type: filterType,
    }

    return newFilter
  }

  getSuggestionValue = (sugg) => {
    const name = sugg.name
    const selectedFilter = this.createNewFilterFromSuggestion(name)
    return selectedFilter
  }

  selectAll = () => {
    this.inputElement?.select?.()
  }

  onInputFocus = () => {
    this.selectAll()
    this.fetchAllSuggestions()
  }

  onInputChange = (e, { newValue, method }) => {
    if (method === 'up' || method === 'down') {
      return
    }

    if (method === 'enter' || method === 'click') {
      this.props.onChange(newValue)
      if (this.findFilter(newValue)) {
        this.handleHighlightFilterRow(this.getKey(newValue))
      } else {
        this.props.setFilter?.(newValue)
      }
    }

    if (typeof e?.target?.value === 'string') {
      const newState = { inputValue: e.target.value }
      if (!e?.target?.value && this.allSuggestions?.length) {
        newState.suggestions = this.allSuggestions
      }

      this.setState(newState)
    }
  }

  getKey = (filter) => {
    const key = filter.key || filter.canonical
    const value = filter.value || filter.keyword
    return `${key}-${value}`
  }

  renderSuggestion = ({ name }) => {
    const displayName = name.format_txt ?? name.keyword

    if (!displayName) {
      return null
    }

    let displayNameType = ''
    if (name.show_message) {
      displayNameType = `(${name.show_message})`
    }

    return (
      <span
        className='filter-lock-suggestion-item'
        data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
        data-tooltip-delay-show={1000}
        data-tooltip-html={`<strong>${displayName}</strong> <em>${displayNameType}</em>`}
      >
        <strong>{displayName}</strong> <em>{displayNameType}</em>
      </span>
    )
  }

  renderSuggestionsContainer = ({ containerProps, children, query }) => {
    let maxHeight = 150
    const padding = 20
    const listContainerHeight = this.filterListContainerRef?.clientHeight

    if (!isNaN(listContainerHeight)) {
      maxHeight = listContainerHeight - padding
    }

    return (
      <div {...containerProps}>
        <div className='react-autoql-filter-suggestion-container'>
          {/* <CustomScrollbars autoHeight autoHeightMin={0} maxHeight={maxHeight}> */}
          {children}
          {/* </CustomScrollbars> */}
        </div>
      </div>
    )
  }

  getSuggestions = () => {
    const showAllSuggestions = !this.state.inputValue && this.allSuggestions?.length
    const noSuggestions = this.state.suggestions && !this.state.suggestions?.length && !this.state.isLoadingAutocomplete
    const title = this.state.inputValue ? `Results for "${this.state.inputValue}"` : undefined

    // Suggestions have not been fetched yet
    if (!this.state.suggestions) {
      return []
    }

    // If text is deleted, but full list has previously been fetched, show full list
    if (showAllSuggestions) {
      return [
        {
          title: undefined,
          suggestions: this.allSuggestions,
        },
      ]
    }

    // Suggestions have been fetched, but there were no results
    if (noSuggestions) {
      return [
        {
          title,
          suggestions: [{ name: '' }],
          emptyState: true,
        },
      ]
    }

    // Default to current suggestion state
    return [
      {
        title,
        suggestions: this.state.suggestions,
      },
    ]
  }

  renderSectionTitle = (section) => {
    return (
      <>
        <strong>{section.title}</strong>
        {section.emptyState ? (
          <div className='filter-locking-no-suggestions-text'>
            <em>No results</em>
          </div>
        ) : null}
      </>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <span className='react-autoql-vl-autocomplete-input-wrapper'>
          <Autosuggest
            id='react-autoql-filter-menu-input'
            highlightFirstSuggestion
            suggestions={this.getSuggestions()}
            renderSuggestion={this.renderSuggestion}
            getSuggestionValue={this.getSuggestionValue}
            onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
            onSuggestionsClearRequested={this.onSuggestionsClearRequested}
            renderSuggestionsContainer={this.renderSuggestionsContainer}
            getSectionSuggestions={(section) => section.suggestions}
            renderSectionTitle={this.renderSectionTitle}
            alwaysRenderSuggestions={true}
            multiSection={true}
            inputProps={{
              ref: (r) => (this.inputElement = r),
              onChange: this.onInputChange,
              value: this.state.inputValue,
              disabled: this.props.isFetchingFilters || this.state.isFetchingFilters,
              placeholder: this.props.placeholder ?? 'Search & select a filter',
              ['data-test']: 'react-autoql-filter-locking-input',
              className: 'react-autoql-vl-autocomplete-input',
              id: 'react-autoql-filter-menu-input',
              onFocus: this.onInputFocus,
              ...this.props.inputProps,
            }}
          />
        </span>
      </ErrorBoundary>
    )
  }
}
