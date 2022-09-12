import React from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import { ToastContainer, toast } from 'react-toastify'
import { Slide } from 'react-toastify'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import { Radio } from '../Radio'
import { Icon } from '../Icon'
import { Button } from '../Button'
import { LoadingDots } from '../LoadingDots'
import { Checkbox } from '../Checkbox'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  fetchVLAutocomplete,
  setFilters,
  unsetFilterFromAPI,
} from '../../js/queryService'

import { authenticationType, themeConfigType } from '../../props/types'
import {
  authenticationDefault,
  getAuthentication,
  getThemeConfig,
  themeConfigDefault,
} from '../../props/defaults'

import { lang } from '../../js/Localization'
import { handleTooltipBoundaryCollision } from '../../js/Util'

import 'react-toastify/dist/ReactToastify.css'

export default class FilterLockPopover extends React.Component {
  constructor(props) {
    super(props)

    this.contentKey = uuid()
    this.autoCompleteArray = []

    this.state = {
      filters: this.props.initialFilters || [],
      suggestions: [],
      inputValue: '',
    }
  }

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,

    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    onChange: PropTypes.func,
    insertedFilter: PropTypes.string,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,

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
      this.rebuildTooltips()
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
    clearTimeout(this.animateTextTimeout)
    clearTimeout(this.focusInputTimeout)
    clearTimeout(this.highlightFilterEndTimeout)
    clearTimeout(this.highlightFilterStartTimeout)
    clearTimeout(this.savingIndicatorTimeout)
  }

  rebuildTooltips = (delay = 500) => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips(delay)
    } else {
      clearTimeout(this.rebuildTooltipsTimer)
      this.rebuildTooltipsTimer = setTimeout(() => {
        ReactTooltip.rebuild()
      }, delay)
    }
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
      const totalTime = 2000
      const timePerChar = totalTime / text.length
      for (let i = 1; i <= text.length; i++) {
        setTimeout(() => {
          if (this._isMounted) {
            this.setState({ inputValue: text.slice(0, i) })
            if (i === text.length) {
              this.focusInputTimeout = setTimeout(() => {
                this.inputElement = document.querySelector(
                  '#react-autoql-filter-menu-input'
                )
                this.inputElement?.focus()
              }, 300)
            }
          }
        }, timePerChar)
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
      return allFilters.find(
        (filter) => filter.key === key && filter.value === value
      )
    } else if (filterText) {
      return allFilters.find((filter) => filter.value === filterText)
    }

    return undefined
  }

  onSuggestionsFetchRequested = ({ value }) => {
    clearTimeout(this.autoCompleteTimer)
    this.autoCompleteTimer = setTimeout(() => {
      fetchVLAutocomplete({
        ...getAuthentication(this.props.authentication),
        suggestion: value,
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
            return a.keyword?.toUpperCase() < b.keyword?.toUpperCase()
              ? -1
              : a.keyword > b.keyword
              ? 1
              : 0
          })
          for (let idx = 0; idx < sortingArray.length; idx++) {
            const anObject = {
              name: sortingArray[idx],
            }
            this.autoCompleteArray.push(anObject)
          }
          this.setState({ suggestions: this.autoCompleteArray })
        })
        .catch((error) => console.error(error))
    }, 300)
  }

  onSuggestionsClearRequested = () => {
    this.setState({
      suggestions: [],
    })
  }

  createNewFilterFromSuggestion = (suggestion) => {
    let filterType = 'include'
    const filterSameCategory = this.state.filters.find(
      (filter) => filter.show_message === suggestion.show_message
    )
    if (filterSameCategory) {
      filterType = filterSameCategory.filter_type
    }

    const newFilter = {
      value: suggestion.keyword,
      show_message: suggestion.show_message,
      key: suggestion.canonical,
      filter_type: filterType,
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
          const foundFilter = updatedFilters.find(
            (newFilter) => this.getKey(filter) === this.getKey(newFilter)
          )
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
        toast.error(`Something went wrong. Please try again.`)
        return Promise.reject()
      })
  }

  setFilter = (newFilter) => {
    const auth = getAuthentication(this.props.authentication)

    this.showSavingIndicator()
    return setFilters({ ...auth, filters: [newFilter] })
      .then((response) => {
        const filterList = response?.data?.data?.data
        if (!filterList?.length) {
          throw new Error('No filters in the api response')
        }

        const updatedFilter = filterList.find(
          (filter) => this.getKey(filter) === this.getKey(newFilter)
        )

        if (!updatedFilter)
          throw new Error('Filter not found in the api response')

        if (this.findFilter(newFilter)) {
          const updatedFilters = this.state.filters.map((filter) => {
            if (this.getKey(filter) === this.getKey(updatedFilter))
              return updatedFilter
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
    if (!value) {
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
    const newFilters = this.state.filters.filter(
      (filter) => this.getKey(filter) !== this.getKey(clickedFilter)
    )

    this.setState({ filters: newFilters })

    try {
      if (!clickedFilter.isSession) {
        await this.unsetFilter(clickedFilter)
      }
    } catch (error) {
      console.error(error)
      this.setState({ filters: oldFilters })
    }

    ReactTooltip.hide()
  }

  onInputChange = (e, { newValue, method }) => {
    if (method === 'up' || method === 'down') {
      return
    }

    if (method === 'enter' || method === 'click') {
      if (!!this.findFilter(newValue)) {
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
    if (this.state.isSaving) {
      return (
        <div
          className="filter-locking-saving-indicator"
          data-test="filter-locking-saving-indicator"
        >
          Saving...
        </div>
      )
    }

    return null
  }

  renderTitle = () => {
    return (
      <div className="react-autoql-filter-locking-title">
        <h3>
          {lang.filterLockingTitle}{' '}
          <Icon
            type="info"
            data-place="right"
            data-for="filter-locking-tooltip"
            data-tip="Filters can be applied to narrow down your query results. Locking a filter ensures that only the specific data you wish to see is returned."
          />
        </h3>
      </div>
    )
  }

  renderHeader = () => {
    return (
      <div className="filter-lock-menu-header">
        {this.renderTitle()}
        {this.renderCloseBtn()}
      </div>
    )
  }

  renderCloseBtn = () => {
    return (
      <div>
        {this.renderSavingIndicator()}
        <Button
          onClick={this.props.onClose}
          className="filter-locking-close-btn"
          data-tip={lang.closeFilterLocking}
          data-for="filter-locking-tooltip"
          size="small"
        >
          <Icon type="close" />
        </Button>
      </div>
    )
  }

  renderSuggestion = ({ name }) => {
    this.rebuildTooltips()

    return (
      <ul
        className="filter-lock-suggestion-item"
        data-for="filter-locking-tooltip"
        data-delay-show={800}
        data-tip={`${name.keyword} <em>(${name.show_message})</em>`}
      >
        <span>
          {name.keyword} <em>({name.show_message})</em>
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
        <div className="react-autoql-filter-suggestion-container">
          <CustomScrollbars
            autoHeight
            autoHeightMin={0}
            autoHeightMax={maxHeight}
          >
            {children}
          </CustomScrollbars>
        </div>
      </div>
    )
  }

  renderVLInput = () => {
    return (
      <Autosuggest
        id="react-autoql-filter-menu-input"
        highlightFirstSuggestion
        suggestions={this.state.suggestions}
        renderSuggestion={this.renderSuggestion}
        getSuggestionValue={this.getSuggestionValue}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        onSuggestionsClearRequested={this.onSuggestionsClearRequested}
        renderSuggestionsContainer={this.renderSuggestionsContainer}
        inputProps={{
          onChange: this.onInputChange,
          value: this.state.inputValue,
          disabled:
            this.props.isFetchingFilters || this.state.isFetchingFilters,
          placeholder: 'Search & select a filter',
          ['data-test']: 'react-autoql-filter-locking-input',
          className: 'react-autoql-filter-locking-input',
          id: 'react-autoql-filter-menu-input',
        }}
      />
    )
  }

  renderFilterListCategory = (category, i) => {
    return (
      <div key={category} className="react-autoql-filter-list-item-container">
        {this.renderFilterListCategoryHeader(category, i)}
        <div className="react-autoql-filter-list">
          {this.state.filters
            .filter((filter) => filter.show_message === category)
            .map((filter) => this.renderFilterListItem(filter))}
        </div>
      </div>
    )
  }

  renderFilterListCategoryHeader = (category, i) => {
    const categoryFilter = this.state.filters.find(
      (filter) => filter.show_message === category
    )

    const toggleButtonValue = categoryFilter.filter_type?.trim().toUpperCase()

    return (
      <div className="react-autoql-filter-list-title">
        <div className="filter-name-column">
          <h4
            className="filter-lock-category-title"
            data-for="filter-locking-tooltip"
            data-delay-show={800}
            data-tip={category}
          >
            {category}
          </h4>
          <Radio
            className="include-exclude-toggle-group"
            options={['INCLUDE', 'EXCLUDE']}
            data-test="include-exclude-toggle-group"
            tooltips={[
              'Only show results <strong>with</strong> these values',
              'Show results <strong>without</strong> these values',
            ]}
            tooltipId="filter-locking-tooltip"
            value={toggleButtonValue}
            type="button"
            onChange={(value) => this.handleExcludeToggle(category, value)}
          />
        </div>
        {i === 0 ? (
          <div className="persist-toggle-column">
            <h4>
              <span>Persist </span>
            </h4>

            <Icon
              type="info"
              data-place="left"
              data-for="filter-locking-tooltip"
              data-tip="
                Persistent filters remain locked at all<br />
                times, unless the filter is removed. If<br />
                unchecked, the filter will be locked<br />
                until you end your browser session."
            />
          </div>
        ) : null}
      </div>
    )
  }

  renderFilterListItem = (filter) => {
    const key = this.getKey(filter)

    return (
      <div
        key={key}
        data-test="react-autoql-filter-list-item"
        className={`react-autoql-filter-list-item ${
          this.state.highlightedFilter === key
            ? 'react-autoql-highlight-row'
            : ''
        }`}
      >
        <div className="react-autoql-filter-list-item-filter">
          {filter.value}
        </div>
        <div className="react-autoql-filter-list-item-actions">
          <Checkbox
            className="persist-toggle"
            data-test="react-autoql-filter-lock-persist-toggle"
            type="switch"
            checked={!filter.isSession}
            onChange={() => this.handlePersistToggle(filter)}
          />
          <Icon
            className="react-autoql-remove-filter-icon"
            data-test="react-autoql-remove-filter-icon"
            data-tip="Remove filter"
            data-for="filter-locking-tooltip"
            data-delay-show={500}
            type="trash"
            onClick={() => this.removeFilter(filter)}
          />
        </div>
      </div>
    )
  }

  renderFilterList = () => {
    if (this.props.isFetchingFilters || this.state.isFetchingFilters) {
      return (
        <div className="react-autoql-filter-lock-list-loading-container">
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.filters?.length) {
      return (
        <div className="react-autoql-empty-filter-list">
          <i>{lang.noFiltersLocked}</i>
        </div>
      )
    }

    const uniqueCategories = [
      ...new Set(this.state.filters.map((filter) => filter.show_message)),
    ]

    return (
      <div
        ref={(r) => (this.filterListContainerRef = r)}
        className="react-autoql-filter-list-container"
      >
        <CustomScrollbars>
          {uniqueCategories.map((category, i) => {
            return this.renderFilterListCategory(category, i)
          })}
        </CustomScrollbars>
      </div>
    )
  }

  render = () => {
    if (!this.props.isOpen) {
      return null
    }

    return (
      <ErrorBoundary>
        <ToastContainer
          className="filter-lock-toast-container"
          position="top-center"
          autoClose={800}
          transition={Slide}
          hideProgressBar
          pauseOnFocusLoss={false}
          draggable={false}
          pauseOnHover={false}
          closeButton={false}
          limit={1}
          theme={getThemeConfig(this.props.themeConfig).theme}
        />
        <ReactTooltip
          afterShow={(e) => handleTooltipBoundaryCollision(e, this)}
          ref={(r) => (this.reactTooltipRef = r)}
          className="react-autoql-tooltip"
          id="filter-locking-tooltip"
          effect="solid"
          place="top"
          html
        />
        <div
          className="filter-lock-menu-content"
          onClick={(e) => e.stopPropagation()}
        >
          {this.renderHeader()}
          {this.renderVLInput()}
          {this.renderFilterList()}
        </div>
      </ErrorBoundary>
    )
  }
}