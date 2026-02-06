import React, { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import axios from 'axios'
import Autosuggest from 'react-autosuggest'
import { fetchVLAutocomplete, REQUEST_CANCELLED_ERROR, getAuthentication, authenticationDefault } from 'autoql-fe-utils'
import { isAbortError, createCancelPair } from '../../utils/abortUtils'
import { CustomScrollbars } from '../CustomScrollbars'
import { Icon } from '../Icon'

import { authenticationType } from '../../props/types'

import '../FilterLockPopover/FilterLockPopover.scss'

const DashboardSlicer = (props) => {
  const autoCompleteArrayRef = useRef([])
  const axiosSourceRef = useRef(null)
  const autocompleteTimerRef = useRef(null)
  const userTypedValueRef = useRef(null)
  const MAX_RECENT_SELECTIONS = 5
  const autocompleteDelay = 100

  const [suggestions, setSuggestions] = useState([])
  const [suggestedSlicerItems, setSuggestedSlicerItems] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false)
  const [recentSelections, setRecentSelections] = useState([])

  const getRecentSelectionsKey = useCallback(() => {
    const dashboardId = props.dashboardId || 'default'
    return `react-autoql-dashboard-slicer-recent-${dashboardId}`
  }, [props.dashboardId])

  const loadRecentSelections = useCallback(() => {
    try {
      const key = getRecentSelectionsKey()
      const recentStr = localStorage.getItem(key)
      if (recentStr) {
        const recent = JSON.parse(recentStr)
        if (Array.isArray(recent) && recent.length > 0) {
          setRecentSelections(recent)
        }
      }
    } catch (error) {
      console.error('Error loading recent selections:', error)
    }
  }, [getRecentSelectionsKey])

  const saveRecentSelections = useCallback(
    (selections) => {
      try {
        const key = getRecentSelectionsKey()
        localStorage.setItem(key, JSON.stringify(selections))
      } catch (error) {
        console.error('Error saving recent selections:', error)
      }
    },
    [getRecentSelectionsKey],
  )

  const clearRecentSelections = useCallback(() => {
    setRecentSelections([])
    try {
      const key = getRecentSelectionsKey()
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error clearing recent selections:', error)
    }
  }, [getRecentSelectionsKey])

  const addToRecentSelections = useCallback(
    (selection) => {
      setRecentSelections((prev) => {
        // Remove if already exists
        const filtered = prev.filter((s) => {
          return s.key !== selection.key || s.value !== selection.value
        })

        // Add to beginning
        const updated = [selection, ...filtered].slice(0, MAX_RECENT_SELECTIONS)
        saveRecentSelections(updated)
        return updated
      })
    },
    [saveRecentSelections],
  )

  const fetchSuggestions = useCallback(
    ({ value, isSlicerSuggestion = false }) => {
      // If already fetching autocomplete, cancel it
      if (axiosSourceRef.current) {
        axiosSourceRef.current.controller?.abort(REQUEST_CANCELLED_ERROR)
      }

      setIsLoadingAutocomplete(true)
      axiosSourceRef.current = createCancelPair()

      fetchVLAutocomplete({
        ...getAuthentication(props.authentication),
        suggestion: value,
        context: props.context,
        signal: axiosSourceRef.current.controller.signal,
        cancelToken: axiosSourceRef.current.cancelToken,
      })
        .then((response) => {
          const body = response?.data?.data
          const sortingArray = []
          let suggestionsMatchArray = []
          autoCompleteArrayRef.current = []
          suggestionsMatchArray = body.matches || []

          for (const suggestion of suggestionsMatchArray) {
            sortingArray.push(suggestion)
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
            autoCompleteArrayRef.current.push(anObject)
          }

          // If this is for the slicer suggestion prop, store separately
          if (isSlicerSuggestion) {
            setSuggestedSlicerItems([...autoCompleteArrayRef.current])
            setIsLoadingAutocomplete(false)
          } else {
            // Otherwise, store in regular suggestions (for user typing)
            setSuggestions([...autoCompleteArrayRef.current])
            setIsLoadingAutocomplete(false)
          }
        })
        .catch((error) => {
          if (!isAbortError(error)) {
            console.error(error)
          }
          setIsLoadingAutocomplete(false)
        })
    },
    [props.authentication, props.context],
  )

  // Initialize on mount
  useEffect(() => {
    if (props.value) {
      setInputValue(props.value.format_txt || '')
    }
    loadRecentSelections()

    // Fetch suggestions for slicerSuggestion prop in the background
    if (props.slicerSuggestion) {
      fetchSuggestions({ value: props.slicerSuggestion, isSlicerSuggestion: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle value prop changes
  useEffect(() => {
    if (props.value) {
      setInputValue(props.value.format_txt || '')
    }
  }, [props.value])

  // Handle slicerSuggestion prop changes
  useEffect(() => {
    if (props.slicerSuggestion) {
      fetchSuggestions({ value: props.slicerSuggestion, isSlicerSuggestion: true })
    }
  }, [props.slicerSuggestion, fetchSuggestions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (axiosSourceRef.current) {
        axiosSourceRef.current.controller?.abort(REQUEST_CANCELLED_ERROR)
      }
      if (autocompleteTimerRef.current) {
        clearTimeout(autocompleteTimerRef.current)
      }
    }
  }, [])

  const onSuggestionsFetchRequested = useCallback(
    ({ value }) => {
      // If input is empty and no user typing, we're just showing suggested items - don't fetch
      if (!value && !userTypedValueRef.current) {
        return
      }

      // Track when user starts typing
      if (value && !userTypedValueRef.current) {
        userTypedValueRef.current = value
      }

      setIsLoadingAutocomplete(true)

      // Only debounce if a request has already been made
      if (axiosSourceRef.current) {
        clearTimeout(autocompleteTimerRef.current)
        autocompleteTimerRef.current = setTimeout(() => {
          fetchSuggestions({ value, isSlicerSuggestion: false })
        }, autocompleteDelay)
      } else {
        fetchSuggestions({ value, isSlicerSuggestion: false })
      }
    },
    [fetchSuggestions],
  )

  const onSuggestionsClearRequested = useCallback(() => {
    // Only clear user-typed suggestions, not the slicer suggestion items
    if (userTypedValueRef.current) {
      setSuggestions([])
    }
  }, [])

  const createNewFilterFromSuggestion = useCallback((suggestion) => {
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
  }, [])

  const getSuggestionValue = useCallback(
    (sugg) => {
      // If it's a recent selection (already a filter object), return it directly
      if (sugg.format_txt || sugg.value) {
        return sugg
      }

      // Otherwise, it's an autocomplete suggestion with a 'name' property
      const name = sugg.name
      const selectedFilter = createNewFilterFromSuggestion(name)
      return selectedFilter
    },
    [createNewFilterFromSuggestion],
  )

  const onInputChange = useCallback(
    (e, { newValue, method }) => {
      if (method === 'up' || method === 'down') {
        return
      }

      if (method === 'enter' || method === 'click') {
        // newValue is the filter object returned from getSuggestionValue
        const sessionFilterLock = newValue

        // Add to recent selections
        addToRecentSelections(sessionFilterLock)

        setInputValue(sessionFilterLock.format_txt || '')
        userTypedValueRef.current = null // Reset typing state
        props.onChange(sessionFilterLock)
      }

      if (typeof e?.target?.value === 'string') {
        setInputValue(e.target.value)
        // Track when user starts typing
        if (e.target.value && !userTypedValueRef.current) {
          userTypedValueRef.current = e.target.value
        } else if (!e.target.value) {
          userTypedValueRef.current = null // Reset when cleared
        }
      }
    },
    [addToRecentSelections, props],
  )

  const onInputFocus = useCallback(() => {
    // Reset typing state when input is focused (if empty)
    if (!inputValue) {
      userTypedValueRef.current = null
    }
  }, [inputValue])

  const renderSuggestion = useCallback((suggestion) => {
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
  }, [])

  const renderSuggestionsContainer = useCallback(({ containerProps, children, query }) => {
    const maxHeight = 300

    return (
      <div {...containerProps}>
        <div className='react-autoql-filter-suggestion-container'>
          <CustomScrollbars autoHeight autoHeightMin={0} maxHeight={maxHeight}>
            {children}
          </CustomScrollbars>
        </div>
      </div>
    )
  }, [])

  const getSuggestions = useCallback(() => {
    const sections = []
    const doneLoading = !isLoadingAutocomplete
    const inputIsEmpty = !userTypedValueRef.current && !inputValue

    // When input is empty, show Recent and Suggested sections
    if (inputIsEmpty) {
      // Show recent selections
      if (recentSelections?.length > 0) {
        sections.push({
          title: 'Recent',
          action: (
            <span className='data-explorer-clear-history-btn' onClick={clearRecentSelections}>
              Clear history
            </span>
          ),
          suggestions: recentSelections,
        })
      }

      // Show suggested items from slicerSuggestion prop
      if (suggestedSlicerItems?.length > 0 && doneLoading) {
        sections.push({
          title: 'Suggested',
          suggestions: suggestedSlicerItems,
        })
      }
    } else {
      // When user is typing, show "Related to..." section
      const hasSuggestions = !!suggestions?.length && doneLoading
      const noSuggestions = !suggestions?.length && doneLoading && inputValue

      if (hasSuggestions) {
        sections.push({
          title: `Related to "${inputValue}"`,
          suggestions: suggestions,
        })
      } else if (noSuggestions) {
        sections.push({
          title: `Related to "${inputValue}"`,
          suggestions: [{ name: '' }],
          emptyState: true,
        })
      }
    }

    return sections
  }, [isLoadingAutocomplete, inputValue, recentSelections, suggestedSlicerItems, suggestions, clearRecentSelections])

  const renderSectionTitle = useCallback((section) => {
    return (
      <React.Fragment>
        <div className='react-autoql-section-title-container'>
          <strong>{section.title}</strong>
          {section.action}
        </div>
        {section.emptyState ? (
          <div className='filter-locking-no-suggestions-text'>
            <em>No results</em>
          </div>
        ) : null}
      </React.Fragment>
    )
  }, [])

  const shouldRenderSuggestions = useCallback((value) => {
    // Always render suggestions if we have them, even when input is empty
    // This allows us to show slicerSuggestion results on focus
    return true
  }, [])

  const displayInputValue = props.value?.format_txt || inputValue

  return (
    <span className='react-autoql-vl-autocomplete-input-wrapper' style={{ position: 'relative' }}>
      <Icon type='filter' className='react-autoql-dashboard-slicer-icon' />
      <Autosuggest
        id='react-autoql-dashboard-slicer-input'
        className='react-autoql-vl-autocomplete-input'
        highlightFirstSuggestion
        suggestions={getSuggestions()}
        renderSuggestion={renderSuggestion}
        getSuggestionValue={getSuggestionValue}
        onSuggestionsFetchRequested={onSuggestionsFetchRequested}
        onSuggestionsClearRequested={onSuggestionsClearRequested}
        renderSuggestionsContainer={renderSuggestionsContainer}
        getSectionSuggestions={(section) => section.suggestions}
        renderSectionTitle={renderSectionTitle}
        shouldRenderSuggestions={shouldRenderSuggestions}
        multiSection={true}
        inputProps={{
          onChange: onInputChange,
          onFocus: onInputFocus,
          value: displayInputValue,
          placeholder: props.placeholder,
          className: 'react-autoql-vl-autocomplete-input',
          style: { paddingLeft: '35px' },
          ['data-test']: 'react-autoql-dashboard-slicer-input',
        }}
      />
    </span>
  )
}

DashboardSlicer.propTypes = {
  authentication: authenticationType,
  context: PropTypes.string,
  value: PropTypes.shape({}),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  dashboardId: PropTypes.string,
  slicerSuggestion: PropTypes.string,
}

DashboardSlicer.defaultProps = {
  authentication: authenticationDefault,
  context: undefined,
  value: null,
  onChange: () => {},
  placeholder: 'Select a slicer...',
  dashboardId: undefined,
  slicerSuggestion: undefined,
}

export default DashboardSlicer
