import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { isMobile } from 'react-device-detect'

import VLAutocompleteInput from './VLAutocompleteInput'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './VLAutocompleteInputPopover.scss'

export default class VLAutocompleteInputPopover extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
    this.position = undefined

    this.state = {
      isOpen: false,
      position: undefined,
    }
  }

  static propTypes = {
    onChange: PropTypes.func,
    popupClassname: PropTypes.string,
    autocompleteProps: PropTypes.shape({}),
  }

  static defaultProps = {
    onChange: () => {},
    popupClassname: null,
    autocompleteProps: {},
  }

  componentDidMount = () => {}

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.isOpen && !prevState.isOpen) {
      this.autocompleteInput?.selectAll?.()
    }
  }

  onVLSelection = (vl) => {
    this.props.onChange(vl)
    this.setState({ isOpen: false })
  }

  getContentLocation = (popoverState) => {
    const { childRect, popoverRect, boundaryRect } = popoverState

    const POPOVER_MAX_HEIGHT = 150

    let position
    let top
    let left

    if (childRect.bottom + POPOVER_MAX_HEIGHT < boundaryRect.bottom) {
      // Case "Bottom" (preferred)
      top = childRect.bottom
      position = 'bottom'
    } else {
      // Case "Top"
      top = childRect.top - popoverRect.height
      position = 'top'
    }

    if (childRect.left + popoverRect.width < boundaryRect.right) {
      // Case "Left position is good"
      left = childRect.left
    } else {
      // Case "Nudged left"
      left = boundaryRect.right - popoverRect.width
    }

    if (this.position !== position) {
      const popoverContainerElement = document.querySelector(`.react-tiny-popover-container-${this.ID}`)

      if (popoverContainerElement) {
        popoverContainerElement.classList.remove('react-autoql-vlautocomplete-popover-container--top')
        popoverContainerElement.classList.remove('react-autoql-vlautocomplete-popover-container--bottom')
        popoverContainerElement.classList.add(`react-autoql-vlautocomplete-popover-container--${position}`)

        this.position = position
      }
    }

    return { left, top }
  }

  renderAutocomplete = () => {
    return (
      <div
        key={`popover-content-${this.ID}`}
        className='react-autoql-autocomplete-input-popup-container popover-container-content'
      >
        {this.props.popoverTitle ? (
          <div className='react-autoql-autocomplete-popover-title'>{this.props.popoverTitle}</div>
        ) : null}
        <VLAutocompleteInput
          authentication={this.props.authentication}
          placeholder={this.props.placeholder}
          value={this.props.value}
          ref={(r) => (this.autocompleteInput = r)}
          onChange={this.onVLSelection}
          tooltipID={this.props.tooltipID}
          context={this.props.context}
        />
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Popover
          id={`autcomplete-input-popover-${this.ID}`}
          key={`autcomplete-input-popover-${this.ID}`}
          containerClassName={`react-tiny-popover-container react-autoql-autocomplete-input-popover-container react-autoql-vlautocomplete-popover-container--bottom react-autoql-popover${
            isMobile ? '-mobile' : ''
          } ${this.props.popupClassname ?? ''} react-tiny-popover-container-${this.ID}`}
          padding={0}
          isOpen={this.state.isOpen}
          onClickOutside={() => this.setState({ isOpen: false })}
          content={this.renderAutocomplete()}
          reposition={false}
          contentLocation={this.getContentLocation}
        >
          <div
            className={`autcomplete-input-popover-btn ${
              this.state.isOpen ? 'autcomplete-input-popover-btn-active' : ''
            }`}
            onClick={() => this.setState({ isOpen: true })}
          >
            {this.props.value?.format_txt ?? this.props.placeholder}
          </div>
        </Popover>
      </ErrorBoundary>
    )
  }
}
