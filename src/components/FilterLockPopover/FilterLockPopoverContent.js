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
import { fuzzyMatch } from './fuzzyMatch'

import 'react-toastify/dist/ReactToastify.css'

/**
 * Ceiling on how many injected matches are rendered at once. The dropdown is
 * not virtualised and an empty query matches everything, so this bounds both
 * the DOM and the work per keystroke. Integrators pass whatever their backend
 * returns, so the ceiling is enforced here rather than assumed.
 */
const MAX_RENDERED_SUGGESTIONS = 100

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
    tooltipID: PropTypes.string,
    /**
     * Values this user may filter on, supplied by the integrator. When set,
     * it REPLACES the value-label autocomplete: the popover shows the whole
     * list up front, searches it locally (fuzzy), and never calls out per
     * keystroke. Leave undefined for the default autocomplete behaviour.
     *
     * Entries are `'Smith Family'` or `{ value, show_message }`. A picked
     * value carries no filter metadata, so it is resolved through the
     * value-label autocomplete on pick — and a bare string that matches more
     * than one kind of filter is REJECTED rather than bound to whichever the
     * API returned first. Supply `show_message` for any value whose display
     * text is not unique across categories; it also gets shown in the list,
     * so the user can see which one they are picking.
     *
     * Referential stability is preferred: the list is compared by content, but
     * an inline array literal pays that comparison on every parent render.
     * Hold it in state or a memo.
     *
     * At most `MAX_RENDERED_SUGGESTIONS` matches are rendered; the heading
     * says so when the rest are cut.
     */
    suggestionList: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({ value: PropTypes.string.isRequired, show_message: PropTypes.string }),
      ]),
    ),
    /** Section heading over an unfiltered `suggestionList`. */
    suggestionListTitle: PropTypes.string,
  }

  static defaultProps = {
    authentication: authenticationDefault,

    insertedFilter: null,
    isOpen: false,
    onClose: () => {},
    onChange: () => {},
    suggestionList: undefined,
    suggestionListTitle: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true

    if (this.state.filters) {
      this.props.onChange(this.state.filters)
    }

    if (this.props.isOpen && this.props.insertedFilter) {
      this.insertFilter(this.props.insertedFilter)
    }

    if (this.props.isOpen && this.hasSuggestionList()) {
      this.fetchSuggestions({ value: '' })
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

    // Prime the list on open so it is ready the instant the user focuses the
    // search box. Focusing is what actually drops it down, and doing that for
    // the user is unwanted — the popover should open quiet. Also re-run the
    // search if the list arrives late (integrators usually fetch it async).
    if (this.hasSuggestionList()) {
      if (this.props.isOpen && !prevProps.isOpen) {
        this.fetchSuggestions({ value: '' })
      } else if (this.props.isOpen && !this.sameSuggestionList(this.props.suggestionList, prevProps.suggestionList)) {
        this.fetchSuggestions({ value: this.state.inputValue })
      }

      // Locking a filter resets the input. Re-run the local search so the list
      // doesn't keep the previous query's matches — and its highlighting —
      // sitting under an empty search box the next time it opens.
      if (!this.state.inputValue && prevState.inputValue) {
        this.fetchSuggestions({ value: '' })
      }
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

  hasSuggestionList = () => Array.isArray(this.props.suggestionList)

  /**
   * Compare two injected lists by content, so an integrator handing us a fresh
   * array literal each render does not churn the suggestions state. The
   * identity check stays as the fast path for callers that do hold a stable
   * reference.
   */
  sameSuggestionList = (a, b) => {
    if (a === b) {
      return true
    }
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }

    return a.every((entry, i) => {
      const other = b[i]
      if (entry === other) {
        return true
      }
      if (typeof entry === 'string' || typeof other === 'string') {
        return false
      }
      return entry?.value === other?.value && entry?.show_message === other?.show_message
    })
  }

  /**
   * Turn an injected value (a bare string) into a real filter.
   *
   * `setFilters` needs `key` (canonical), `canonical_key` (column_name) and
   * `show_message`, and an injected list carries none of them — so the PICKED
   * value is resolved through the value-label autocomplete here: one request
   * for one value, instead of one per keystroke.
   *
   * Exact match only, on `keyword` or `format_txt`. Locking a value the user
   * did not choose is worse than not locking at all — which is also why an
   * AMBIGUOUS value is rejected: the same display text can exist under two
   * categories, and picking whichever the API returned first would silently
   * bind the lock to the wrong `canonical_key`. `showMessage` (from an object
   * entry) narrows the matches first, so an integrator who knows the category
   * can still lock a value whose text is not unique.
   */
  resolveSuggestion = (value, showMessage) => {
    return fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
    }).then((response) => {
      const matches = response?.data?.data?.matches ?? []
      const target = `${value}`.trim().toLowerCase()
      let exact = matches.filter(
        (m) =>
          `${m?.keyword ?? ''}`.trim().toLowerCase() === target ||
          `${m?.format_txt ?? ''}`.trim().toLowerCase() === target,
      )

      if (showMessage) {
        const scoped = exact.filter((m) => m?.show_message === showMessage)
        if (scoped.length) {
          exact = scoped
        }
      }

      if (!exact.length) {
        const error = new Error(`No filterable value found for "${value}"`)
        error.code = 'NOT_FOUND'
        return Promise.reject(error)
      }

      // Only a match that would build a DIFFERENT lock counts as ambiguous —
      // duplicates that resolve to the same filter are harmless.
      const distinct = new Set(
        exact.map((m) => `${m?.canonical ?? ''}|${m?.column_name ?? ''}|${m?.show_message ?? ''}`),
      )
      if (distinct.size > 1) {
        const categories = [...new Set(exact.map((m) => m?.show_message).filter(Boolean))]
        const error = new Error(
          `"${value}" matches more than one filter${categories.length ? ` (${categories.join(', ')})` : ''}`,
        )
        error.code = 'AMBIGUOUS'
        return Promise.reject(error)
      }

      return this.createNewFilterFromSuggestion(exact[0])
    })
  }

  fetchSuggestions = ({ value }) => {
    // An injected list replaces the autocomplete entirely: the integrator has
    // already decided which values this user may filter on, so the search is
    // local and no request goes out until something is picked.
    if (this.hasSuggestionList()) {
      const ranked = fuzzyMatch(this.props.suggestionList, value)
      const suggestions = ranked.slice(0, MAX_RENDERED_SUGGESTIONS).map((result) => ({
        name: {
          keyword: result.name,
          show_message: result.show_message,
          ranges: result.ranges,
          unresolved: true,
        },
      }))

      if (this._isMounted) {
        this.setState({ suggestions, suggestionTotal: ranked.length, isLoadingAutocomplete: false })
      }
      return
    }

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
    // react-autosuggest clears on every pick. Refilling here would shut the
    // dropdown and immediately reopen it — it reads as the list flickering on
    // each click. An injected list is static, so leave it: emptying the input
    // still re-runs the local search through onSuggestionsFetchRequested.
    if (this.hasSuggestionList()) {
      return
    }

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

    // Injected pick — resolve it to a real filter first, then fall through the
    // normal path. The resolved value can duplicate an existing lock, which
    // only becomes visible now (the placeholder had no key to compare on).
    if (newFilter.unresolved) {
      this.showSavingIndicator()
      return this.resolveSuggestion(newFilter.value, newFilter.show_message)
        .then((resolved) => {
          const existing = this.findFilter(resolved)
          if (existing) {
            this.setState({ inputValue: '', isSaving: false })
            this.handleHighlightFilterRow(this.getKey(existing))
            return Promise.resolve()
          }
          return this.setFilter(resolved)
        })
        .catch((error) => {
          console.error('FilterLockPopover - setFilter - Error resolving suggestion:', error)
          this.setState({ isSaving: false })
          toast.error(
            error?.code === 'AMBIGUOUS'
              ? `"${newFilter.value}" matches more than one kind of filter, so it can't be locked automatically.`
              : `"${newFilter.value}" can't be used as a filter right now.`,
          )
          return Promise.reject()
        })
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
          this.props.onChange(updatedFilters)
        } else {
          const newFilters = [...this.state.filters, updatedFilter]
          this.setState({
            filters: newFilters,
            inputValue: '',
          })
          this.props.onChange(newFilters)
        }
        return Promise.resolve()
      })
      .catch((error) => {
        console.error('FilterLockPopover - setFilter - Error:', error)
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

    // react-autosuggest needs a value synchronously, and an injected value
    // cannot be turned into a filter without a round trip — hand back a
    // placeholder for setFilter to resolve.
    if (name?.unresolved) {
      return { value: name.keyword, show_message: name.show_message, unresolved: true }
    }

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

  /** Bold the fuzzy-matched characters of an injected value. */
  renderHighlightedValue = (value, ranges) => {
    if (!ranges?.length) {
      return value
    }

    const parts = []
    let at = 0
    ranges.forEach(([start, end], i) => {
      if (start > at) {
        parts.push(value.slice(at, start))
      }
      parts.push(<strong key={i}>{value.slice(start, end)}</strong>)
      at = end
    })
    if (at < value.length) {
      parts.push(value.slice(at))
    }

    return parts
  }

  renderSuggestion = ({ name }) => {
    // An injected value has no category to show yet — that only exists once it
    // has been resolved, which happens on pick.
    if (name?.unresolved) {
      // The category only exists when the integrator supplied it. Showing it
      // is what lets a user tell two same-named values apart — without it,
      // an ambiguous pick is refused rather than guessed at.
      const category = name.show_message
      return (
        <ul
          className='filter-lock-suggestion-item'
          data-tooltip-id={this.props.tooltipID ?? this.TOOLTIP_ID}
          data-tooltip-delay-show={800}
          data-tooltip-html={category ? `${name.keyword} <em>(${category})</em>` : name.keyword}
        >
          <span>
            {this.renderHighlightedValue(name.keyword, name.ranges)}
            {category ? <em> ({category})</em> : null}
          </span>
        </ul>
      )
    }

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

  getSuggestionsTitle = () => {
    if (!this.hasSuggestionList()) {
      return `Related to "${this.state.inputValue}"`
    }

    // An unfiltered injected list is not "related to" anything yet.
    const base = this.state.inputValue
      ? `Related to "${this.state.inputValue}"`
      : (this.props.suggestionListTitle ?? 'All values')

    // Never let a cut list look complete.
    const shown = this.state.suggestions?.length ?? 0
    const total = this.state.suggestionTotal ?? shown
    return total > shown ? `${base} — first ${shown} of ${total}` : base
  }

  /**
   * The default only renders suggestions once the input is non-empty. With an
   * injected list the full list IS the picker, so it shows on an empty input
   * too — with ONE exception.
   *
   * ⚠️ `suggestions-updated` is react-autosuggest's auto-reveal path: it
   * reopens a collapsed dropdown whenever the suggestions array changes
   * identity, and `getSuggestions()` returns a fresh array on EVERY render.
   * Answering true there means picking a value closes the list and the very
   * next render reopens it — a visible flicker on every click. (The default
   * path never hits this: picking clears the input, and an empty input is
   * already false for it.)
   */
  shouldRenderSuggestions = (value, reason) => {
    if (!this.hasSuggestionList()) {
      return `${value ?? ''}`.trim().length > 0
    }

    return reason !== 'suggestions-updated'
  }

  getSuggestions = () => {
    const sections = []
    const doneLoading = !this.state.isLoadingAutocomplete
    const hasSuggestions = !!this.state.suggestions?.length && doneLoading
    const noSuggestions = !this.state.suggestions?.length && doneLoading

    if (hasSuggestions) {
      sections.push({
        title: this.getSuggestionsTitle(),
        suggestions: this.state.suggestions,
      })
    } else if (noSuggestions) {
      sections.push({
        title: this.getSuggestionsTitle(),
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
          shouldRenderSuggestions={this.shouldRenderSuggestions}
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
