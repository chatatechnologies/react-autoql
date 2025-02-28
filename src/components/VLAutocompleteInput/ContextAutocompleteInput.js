import React, { useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import AutocompleteInputPopover from './AutocompleteInputPopover'
import './VLAutocompleteInputPopover.scss'

const ContextAutocompleteInput = ({
  filters = [],
  onToast,
  primaryContext,
  suggestions = [],
  value,
  onChange = () => { },
  placeholder = 'Select a filter',
  tooltipID = 'filter-locking-tooltip',
  popupClassname = '',
  popoverTitle = '',
  shouldRender = true,
}) => {
  const findExistingFilter = useCallback(({ filterText, value, key }) => {
    if (!filters?.length) return

    if (value && key) {
      return filters.find((filter) => filter.key === key && filter.value === value)
    } else if (filterText) {
      return filters.find((filter) => filter.value === filterText)
    }
  }, [filters])

  const handleHighlightFilter = useCallback((filter) => {
    onToast?.('This filter has already been applied.')
  }, [onToast])

  const handleSelect = useCallback((suggestion) => {

    const newFilter = {
      value: suggestion.value,
      format_txt: suggestion.label,
      show_message: suggestion.description,
      key: suggestion.canonical,
      filter_type: 'include',
    }

    const existingFilter = findExistingFilter({
      value: newFilter.value,
      key: newFilter.key
    })

    if (existingFilter) {
      handleHighlightFilter(existingFilter)
    } else {
      console.log('newFilter', newFilter)
      onChange(newFilter)
    }
  }, [onChange, findExistingFilter, handleHighlightFilter])

  // Custom rendering functions for AutocompleteInput
  const renderSuggestion = useCallback((suggestion) => {
    return (
      <span
        className="filter-lock-suggestion-item"
        data-tooltip-id={tooltipID}
        data-tooltip-delay-show={1000}
        data-tooltip-html={`<strong>${suggestion.label}</strong> <em>${suggestion.description}</em>`}
      >
        <strong>{suggestion.label}</strong>
        {suggestion.description && (
          <em>{` (${suggestion.description})`}</em>
        )}
      </span>
    )
  }, [tooltipID])

  const filterSuggestions = useCallback((suggestions, inputValue) => {
    const inputValueLower = inputValue.toLowerCase()
    return suggestions.filter(suggestion =>
      suggestion.label.toLowerCase().includes(inputValueLower) ||
      suggestion.description?.toLowerCase().includes(inputValueLower)
    )
  }, [])

  // const sortSuggestions = useCallback((suggestions) => {
  //   return [...suggestions].sort((a, b) => {
  //     if (a.originalMatch?.context == value) {
  //       return -1
  //     }
  //     const aText = a.description
  //     const bText = b.description
  //     return aText.toUpperCase() < bText.toUpperCase() ? -1 : aText > bText ? 1 : 0
  //   })
  // }, [])

  const sortSuggestions = useCallback((suggestions) => {
    return [...suggestions].sort((a, b) => {
      const aIsMatch = a.originalMatch?.context === primaryContext?.context
      const bIsMatch = b.originalMatch?.context === primaryContext?.context

      if (aIsMatch && !bIsMatch) return -1;
      if (!aIsMatch && bIsMatch) return 1;

      return a.description.localeCompare(b.description, undefined, { sensitivity: 'base' })
    });
  }, [value]);

  // Custom rendering functions for Popover
  const renderValue = useCallback((value) => {
    return value?.format_txt ?? placeholder
  }, [placeholder])

  const getTooltipContent = useCallback((value) => {
    return value?.show_message
  }, [])

  // AutocompleteInput specific props
  const autocompleteProps = {
    renderSuggestion,
    filterSuggestions,
    sortSuggestions,
    maxSuggestions: 100,
    debounceMs: 100,
    getSuggestionValue: (suggestion) => suggestion,
    alwaysRenderSuggestions: true,
    inputClassName: "react-autoql-vl-autocomplete-input",
    multiSection: true,
    renderSectionTitle: (section) => (
      <>
        <strong>{section.title}</strong>
        {section.suggestions.length === 0 && (
          <div className="filter-locking-no-suggestions-text">
            <em>No results</em>
          </div>
        )}
      </>
    )
  }

  return (
    <AutocompleteInputPopover
      value={value}
      onChange={handleSelect}
      suggestions={suggestions}
      placeholder={placeholder}
      tooltipID={tooltipID}
      popupClassname={popupClassname}
      popoverTitle={popoverTitle}
      shouldRender={shouldRender}
      renderValue={renderValue}
      getTooltipContent={getTooltipContent}
      autocompleteProps={autocompleteProps}
    />
  )
}

ContextAutocompleteInput.propTypes = {
  // VL specific props
  primaryContext: PropTypes.string,
  filters: PropTypes.array,
  onToast: PropTypes.func,
  suggestions: PropTypes.array,

  // Core props
  value: PropTypes.shape({
    value: PropTypes.string,
    format_txt: PropTypes.string,
    show_message: PropTypes.string,
    key: PropTypes.string,
    filter_type: PropTypes.string,
  }),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  tooltipID: PropTypes.string,
  popupClassname: PropTypes.string,
  popoverTitle: PropTypes.node,
  shouldRender: PropTypes.bool,
}

export default ContextAutocompleteInput