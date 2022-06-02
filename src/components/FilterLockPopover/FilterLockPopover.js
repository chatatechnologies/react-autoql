import React from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import { lang } from '../../js/Localization'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import _cloneDeep from 'lodash.clonedeep'
import { ToastContainer, toast } from 'react-toastify'
import { Slide } from 'react-toastify'
import Popover from 'react-tiny-popover'
import { Radio } from '../Radio'

import { Icon } from '../Icon'
import { Button } from '../Button'
import { LoadingDots } from '../LoadingDots'
import { Checkbox } from '../Checkbox'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  fetchVLAutocomplete,
  setFilters,
  unsetFilterFromAPI,
  fetchFilters,
} from '../../js/queryService'

import { authenticationType, themeConfigType } from '../../props/types'
import {
  authenticationDefault,
  getAuthentication,
  getThemeConfig,
  themeConfigDefault,
} from '../../props/defaults'

import './FilterLockPopover.scss'
import 'react-toastify/dist/ReactToastify.css'

let autoCompleteArray = []

export default class FilterLockPopover extends React.Component {
  constructor(props) {
    super(props)

    this.contentKey = uuid()

    this.state = {
      filters: [],
      suggestions: [],
      inputValue: '',
    }
  }

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,

    isOpen: PropTypes.bool,
    position: PropTypes.string,
    align: PropTypes.string,
    onChange: PropTypes.func,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,

