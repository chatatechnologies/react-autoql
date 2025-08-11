import React, { Component } from 'react'
import debounce from 'lodash.debounce'
import axios from 'axios'
import { fetchVLAutocomplete, getAuthentication } from 'autoql-fe-utils'
import { Input } from '../Input'
import { Popover } from '../Popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './DashboardFilterAutocomplete.scss'

class FilterAutocomplete extends Component {
  constructor(props) {
    super(props)

    this.MAX_SUGGESTIONS = 10
    this.RECENT_LIMIT = 5 // how many recent items to keep

    this.state = {
      value: '',
      suggestions: [],
      recentSuggestions: [], // recently used (from localStorage)
      loading: false,
      error: null,
      popoverOpen: false,
      highlightedIndex: -1, // added
    }

    this.axiosSource = axios.CancelToken.source()

    // Wrap fetchSuggestions with debounce 300ms
    this.fetchSuggestionsDebounced = debounce(this.fetchSuggestions, 300)
  }

  componentDidMount() {
    // load recent items on mount so they're available immediately
    this.loadRecent()
  }

  componentWillUnmount() {
    this.axiosSource.cancel('Component unmounted')
    this.fetchSuggestionsDebounced.cancel()
  }

  /************** localStorage helpers **************/
  getRecentKey = () => {
    // namespaced per context + column so recents are scoped
    const contextPart = this.props.context ?? 'global'
    const columnPart = this.props.column ?? 'global'
    return `FilterAutocomplete.recent:${contextPart}:${columnPart}`
  }

  getRecentFromStorage = () => {
    try {
      const raw = localStorage.getItem(this.getRecentKey())
      return raw ? JSON.parse(raw) : []
    } catch (err) {
      // localStorage unavailable or parse error
      return []
    }
  }

  saveRecentToStorage = (list) => {
    try {
      localStorage.setItem(this.getRecentKey(), JSON.stringify(list))
    } catch (err) {
      // ignore failures silently
    }
  }

  loadRecent = () => {
    const recentSuggestions = this.getRecentFromStorage()
    this.setState({ recentSuggestions })
  }

  addToRecent = (suggestion) => {
    try {
      const cur = this.getRecentFromStorage()

      const display = this.getDisplayName(suggestion)
      // drop duplicates (by display name)
      const filtered = cur.filter((r) => this.getDisplayName(r) !== display)
      filtered.unshift(suggestion) // most-recent-first
      const limited = filtered.slice(0, this.RECENT_LIMIT)

      this.saveRecentToStorage(limited)
      this.setState({ recentSuggestions: limited })
    } catch (err) {
      // ignore
    }
  }

  /************** helpers **************/
  getDisplayName = (s) => {
    if (!s) return ''
    if (typeof s === 'string') return s
    return s.format_txt ?? s.keyword ?? s.name ?? ''
  }

  /**
   * Merge recents + apiMatches into a combined, deduped list.
   * - Filters recents by `value` (case-insensitive substring)
   * - Appends API matches excluding any that have the same display text as a recent
   * - Truncates to MAX_SUGGESTIONS
   */
  mergeResults = (value, recent = [], apiMatches = []) => {
    const valLower = (value || '').toLowerCase()

    const recentFiltered = (recent || []).filter((r) => this.getDisplayName(r).toLowerCase().includes(valLower))

    const apiFiltered = (apiMatches || []).filter(
      (a) => !recentFiltered.some((r) => this.getDisplayName(r) === this.getDisplayName(a)),
    )

    const merged = [...recentFiltered, ...apiFiltered]
    return merged.slice(0, this.MAX_SUGGESTIONS)
  }

  handleFocus = () => {
    const { value, recentSuggestions, suggestions } = this.state
    const merged = this.mergeResults(value, recentSuggestions, suggestions)
    this.setState({
      popoverOpen: true,
      highlightedIndex: merged.length > 0 ? 0 : -1,
    })
  }

  handleChange = (e) => {
    const value = e.target.value
    const { recentSuggestions, suggestions } = this.state
    const merged = this.mergeResults(value, recentSuggestions, suggestions)

    this.setState({
      value,
      error: null,
      popoverOpen: true,
      highlightedIndex: merged.length > 0 ? 0 : -1,
    })

    this.fetchSuggestionsDebounced(value)
  }

  handleKeyDown = (e) => {
    const { highlightedIndex, popoverOpen, recentSuggestions = [], suggestions = [], value = '' } = this.state

    // Merge recent + API results in the same way as renderSuggestions
    const merged = this.mergeResults(value, recentSuggestions, suggestions)
    const len = merged.length

    if (!popoverOpen || len === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (highlightedIndex + 1 + len) % len
      this.setState({ highlightedIndex: nextIndex })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = (highlightedIndex - 1 + len) % len
      this.setState({ highlightedIndex: nextIndex })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // If nothing highlighted, fallback to first
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0
      if (idx < len) {
        const chosen = merged[idx]
        this.handleSuggestionClick(chosen)
      }
    } else if (e.key === 'Escape') {
      this.setState({ popoverOpen: false, highlightedIndex: -1 })
    }
  }

