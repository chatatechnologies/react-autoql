import React, { useState, useRef, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { isMobile } from 'react-device-detect'

import AutocompleteInput from './AutocompleteInput'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './VLAutocompleteInputPopover.scss'

const AutocompleteInputPopover = ({
  // Core props
  value,
  onChange = () => { },
  onSearch = () => { },
  suggestions = [],
  isLoading = false,

  // UI props
  popupClassname = '',
  placeholder = 'Select...',
  popoverTitle,
  tooltipID,
  shouldRender = true,

  // Custom render props
  renderValue = (value) => value?.label || value?.name || placeholder,
  getTooltipContent = (value) => value?.description,

  // AutocompleteInput props
  autocompleteProps = {},
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState('')
  const popoverId = useRef(uuid())
  const autocompleteRef = useRef(null)

  useEffect(() => {
    if (isOpen && autocompleteRef.current?.selectAll) {
      autocompleteRef.current.selectAll()
    }
  }, [isOpen])

  useEffect(() => {
    if (!shouldRender && isOpen) {
      setIsOpen(false)
    }
  }, [shouldRender, isOpen])

  const onSelection = useCallback((selectedValue) => {
    onChange(selectedValue)
    setIsOpen(false)
  }, [onChange])

  const getContentLocation = useCallback((popoverState) => {
    const { childRect, popoverRect, boundaryRect } = popoverState

    if (!childRect.height || !childRect.width) {
      return {
        top: -1000,
        left: -1000,
      }
    }

    const POPOVER_MAX_HEIGHT = 150
    let newPosition
    let top
    let left

    // console.log('childRect.bottom', childRect.bottom)
    // console.log('POPOVER_MAX_HEIGHT', POPOVER_MAX_HEIGHT)
    // console.log('boundaryRect.bottom', boundaryRect.bottom)

    if (childRect.bottom + POPOVER_MAX_HEIGHT < boundaryRect.bottom) {
      top = childRect.bottom
      newPosition = 'bottom'
    } else {
      top = childRect.top - popoverRect.height
      newPosition = 'top'
    }

    if (childRect.left + popoverRect.width < boundaryRect.right) {
      left = childRect.left
    } else {
      left = boundaryRect.right - popoverRect.width
    }

    if (position !== newPosition) {
      const popoverContainerElement = document.querySelector(
        `.react-tiny-popover-container-${popoverId.current}`
      )

      if (popoverContainerElement) {
        popoverContainerElement.classList.remove('react-autoql-vlautocomplete-popover-container--top')
        popoverContainerElement.classList.remove('react-autoql-vlautocomplete-popover-container--bottom')
        popoverContainerElement.classList.add(
          `react-autoql-vlautocomplete-popover-container--${newPosition}`
        )

        setPosition(newPosition)
      }
    }

    return { left, top }
  }, [position])

  const renderAutocomplete = useCallback(() => {
    return (
      <div
        key={`popover-content-${popoverId.current}`}
        className="react-autoql-autocomplete-input-popup-container popover-container-content"
      >
        {popoverTitle ? (
          <div className="react-autoql-autocomplete-popover-title">
            {popoverTitle}
          </div>
        ) : null}
        <AutocompleteInput
          {...autocompleteProps}
          ref={autocompleteRef?.current}
          suggestions={suggestions}
          isLoading={isLoading}
          value={value}
          onSelect={onSelection}
          onSearch={onSearch}
          placeholder={placeholder}
          tooltipID={tooltipID}
        />
      </div>
    )
  }, [
    popoverTitle,
    suggestions,
    isLoading,
    value,
    onSelection,
    onSearch,
    placeholder,
    tooltipID,
    autocompleteProps,
  ])

  return (
    <ErrorBoundary>
      <Popover
        id={`autcomplete-input-popover-${popoverId.current}`}
        key={`autcomplete-input-popover-${popoverId.current}`}
        containerClassName={`react-tiny-popover-container react-autoql-autocomplete-input-popover-container 
          react-autoql-vlautocomplete-popover-container--bottom react-autoql-popover${isMobile ? '-mobile' : ''
          } ${popupClassname} react-tiny-popover-container-${popoverId.current}`}
        padding={0}
        isOpen={isOpen}
        onClickOutside={() => setIsOpen(false)}
        content={renderAutocomplete()}
        reposition={false}
        contentLocation={getContentLocation}
      >
        <div
          className={`autcomplete-input-popover-btn ${isOpen ? 'autcomplete-input-popover-btn-active' : ''
            }`}
          onClick={() => setIsOpen(true)}
          data-tooltip-content={getTooltipContent(value)}
          data-tooltip-id={tooltipID}
          data-tooltip-delay-show={500}
        >
          {renderValue(value)}
        </div>
      </Popover>
    </ErrorBoundary>
  )
}

AutocompleteInputPopover.propTypes = {
  // Core props
  value: PropTypes.any,
  onChange: PropTypes.func,
  onSearch: PropTypes.func,
  suggestions: PropTypes.array,
  isLoading: PropTypes.bool,

  // UI props
  popupClassname: PropTypes.string,
  placeholder: PropTypes.string,
  popoverTitle: PropTypes.node,
  tooltipID: PropTypes.string,
  shouldRender: PropTypes.bool,

  // Custom render props
  renderValue: PropTypes.func,
  getTooltipContent: PropTypes.func,

  // AutocompleteInput props
  autocompleteProps: PropTypes.object,
}

export default AutocompleteInputPopover