    isOpen: false,
    position: 'bottom',
    align: 'center',
    rebuildTooltips: () => {},
    onChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(this.state.filters, prevState.filters)) {
      this.props.onChange(this.state.filters)
      this.props.rebuildTooltips()
    }

    if (!this.props.isOpen && prevProps.isOpen) {
      this.setState({ inputValue: '' })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.animateTextTimeout)
    clearTimeout(this.focusInputTimeout)
    clearTimeout(this.highlightFilterEndTimeout)
    clearTimeout(this.highlightFilterStartTimeout)
  }

  initialize = () => {
    this.setState({ isFetchingFilters: true })
    fetchFilters(getAuthentication(this.props.authentication))
      .then((response) => {
        const filters = response?.data?.data?.data || []
        if (this._isMounted) {
          this.setState({ filters, isFetchingFilters: false })
        }
      })
      .catch((error) => {
        console.error(error)
        if (this._isMounted) {
          this.setState({ isFetchingFilters: false })
        }
      })
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
    if (typeof text === 'string' && _get(text, 'length')) {
      const totalTime = 2000
      const timePerChar = totalTime / text.length
      for (let i = 1; i <= text.length; i++) {
        this.animateTextTimeout = setTimeout(() => {
          this.setState({ inputValue: text.slice(0, i) })
          if (i === text.length) {
            this.focusInputTimeout = setTimeout(() => {
              this.inputElement = document.querySelector(
                '#react-autoql-filter-menu-input'
              )
              this.inputElement?.focus()
            }, 300)
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

  findFilter = ({ filterText, canonical, keyword, value, key }) => {
    const allFilters = this.state.filters

    if (canonical && keyword) {
      return allFilters.find(
        (filter) => filter.key === canonical && filter.value === keyword
      )
    } else if (value && key) {
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
          const body = _get(response, 'data.data')
          const sortingArray = []
          let suggestionsMatchArray = []
          autoCompleteArray = []
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
            autoCompleteArray.push(anObject)
          }
          this.setState({ suggestions: autoCompleteArray })
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
        this.setState({ filters: oldFilters })
        toast.error(`Something went wrong. Please try again.`)
        return Promise.reject()
      })
  }

  setFilter = (newFilter) => {
    const auth = getAuthentication(this.props.authentication)

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
        return Promise.reject()
      })
  }

  unsetFilter = (filter) => {
    try {
      const auth = getAuthentication(this.props.authentication)
      return unsetFilterFromAPI({ ...auth, filter })
    } catch (error) {
      return Promise.reject(error)
    }
  }

  getSuggestionValue = (sugg) => {
    if (!!this.findFilter(sugg)) {
      this.handleHighlightFilterRow(this.getKey(sugg))
    } else {
      let newFilter = this.createNewFilterFromSuggestion(sugg)

      this.setFilter(newFilter)
        .then(() => toast.success(`${sugg.keyword} has been locked.`))
        .catch(() => toast.error(`Something went wrong. Please try again.`))
    }
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
      toast.error('Something went wrong. Please try again.')
      this.setState({ filters: oldFilters })
    }
  }

  handleExcludeToggle = (category, value) => {
    if (!value) {
      return
    }

    try {
      const newFilters = this.state.filters.map((filter) => {
        if (filter.show_message === category) {
          return {
            ...filter,
            filter_type: value,
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
      toast.error('Something went wrong. Please try again.')
      this.setState({ filters: oldFilters })
    }

    toast.success('Filter removed.')
    ReactTooltip.hide()
  }

  onInputChange = (e) => {
    if (e.keyCode === 38 || e.keyCode === 40) {
      return // keyup or keydown
    }

    if (e && e.target && (e.target.value || e.target.value === '')) {
      this.setState({ inputValue: e.target.value })
    }
  }

  getKey = (filter) => {
    const key = filter.key || filter.canonical
    const value = filter.value || filter.keyword
    return `${key}-${value}`
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
            data-tip="
            Filters can be applied to narrow down<br />
            your query results. Locking a filter<br />
            ensures that only the specific data<br />
            you wish to see is returned."
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
      <Button
        onClick={this.props.onClose}
        className="filter-locking-close-btn"
        data-tip={lang.closeFilterLocking}
        data-for="filter-locking-tooltip"
        size="small"
      >
        <Icon type="close" />
      </Button>
    )
  }

  renderFooter = () => {
    return (
      <div className="filter-lock-menu-footer">
        <Button onClick={this.props.onClose} size="small">
          Continue
        </Button>
      </div>
    )
  }

  renderVLInput = () => {
    return (
      <Autosuggest
        id="react-autoql-filter-menu-input"
        highlightFirstSuggestion
        suggestions={this.state.suggestions}
        onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
        onSuggestionsClearRequested={this.onSuggestionsClearRequested}
        getSuggestionValue={(sugg) => this.getSuggestionValue(sugg.name)}
        renderSuggestion={(suggestion) => (
          <ul className="filter-lock-suggestion-item">
            <li>{suggestion.name.keyword}</li>
            <li>{suggestion.name.show_message}</li>
          </ul>
        )}
        inputProps={{
          onChange: this.onInputChange,
          value: this.state.inputValue,
          disabled: this.state.isFetchingFilters,
          placeholder: 'Search & select a filter',
          className: 'react-autoql-condition-locking-input',
          id: 'react-autoql-filter-menu-input',
        }}
      />
    )
  }

  renderFilterListCategory = (category, i) => {
    return (
      <div key={category}>
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
      <div className="react-autoql-filter-list-title flex ">
        <div>
          <h4>
            <span className="filter-lock-category-title">{category}</span>
            <Radio
              className="include-exclude-toggle-group"
              themeConfig={getThemeConfig(this.props.themeConfig)}
              options={['INCLUDE', 'EXCLUDE']}
              tooltips={[
                'Only show results with these values',
                'Show results without these values',
              ]}
              tooltipId="filter-locking-tooltip"
              value={toggleButtonValue}
              type="button"
              onChange={(value) => this.handleExcludeToggle(category, value)}
            />
          </h4>
        </div>
        {i === 0 ? (
          <div className="persist-toggle-column">
            <h4>
              Persist{' '}
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
            </h4>
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
        className={`flex ${
          this.state.highlightedFilter === key
            ? 'react-autoql-highlight-row'
            : ''
        }`}
      >
        <div className="react-autoql-condition-table-list-item">
          {filter.value}
        </div>
        <div id="react-autoql-condition-table-settings">
          <Checkbox
            className="persist-toggle-column"
            type="switch"
            checked={!filter.isSession}
            onChange={() => this.handlePersistToggle(filter)}
          />
          <Icon
            className="react-autoql-remove-filter-icon"
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
    if (this.state.isFetchingFilters) {
      return (
        <div className="react-autoql-condition-list-loading-container">
          <LoadingDots />
        </div>
      )
    }

    if (!this.state.filters?.length) {
      return (
        <div className="react-autoql-empty-condition-list">
          <i>{lang.noFiltersLocked}</i>
        </div>
      )
    }

    const uniqueCategories = [
      ...new Set(this.state.filters.map((filter) => filter.show_message)),
    ]

    return (
      <div className="react-autoql-filter-list-container">
        {uniqueCategories.map((category, i) => {
          return this.renderFilterListCategory(category, i)
        })}
      </div>
    )
  }

  renderContent = () => {
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
          limit={2}
          theme={getThemeConfig(this.props.themeConfig).theme}
        />
        <div
          className="filter-lock-menu-content"
          onClick={(e) => e.stopPropagation()}
        >
          {this.renderHeader()}
          {this.renderVLInput()}
          {this.renderFilterList()}
          {this.renderFooter()}
          <ReactTooltip
            className="react-autoql-drawer-tooltip"
            id="filter-locking-tooltip"
            effect="solid"
            place="top"
            html
          />
        </div>
      </ErrorBoundary>
    )
  }

  render = () => {
    if (this.props.isOpen) {
      return (
        <Popover
          isOpen={this.props.isOpen}
          onClickOutside={this.props.onClose}
          position={this.props.position}
          align={this.props.align}
          content={this.renderContent()}
          containerClassName="filter-lock-menu"
        >
          <ErrorBoundary>{this.props.children || null}</ErrorBoundary>
        </Popover>
      )
    }
    return this.props.children || null
  }
}
