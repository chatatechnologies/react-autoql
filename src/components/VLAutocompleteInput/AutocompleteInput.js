import React, { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import Autosuggest from 'react-autosuggest'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './VLAutocompleteInputPopover.scss'


const AutocompleteInput = ({
  // Core props
  onSearch = () => { },
  onSelect = () => { },
  suggestions = [],
  isLoading = false,

  // Customization props
  getSuggestionValue = (suggestion) => suggestion.value || suggestion.name || suggestion,
  renderSuggestion = (suggestion) => suggestion.label || suggestion.name || suggestion,
  getDisplayValue = (item) => item.label || item.name || item,
  filterSuggestions = (suggestions, inputValue) => {
    const inputValueLower = inputValue.toLowerCase()
    return suggestions.filter(suggestion =>
      getDisplayValue(suggestion).toLowerCase().includes(inputValueLower)
    )
  },
  sortSuggestions = (suggestions) => suggestions,

  // UI props
  placeholder = 'Search...',
  maxSuggestions = 10,
  tooltipID,
  tooltipDelay = 1000,
  disabled = false,
  highlightFirstSuggestion = true,
  alwaysRenderSuggestions = false,
  inputClassName = '',

  // Behavior props
  debounceMs = 300,
  minInputLength = 0,

  // Section props
  multiSection = false,
  renderSectionTitle = (section) => section.emptyState ? <em>No results</em> : section.title,
  getSectionSuggestions = (section) => section.suggestions,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [currentSuggestions, setCurrentSuggestions] = useState([])
  const inputElement = useRef(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current)
      }
    }
  }, [])

  const selectAll = () => {
    inputElement?.current?.select?.()
  }

  const onInputFocus = () => {
    selectAll()
    onSearch()
  }

  const handleSearch = useCallback((value) => {
    if (value.length >= minInputLength) {
      onSearch(value)
    }
  }, [onSearch, minInputLength])

  const debouncedSearch = useCallback((value) => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current)
    }

    searchTimer.current = setTimeout(() => {
      handleSearch(value)
    }, debounceMs)
  }, [handleSearch, debounceMs])

  useEffect(() => {
    let processedSuggestions = suggestions

    if (inputValue.length >= minInputLength) {
      processedSuggestions = filterSuggestions(suggestions, inputValue)
      processedSuggestions = sortSuggestions(processedSuggestions)
      processedSuggestions = processedSuggestions.slice(0, maxSuggestions)
    }

    if (multiSection) {
      setCurrentSuggestions([{
        title: inputValue ? `Results for "${inputValue}"` : '',
        suggestions: processedSuggestions,
      }])
    } else {
      setCurrentSuggestions(processedSuggestions)
    }
  }, [suggestions, inputValue, filterSuggestions, sortSuggestions, maxSuggestions, multiSection, minInputLength])

  const onInputChange = useCallback((event, { newValue, method }) => {
    if (method === 'up' || method === 'down') {
      return
    }

    setInputValue(newValue)

    if (method === 'type') {
      debouncedSearch(newValue)
    }
  }, [debouncedSearch])

  const onSuggestionSelected = useCallback((event, { suggestion }) => {
    onSelect(suggestion)
    setInputValue('')
  }, [onSelect])

  const renderSuggestionContainer = useCallback(({ containerProps, children }) => {
    return (
      <div {...containerProps} style={{ maxHeight: '150px', overflow: 'auto' }}>
        {children}
      </div>
    )
  }, [])

  const renderSuggestionComponent = useCallback((suggestion) => {
    const content = renderSuggestion(suggestion)
    const display = getDisplayValue(suggestion)

    return (
      <div
        data-tooltip-id={tooltipID}
        data-tooltip-delay-show={tooltipDelay}
        data-tooltip-html={display}
      >
        {content}
      </div>
    )
  }, [renderSuggestion, getDisplayValue, tooltipID, tooltipDelay])

  return (
    <ErrorBoundary>
      <span className='react-autoql-vl-autocomplete-input-wrapper'>
        <Autosuggest
          id='react-autoql-filter-menu-input'
          suggestions={multiSection ? currentSuggestions : currentSuggestions}
          onSuggestionsFetchRequested={() => { }}
          onSuggestionsClearRequested={() => { }}
          getSuggestionValue={getSuggestionValue}
          renderSuggestion={renderSuggestionComponent}
          renderSuggestionsContainer={renderSuggestionContainer}
          onSuggestionSelected={onSuggestionSelected}
          highlightFirstSuggestion={highlightFirstSuggestion}
          alwaysRenderSuggestions={alwaysRenderSuggestions}
          multiSection={multiSection}
          renderSectionTitle={renderSectionTitle}
          getSectionSuggestions={getSectionSuggestions}
          inputProps={{
            ref: inputElement,
            value: inputValue,
            onChange: onInputChange,
            disabled: disabled,
            placeholder,
            className: `${inputClassName}`,
            id: 'react-autoql-filter-menu-input',
            onFocus: onInputFocus,
          }}
        />
        {/* {isLoading && (
          <div className="loading-indicator">
            Loading...
          </div>
        )} */}
      </span>
    </ErrorBoundary>
  )
}

AutocompleteInput.propTypes = {
  // Core props
  onSearch: PropTypes.func,
  onSelect: PropTypes.func,
  suggestions: PropTypes.array,
  isLoading: PropTypes.bool,

  // Customization props
  getSuggestionValue: PropTypes.func,
  renderSuggestion: PropTypes.func,
  getDisplayValue: PropTypes.func,
  filterSuggestions: PropTypes.func,
  sortSuggestions: PropTypes.func,

  // UI props
  placeholder: PropTypes.string,
  maxSuggestions: PropTypes.number,
  tooltipID: PropTypes.string,
  tooltipDelay: PropTypes.number,
  disabled: PropTypes.bool,
  highlightFirstSuggestion: PropTypes.bool,
  alwaysRenderSuggestions: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,

  // Behavior props
  debounceMs: PropTypes.number,
  minInputLength: PropTypes.number,

  // Section props
  multiSection: PropTypes.bool,
  renderSectionTitle: PropTypes.func,
  getSectionSuggestions: PropTypes.func,
}

export default AutocompleteInput