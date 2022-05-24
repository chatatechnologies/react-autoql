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

import { Icon } from '../Icon'
import { Button } from '../Button'
import { LoadingDots } from '../LoadingDots'
import { Checkbox } from '../Checkbox'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import {
  fetchVLAutocomplete,
  setFilters,
  unsetFilter,
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
    initFilterText: PropTypes.string,
    position: PropTypes.string,
    align: PropTypes.string,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,

    isOpen: false,
    initFilterText: '',
    position: 'bottom',
    align: 'center',
    onChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.initialize()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(this.state.filters, prevState.filters)) {
      this.props.onChange(this.state.filters)
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
        const filters = response?.data?.data?.data
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

  handleHighlightFilterRow(filter) {
    const key = this.getKey(filter)
    const startAt = 0
    const duration = 1300

    this.highlightFilterStartTimeout = setTimeout(() => {
      this.setState({ highlightedFilter: key })
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
      this.handleHighlightFilterRow(existingFilter)
    } else {
      this.animateInputTextAndSubmit(filterText)
    }
  }

  getAllFilters = () => {
    return this.state.filters
  }

  getPersistedFilters = () => {
    return _cloneDeep(
      this.state.filters.filter((filter) => filter.lock_flag === 1)
    )
  }

  findFilter = ({ filterText, canonical, keyword }) => {
    const allFilters = this.state.filters

    if (filterText) {
      return allFilters.find((filter) => filter.value === filterText)
    } else if (canonical && keyword) {
      return allFilters.find(
        (filter) => filter.key === canonical && filter.value === keyword
      )
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

  getSuggestionValue = (suggestion) => {
    if (
      !!this.findFilter({
        canonical: suggestion.name.canonical,
        keyword: suggestion.name.keyword,
      })
    ) {
      toast.info('This condition has already been applied.')
    } else {
      const newFilter = {
        value: suggestion.name.keyword,
        show_message: suggestion.name.show_message,
        key: suggestion.name.canonical,
        lock_flag: 1,
      }

      const oldFilters = this.getPersistedFilters()
      const newFilters = [...oldFilters, newFilter]
      this.setState({ filters: newFilters, inputValue: '' })

      const auth = getAuthentication(this.props.authentication)
      setFilters({ ...auth, filters: newFilters })
        .then(() => {
          toast.success(`${suggestion.name.keyword} has been locked`)
          fetchFilters({ ...auth }).then((response) => {
            const filter = response?.data?.data?.data?.find(
              (filter) =>
                filter.key === suggestion.name.canonical &&
                filter.value === suggestion.name.keyword
            )
            const updatedFilters = [...oldFilters, filter]
            this.setState({ filters: updatedFilters })
          })
        })
        .catch((error) => {
          console.error(error)
          toast.error(`Something went wrong. Please try again.`)
          this.setState({ filters: oldFilters })
        })
    }
  }

  handlePersistToggle = async (clickedFilter) => {
    const oldFilters = this.state.filters
    const newFilters = this.state.filters.map((filter) => {
      const lock_flag = clickedFilter.lock_flag === 0 ? 1 : 0
      if (this.getKey(filter) === this.getKey(clickedFilter))
        return { ...filter, lock_flag }
      return filter
    })

    this.setState({ filters: newFilters })

    try {
      const auth = getAuthentication(this.props.authentication)
      if (clickedFilter.lock_flag === 0) {
        await setFilters({ ...auth, filters: newFilters })
      } else {
        await unsetFilter({ ...auth, filter: clickedFilter })
      }
    } catch (error) {
      console.error(error)
      this.setState({ filters: oldFilters })
    }
  }

  removeFilter = (clickedFilter) => {
    const oldFilters = this.state.filters
    const newFilters = this.state.filters.filter(
      (filter) => this.getKey(filter) !== this.getKey(clickedFilter)
    )

    this.setState({ filters: newFilters })

    if (clickedFilter.lock_flag === 1) {
      const auth = getAuthentication(this.props.authentication)
      unsetFilter({ ...auth, filter: clickedFilter })
        .then(() => {
          toast.success('Filter removed.')
        })
        .catch((error) => {
          console.error(error)
          this.setState({ filters: oldFilters })
        })
    }

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

  getKey = (filter) => `${filter.key}-${filter.value}`

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
        getSuggestionValue={this.getSuggestionValue}
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

    return (
      <div className="react-autoql-filter-list-container">
        <div className="react-autoql-filter-list-title flex ">
          <div>
            <h4>Filter</h4>
          </div>
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
        </div>
        <div className="react-autoql-filter-list">
          {this.state.filters.map((filter) => {
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
                  {`${filter.value} (${filter.show_message})`}
                </div>
                <div id="react-autoql-condition-table-settings">
                  <Checkbox
                    className="persist-toggle-column"
                    type="switch"
                    checked={!!filter.lock_flag}
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
          })}
        </div>
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
