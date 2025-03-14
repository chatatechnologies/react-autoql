import React from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { Slide } from 'react-toastify'
import _cloneDeep from 'lodash.clonedeep'
import Autosuggest from 'react-autosuggest'
import { isMobile } from 'react-device-detect'
import { ToastContainer, toast } from 'react-toastify'

import {
  fetchVLAutocomplete,
  setFilters,
  REQUEST_CANCELLED_ERROR,
  authenticationDefault,
  getAuthentication,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Chip } from '../../Chip'
import { Tooltip } from '../../Tooltip'
import { LoadingDots } from '../../LoadingDots'
import { CustomScrollbars } from '../../CustomScrollbars'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { authenticationType } from '../../../props/types'

import 'react-toastify/dist/ReactToastify.css'
import './CustomList.scss'
export default class CustomList extends React.Component {
  constructor(props) {
    super(props)

    this.contentKey = uuid()
    this.autoCompleteArray = []
    this.autocompleteDelay = 100
    this.TOOLTIP_ID = 'filter-locking-tooltip'

    this.state = {
      filters: this.props.initialFilters || [],
      suggestions: [],
      inputValue: '',
    }
  }

  static propTypes = {
    authentication: authenticationType,
    baseDataAlertColumns: PropTypes.array,
    onCustomFiltersChange: PropTypes.func,
    customFilters: PropTypes.array,
    storedInitialData: PropTypes.array,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    baseDataAlertColumns: [],
    onCustomFiltersChange: () => {},
    customFilters: [],
    storedInitialData: [],
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Set initial filters from FilterLockPopover fetch on mount
    if (this.props.initialFilters && !prevProps.initialFilters) {
      this.setState({ filters: this.props.initialFilters })
      this.props.onCustomFiltersChange([...this.props.customFilters, ...this.props.initialFilters])
    }
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
    toast.info('This filter has already been applied.')
    const startAt = 0
    const duration = 1300

    this.highlightFilterStartTimeout = setTimeout(() => {
      this.setState({ highlightedFilter: filterKey })
    }, startAt)

    this.highlightFilterEndTimeout = setTimeout(() => {
      this.setState({ highlightedFilter: undefined })
    }, duration)
  }

  findFilter = ({ filterText, value, key, column_name }) => {
    const allFilters = this.state.filters
    if (value && key) {
      return allFilters.find((filter) => filter.column_name === column_name && filter.value === value)
    } else if (filterText) {
      return allFilters.find((filter) => filter.value === filterText)
    }

    return undefined
  }