  fetchSuggestions = (value) => {
    if (!value.trim()) {
      // still show recents when value empty (don't close popover)
      this.setState({ suggestions: [], loading: false })
      return
    }

    // Cancel previous axios request
    this.axiosSource.cancel('Operation canceled due to new request.')
    this.axiosSource = axios.CancelToken.source()

    this.setState({ loading: true })

    fetchVLAutocomplete({
      ...getAuthentication(this.props.authentication),
      suggestion: value,
      context: this.props.context,
      filter: this.props.column,
      cancelToken: this.axiosSource.token,
    })
      .then((response) => {
        const body = response?.data?.data
        const matches = body?.matches || []

        const limitedMatches = matches.slice(0, this.MAX_SUGGESTIONS)

        // merged list that includes recents at top
        const merged = this.mergeResults(value, this.state.recentSuggestions, limitedMatches)

        this.setState({
          suggestions: limitedMatches,
          loading: false,
          highlightedIndex: merged.length > 0 ? 0 : -1,
        })
      })
      .catch((error) => {
        if (axios.isCancel(error)) return
        this.setState({ error: 'Error fetching suggestions', loading: false })
      })
  }

  handleSuggestionClick = (suggestion) => {
    // persist to recent and then close
    this.addToRecent(suggestion)

    this.inputRef?.blur()

    this.setState({ value: '', suggestions: [], popoverOpen: false, highlightedIndex: -1 })
    if (this.props.onSelect) this.props.onSelect(suggestion)
  }

  handlePopoverClickOutside = () => {
    this.setState({ popoverOpen: false, highlightedIndex: -1 })
  }

  hasContentToShow = () => {
    const { recentSuggestions, suggestions, loading, error, value } = this.state
    const hasRecent = recentSuggestions.length > 0 && !value
    const hasSuggestions = suggestions.length > 0 && value
    return hasRecent || hasSuggestions || loading || error
  }

  renderSuggestions = () => {
    const { suggestions, highlightedIndex, recentSuggestions, value, loading } = this.state

    const elements = []
    let itemIndex = 0 // index for navigation (ignores headers)

    console.log({ value })
    // --- Recently Used Section ---
    if (recentSuggestions.length > 0 && !value) {
      elements.push(
        <div key='recent-header' className='react-autoql-dashboard-filter-autocomplete-li-header'>
          Recently Used
        </div>,
      )

      recentSuggestions.forEach((s, i) => {
        const displayName = s.format_txt ?? s.keyword
        if (!displayName) return

        let displayNameType = s.show_message ? `(${s.show_message})` : ''
        const isHighlighted = itemIndex === highlightedIndex

        elements.push(
          <div
            key={`recent-${i}`}
            onClick={() => this.handleSuggestionClick(s)}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => this.setState({ highlightedIndex: itemIndex })}
            className={`react-autoql-dashboard-filter-autocomplete-li${isHighlighted ? ' highlighted' : ''}`}
            role='option'
            aria-selected={isHighlighted}
            id={`autocomplete-item-${itemIndex}`}
          >
            <strong>{displayName}</strong> <em>{displayNameType}</em>
          </div>,
        )

        itemIndex++
      })
    }

    // --- Related To Section ---
    if (!loading && suggestions.length > 0 && value) {
      elements.push(
        <div key='related-header' className='react-autoql-dashboard-filter-autocomplete-li-header'>
          Related to "{value}"
        </div>,
      )

      suggestions.forEach((s, i) => {
        // Avoid showing duplicate that already exists in recents
        if (recentSuggestions.some((r) => r.keyword === s.keyword)) return

        const displayName = s.format_txt ?? s.keyword
        if (!displayName) return

        let displayNameType = s.show_message ? `(${s.show_message})` : ''
        const isHighlighted = itemIndex === highlightedIndex

        elements.push(
          <div
            key={`suggestion-${i}`}
            onClick={() => this.handleSuggestionClick(s)}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => this.setState({ highlightedIndex: itemIndex })}
            className={`react-autoql-dashboard-filter-autocomplete-li${isHighlighted ? ' highlighted' : ''}`}
            role='option'
            aria-selected={isHighlighted}
            id={`autocomplete-item-${itemIndex}`}
          >
            <strong>{displayName}</strong> <em>{displayNameType}</em>
          </div>,
        )

        itemIndex++
      })
    }

    return elements
  }

  renderPopoverContent = () => {
    const { loading, error } = this.state

    return (
      <div
        style={{
          maxHeight: 300,
          overflowY: 'auto',
          backgroundColor: 'white',
          borderRadius: 4,
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          padding: '4px 0',
          minWidth: 300,
        }}
        role='listbox'
        id='autocomplete-list'
      >
        {this.renderSuggestions()}
      </div>
    )
  }

  render = () => {
    const { value, popoverOpen, highlightedIndex } = this.state

    const showPopover = popoverOpen && this.hasContentToShow()

    return (
      <ErrorBoundary>
        <div>
          <Popover
            isOpen={showPopover}
            onClickOutside={this.handlePopoverClickOutside}
            content={this.renderPopoverContent()}
            padding={0}
            positions={['bottom', 'left', 'right', 'top']}
            align='end'
            reposition={true}
            showArrow={false}
          >
            <div onKeyDown={this.handleKeyDown} tabIndex={-1}>
              <Input
                ref={(r) => (this.inputRef = r)}
                value={value}
                onChange={this.handleChange}
                onKeyDown={this.handleKeyDown}
                onFocus={this.handleFocus}
                placeholder='Filter by...'
                icon='filter-lines'
                round
                aria-autocomplete='list'
                aria-controls='autocomplete-list'
                aria-activedescendant={highlightedIndex >= 0 ? `autocomplete-item-${highlightedIndex}` : undefined}
                role='combobox'
              />
            </div>
          </Popover>
        </div>
      </ErrorBoundary>
    )
  }
}

export default FilterAutocomplete
