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
  unsetFilterFromAPI,
  REQUEST_CANCELLED_ERROR,
  authenticationDefault,
  getAuthentication,
} from 'autoql-fe-utils'
import { isAbortError, createCancelPair } from '../../utils/abortUtils'

import { Icon } from '../Icon'
import { Radio } from '../Radio'
import { Button } from '../Button'
import { Tooltip } from '../Tooltip'
import { Checkbox } from '../Checkbox'
import { LoadingDots } from '../LoadingDots'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { lang } from '../../js/Localization'
import { authenticationType } from '../../props/types'

import 'react-toastify/dist/ReactToastify.css'

export default class FilterLockPopover extends React.Component {
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

    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
    insertedFilter: PropTypes.string,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    insertedFilter: null,
    isOpen: false,
    onClose: () => {},
    onChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true

    if (this.state.filters) {
      this.props.onChange(this.state.filters)
    }

    if (this.props.isOpen && this.props.insertedFilter) {
      this.insertFilter(this.props.insertedFilter)
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    // Set initial filters from FilterLockPopover fetch on mount
    if (this.props.initialFilters && !prevProps.initialFilters) {
      this.setState({ filters: this.props.initialFilters })
    }

    if (!_isEqual(this.state.filters, prevState.filters)) {
      this.props.onChange(this.state.filters)
    }

    if (!this.props.isOpen && prevProps.isOpen) {
      this.setState({ inputValue: '' })
    }

    if (
      (this.props.isOpen && !prevProps.isOpen && this.props.insertedFilter) ||
      (this.props.insertedFilter && !prevProps.insertedFilter)
    ) {
      this.insertFilter(this.props.insertedFilter)
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

  getAllFilters = () => {
    return this.state.filters
  }

  getPersistedFilters = () => {
    return _cloneDeep(this.state.filters.filter((filter) => !filter.isSession))
  }

  findFilter = ({ filterText, value, key }) => {
    const allFilters = this.state.filters

    if (value && key) {
      return allFilters.find((filter) => filter.key === key && filter.value === value)
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
      this.axiosSource.controller?.abort(REQUEST_CANCELLED_ERROR)
    }

    this.axiosSource = createCancelPair()

    fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
      signal: this.axiosSource.controller.signal,
      cancelToken: this.axiosSource.cancelToken,
    })
      .then((response) => {
        const body = response?.data?.data
        const sortingArray = []
        let suggestionsMatchArray = []
        this.autoCompleteArray = []
        suggestionsMatchArray = body.matches
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
        if (!isAbortError(error)) {
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
      canonical_key: suggestion.column_name,
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
    return setFilters({ ...auth, filters: [newFilter] })
      .then((response) => {
        const filterList = response?.data?.data?.data
        if (!filterList?.length) {
          throw new Error('No filters in the api response')
        }

        const updatedFilter = filterList.find((filter) => this.getKey(filter) === this.getKey(newFilter))

        if (!updatedFilter) {
          throw new Error('Filter not found in the api response')
        }

        if (this.findFilter(newFilter)) {
          const updatedFilters = this.state.filters.map((filter) => {
            if (this.getKey(filter) === this.getKey(updatedFilter)) {
              return updatedFilter
            }
            return filter
          })
          this.setState({ filters: updatedFilters })
        } else {
          this.setState({
            filters: [...this.state.filters, updatedFilter],
            inputValue: '',
          })
        }
        return Promise.resolve()
      })
      .catch((error) => {
        console.error(error)
        toast.error('Something went wrong. Please try again.')
        return Promise.reject()
      })
  }

  unsetFilter = (filter) => {
    try {
      this.showSavingIndicator()
      const auth = getAuthentication(this.props.authentication)
      return unsetFilterFromAPI({ ...auth, filter })
    } catch (error) {
      console.error(error)
      toast.error('Something went wrong. Please try again.')
      return Promise.reject(error)
    }
  }

  getSuggestionValue = (sugg) => {
    const name = sugg.name
    const selectedFilter = this.createNewFilterFromSuggestion(name)
    return selectedFilter
  }

  handlePersistToggle = async (clickedFilter) => {
    const oldFilters = this.state.filters
    const toggledFilter = {
      ...clickedFilter,
      isSession: !clickedFilter.isSession,
      id: undefined,
    }
    const newFilters = this.state.filters.map((filter) => {
      if (this.getKey(filter) === this.getKey(clickedFilter)) {
        return toggledFilter
      }

      return filter
    })

    this.setState({ filters: newFilters })

    try {
      if (clickedFilter.isSession) {
        await this.setFilter(toggledFilter)
      } else {
        await this.unsetFilter(clickedFilter)
      }
    } catch (error) {
      console.error(error)
      this.setState({ filters: oldFilters })
    }
  }

  handleExcludeToggle = (category, value) => {
    if (value === undefined || value === null) {
      return
    }

    const currentCategoryType = this.state.filters
      ?.find((filter) => filter.show_message === category)
      ?.filter_type?.toUpperCase()

    if (value === currentCategoryType) {
      return
    }

    try {
      const newFilters = this.state.filters.map((filter) => {
        if (filter.show_message === category) {
          return {
            ...filter,
            filter_type: value.toLowerCase(),
          }
        }
        return filter
      })

      const categoryFilters = newFilters.filter((filter) => {
        return filter.show_message === category
      })

      this.setFilterTypes(categoryFilters, _cloneDeep(this.state.filters))
      this.setState({
        filters: newFilters,
      })
    } catch (error) {
      console.error(error)
    }
  }

  removeFilter = async (clickedFilter) => {
    const oldFilters = this.state.filters
    const newFilters = this.state.filters.filter((filter) => this.getKey(filter) !== this.getKey(clickedFilter))

    this.setState({ filters: newFilters })

    try {
      if (!clickedFilter.isSession) {
        await this.unsetFilter(clickedFilter)
      }
    } catch (error) {
      console.error(error)
      this.setState({ filters: oldFilters })
    }
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
      <div className='react-autoql-filter-locking-title'>
        <h3>
          <span>{lang.filterLockingTitle}</span>
          <Icon
            type='info'
            data-place='bottom'
            data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
            data-tooltip-content='Filters can be applied to narrow down your query results. Locking a filter ensures that only the specific data you wish to see is returned.'
          />
        </h3>
      </div>
    )
  }

  renderHeader = () => {
    return (
      <div className='filter-lock-menu-header'>
        {this.renderTitle()}
        {this.renderCloseBtn()}
      </div>
    )
  }

  renderCloseBtn = () => {
    return (
      <div className='filter-locking-close-and-saving-container'>
        {this.renderSavingIndicator()}
        <Button onClick={this.props.onClose} className='filter-locking-close-btn' border={false} size='small'>
          <Icon type='close' />
        </Button>
      </div>
    )
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
          <CustomScrollbars autoHeight autoHeightMin={0} maxHeight={maxHeight} suppressScrollX>
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
    const categoryFilter = this.state.filters.find((filter) => filter.show_message === category)

    const toggleButtonValue = categoryFilter.filter_type?.trim().toUpperCase()

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
          <Radio
            className='include-exclude-toggle-group'
            options={['INCLUDE', 'EXCLUDE']}
            data-test='include-exclude-toggle-group'
            tooltips={[
              'Only show results <strong>with</strong> these values',
              'Show results <strong>without</strong> these values',
            ]}
            tooltipId={this.props.tooltipID ?? this.TOOLTIP_ID}
            value={toggleButtonValue}
            type='button'
            onChange={(value) => this.handleExcludeToggle(category, value)}
          />
        </div>
        {i === 0 ? (
          <div className='persist-toggle-column'>
            <h4>Persist</h4>
            <Icon
              type='info'
              data-place='left'
              data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
              data-tooltip-html='
                Persistent filters remain locked at all<br />
                times, unless the filter is removed. If<br />
                unchecked, the filter will be locked<br />
                until you end your browser session.'
            />
          </div>
        ) : null}
      </div>
    )
  }

  renderFilterListItem = (filter) => {
    const key = this.getKey(filter)
    const filterName = filter.format_txt ?? filter.value

    return (
      <div
        key={key}
        data-test='react-autoql-filter-list-item'
        className={`react-autoql-filter-list-item ${
          this.state.highlightedFilter === key ? 'react-autoql-highlight-row' : ''
        } ${isMobile ? 'mobile' : ''}`}
      >
        <div
          className='react-autoql-filter-list-item-filter'
          data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
          data-tooltip-content={filterName}
        >
          {filterName}
        </div>
        <div className='react-autoql-filter-list-item-actions'>
          <Checkbox
            className='persist-toggle'
            data-test='react-autoql-filter-lock-persist-toggle'
            type='switch'
            checked={!filter.isSession}
            onChange={() => this.handlePersistToggle(filter)}
          />
          <Icon
            className='react-autoql-remove-filter-icon'
            tooltip='Remove filter'
            tooltipID={this.props.tooltipID}
            data-test='react-autoql-remove-filter-icon'
            type='trash'
            onClick={() => this.removeFilter(filter)}
          />
        </div>
      </div>
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
          <i>{lang.noFiltersLocked}</i>
        </div>
      )
    }

    const uniqueCategories = [...new Set(this.state.filters.map((filter) => filter.show_message))]

    return (
      <div ref={(r) => (this.filterListContainerRef = r)} className='react-autoql-filter-list-container'>
        <CustomScrollbars suppressScrollX>
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
          // theme={getTheme()}
        />
        {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} place='top' />}
        <div className='filter-lock-menu-content' onClick={(e) => e.stopPropagation()}>
          {this.renderHeader()}
          {this.renderVLInput()}
          {this.renderFilterList()}
        </div>
      </ErrorBoundary>
    )
  }
}