  getTimeLeft = (timeout) => {
    if (!timeout) {
      return 0
    }

    return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000)
  }

  fetchSuggestions = ({ value }) => {
    // If already fetching autocomplete, cancel it
    if (this.axiosSource) {
      this.axiosSource.cancel(REQUEST_CANCELLED_ERROR)
    }

    this.axiosSource = axios.CancelToken?.source()

    fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        const body = response?.data?.data
        const sortingArray = []
        let suggestionsMatchArray = []
        this.autoCompleteArray = []
        suggestionsMatchArray = body.matches.filter((suggestion) =>
          this.props.baseDataAlertColumns.some(
            () =>
              this.state.filters.length === 0 ||
              this.state.filters.some((filter) => filter.column_name === suggestion.column_name),
          ),
        )

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
    this.setState({ isLoadingAutocomplete: true })

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

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  createNewFilterFromSuggestion = (suggestion) => {
    let filterType = 'include'
    const filterSameCategory = this.state.filters.find((filter) => filter.show_message === suggestion.show_message)
    if (filterSameCategory) {
      filterType = filterSameCategory.filter_type
    }
    const newFilter = {
      value: suggestion.keyword,
      format_txt: suggestion.format_txt,
      show_message: suggestion.show_message,
      key: suggestion.canonical,
      filter_type: filterType,
      column_name: suggestion.column_name,
    }

    return newFilter
  }

  setFilterTypes = (filters, oldFilters) => {
    const auth = getAuthentication(this.props.authentication)
    const persistedFilters = filters.filter((filter) => !filter.isSession)

    if (!persistedFilters?.length) {
      return Promise.resolve()
    }

    this.showSavingIndicator()
    return setFilters({ ...auth, filters: persistedFilters })
      .then((response) => {
        const updatedFilters = response?.data?.data?.data
        const newFilters = this.state.filters.map((filter) => {
          const foundFilter = updatedFilters.find((newFilter) => this.getKey(filter) === this.getKey(newFilter))
          if (foundFilter) {
            return foundFilter
          }
          return filter
        })
        this.setState({ filters: newFilters })
        return Promise.resolve(response)
      })
      .catch((error) => {
        console.error(error)
        this.setState({ filters: oldFilters, isSaving: false })
        toast.error('Something went wrong. Please try again.')
        return Promise.reject()
      })
  }

  setFilter = (newFilter) => {
    if (!newFilter?.value) {
      return
    }

    const auth = this.props.authentication ?? {}

    this.showSavingIndicator()
    this.setState({
      filters: [...this.state.filters, newFilter],
      inputValue: '',
    })
    this.props.onCustomFiltersChange([...this.props.customFilters, newFilter])
  }

  getSuggestionValue = (sugg) => {
    const name = sugg.name
    const selectedFilter = this.createNewFilterFromSuggestion(name)
    return selectedFilter
  }

  removeFilter = async (clickedFilter) => {
    const newFilters = this.state.filters.filter((filter) => this.getKey(filter) !== this.getKey(clickedFilter))
    this.setState({ filters: newFilters })
    const newCustomFilters = this.props.customFilters.filter(
      (filter) => this.getKey(filter) !== this.getKey(clickedFilter),
    )
    this.props.onCustomFiltersChange(newCustomFilters)
  }

  onInputChange = (e, { newValue, method }) => {
    if (method === 'up' || method === 'down') {
      return
    }

    if (method === 'enter' || method === 'click') {
      if (this.findFilter(newValue)) {
        this.handleHighlightFilterRow(this.getKey(newValue))
      } else {
        this.setFilter(newValue)
      }
    }

    if (typeof e?.target?.value === 'string') {
      this.setState({ inputValue: e.target.value })
    }
  }

  getKey = (filter) => {
    const key = filter.key || filter.canonical
    const value = filter.value || filter.keyword
    return `${key}-${value}`
  }

  renderSavingIndicator = () => {
    return (
      <div
        className={`filter-locking-saving-indicator ${this.state.isSaving ? 'visible' : 'hidden'}`}
        data-test='filter-locking-saving-indicator'
      >
        Saving...
      </div>
    )
  }

  renderTitle = () => {
    return (
      <div className='react-autoql-custom-list-title'>
        <h3>
          <span>{'Select Custom Filters'}</span>
          <span
            data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
            data-tooltip-content='You can only add one type of filter.'
          >
            <Icon type='info' data-place='bottom' />
          </span>
        </h3>
      </div>
    )
  }

  renderHeader = () => {
    return <div className='filter-lock-menu-header'>{this.renderTitle()}</div>
  }

  renderSuggestion = ({ name }) => {
    const displayName = name.format_txt ?? name.keyword

    if (!displayName) {
      return null
    }

    return (
      <ul
        className='filter-lock-suggestion-item'
        data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
        data-tooltip-delay-show={800}
        data-tooltip-html={`${displayName} <em>(${name.show_message})</em>`}
      >
        <span>
          {displayName} <em>({name.show_message})</em>
        </span>
      </ul>
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
          <CustomScrollbars maxHeight={200}>{children}</CustomScrollbars>
        </div>
      </div>
    )
  }

  getSuggestions = () => {
    const sections = []
    const doneLoading = !this.state.isLoadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading

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

    return sections
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

  renderVLInput = () => {
    return (
      <span className='react-autoql-vl-autocomplete-input-wrapper'>
        <Autosuggest
          id='react-autoql-filter-menu-input'
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
          multiSection={true}
          inputProps={{
            onChange: this.onInputChange,
            value: this.state.inputValue,
            disabled: this.props.isFetchingFilters || this.state.isFetchingFilters,
            placeholder: 'Search & select a filter',
            ['data-test']: 'react-autoql-vl-autocomplete-input',
            className: 'react-autoql-vl-autocomplete-input',
            id: 'react-autoql-filter-menu-input',
          }}
        />
      </span>
    )
  }

  renderFilterListCategory = (category, i) => {
    return (
      <div key={category} className='react-autoql-filter-list-item-container'>
        {this.renderFilterListCategoryHeader(category, i)}
        <div className='react-autoql-filter-list'>
          {this.state.filters
            .filter((filter) => filter.show_message === category)
            .map((filter) => this.renderFilterListItem(filter))}
        </div>
      </div>
    )
  }

  renderFilterListCategoryHeader = (category, i) => {
    return (
      <div className='react-autoql-filter-list-title'>
        <div className='filter-name-column'>
          <h4
            className='filter-lock-category-title'
            data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
            data-tooltip-delay-show={800}
            data-tooltip-html={category}
          >
            {category}
          </h4>
        </div>
      </div>
    )
  }

  renderFilterListItem = (filter) => {
    const key = this.getKey(filter)
    return (
      <Chip
        key={key}
        className={`react-autoql-filter-list-item ${
          this.state.highlightedFilter === key ? 'react-autoql-highlight-row' : ''
        } ${isMobile ? 'mobile' : ''}`}
        data-test='react-autoql-filter-list-item'
        onDelete={() => this.removeFilter(filter)}
        tooltip='Remove filter'
        tooltipID={this.props.tooltipID}
      >
        {filter.format_txt ?? filter.value}
      </Chip>
    )
  }

  renderFilterList = () => {
    if (this.props.isFetchingFilters || this.state.isFetchingFilters) {
      return (
        <div className='react-autoql-filter-lock-list-loading-container'>
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.filters?.length) {
      return (
        <div className='react-autoql-empty-filter-list'>
          <i>{'No Filters are selected yet'}</i>
        </div>
      )
    }

    const uniqueCategories = [...new Set(this.state.filters.map((filter) => filter.show_message))]

    return (
      <div ref={(r) => (this.filterListContainerRef = r)} className='react-autoql-filter-list-container'>
        <CustomScrollbars maxHeight={100}>
          {uniqueCategories.map((category, i) => {
            return this.renderFilterListCategory(category, i)
          })}
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <ToastContainer
          className='filter-lock-toast-container'
          position='top-center'
          autoClose={800}
          transition={Slide}
          hideProgressBar
          pauseOnFocusLoss={false}
          draggable={false}
          pauseOnHover={false}
          closeButton={false}
          limit={1}
        />
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} place='top' />}
        <div className='custom-list-menu-content' onClick={(e) => e.stopPropagation()}>
          {this.renderHeader()}
          {this.renderVLInput()}
          {this.renderFilterList()}
        </div>
      </ErrorBoundary>
    )
  }
}
