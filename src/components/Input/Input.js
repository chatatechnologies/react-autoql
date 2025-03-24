import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import dayjs from '../../js/dayjsWithPlugins'

import { Icon } from '../Icon'
import { Button } from '../Button'
import { Select } from '../Select'
import { Popover } from '../Popover'
import { DateRangePicker } from '../DateRangePicker'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Input.scss'

export default class Input extends React.Component {
  constructor(props) {
    super(props)

    this.INPUT_ID = uuid()

    this.state = {
      focused: props.focusOnMount,
      isDatePickerOpen: false,
      dateRange: undefined,
    }
  }

  static propTypes = {
    icon: PropTypes.string,
    type: PropTypes.string,
    step: PropTypes.string,
    size: PropTypes.oneOf(['small', 'large']),
    label: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    fullWidth: PropTypes.bool,
    datePicker: PropTypes.bool,
    displayColumnSelector: PropTypes.bool,
    focusOnMount: PropTypes.bool,
    showArrow: PropTypes.bool,
    showSpinWheel: PropTypes.bool,
    disabled: PropTypes.bool,
    errormessage: PropTypes.string,
    isRequired: PropTypes.bool,
  }

  static defaultProps = {
    icon: undefined,
    type: 'text',
    step: '1',
    size: 'large',
    label: '',
    selectLocation: 'left',
    fullWidth: false,
    displayColumnSelector: false,
    datePicker: false,
    focusOnMount: false,
    showArrow: undefined,
    showSpinWheel: false,
    disabled: false,
    errormessage: undefined,
    isRequired: false,
  }

  componentDidMount = () => {
    if (this.props.focusOnMount) {
      this.selectAll()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.state.focused && prevState.focused && !this.state.isDatePickerOpen) {
      this.props.onBlur?.()
    }
  }

  onFocus = (e) => {
    this.setState({ focused: true })
    this.props.onFocus?.(e)
  }

  onBlur = (e) => {
    if (!this.state.isDatePickerOpen) {
      this.setState({ focused: false })
    }
  }

  focus = () => {
    this.inputRef?.focus()
    this.setState({ focused: true })
  }

  selectAll = () => {
    if (this.inputRef) {
      this.inputRef.select?.()

      if (!this.inputRef.hasFocus?.()) {
        this.focus()
      }
    }
  }

  onSelectChange = (value) => {
    this.props.onSelectChange(value)
    this.focus()
  }
  onColumnSelectValueChange = (value) => {
    this.props.onColumnSelectValueChange(value)
    this.focus()
  }

  simulateOnChange = () => {
    this.inputRef?.dispatchEvent(new Event('change', { bubbles: true }))
  }

  incrementNumber = () => {
    this.inputRef?.stepUp()
    this.simulateOnChange()
  }

  decrementNumber = () => {
    this.inputRef?.stepDown()
    this.simulateOnChange()
  }

  onDateRangeSelection = (dateRange) => {
    this.setState({ dateRange })
  }

  onDateRangeApplyClick = () => {
    this.setState({ isDatePickerOpen: false }, () => {
      if (!this.state.dateRange || !this.inputRef) {
        return
      }

      const { startDate, endDate } = this.state.dateRange

      if (!startDate && !endDate) {
        return
      }

      let inputText = ''
      let start = startDate
      let end = endDate
      if (startDate && !endDate) {
        end = start
      } else if (!startDate && endDate) {
        start = end
      }

      const formattedStart = dayjs(start).format('ll')
      const formattedEnd = dayjs(end).format('ll')

      if (formattedStart === formattedEnd) {
        inputText = `on ${formattedStart}`
      } else {
        inputText = `between ${formattedStart} and ${formattedEnd}`
      }

      this.props.onDateRangeChange?.(this.state.dateRange, inputText)
    })
  }

  renderSpinWheel = () => {
    return (
      <div className='react-autoql-input-number-spin-button-container'>
        <button
          className='react-autoql-input-number-spin-button'
          onClick={this.incrementNumber}
          disabled={this.props.disabled}
        >
          <Icon type='caret-up' />
        </button>
        <button
          className='react-autoql-input-number-spin-button'
          onClick={this.decrementNumber}
          disabled={this.props.disabled}
        >
          <Icon type='caret-down' />
        </button>
      </div>
    )
  }

  renderSelectDropdown = () => {
    return (
      <Select
        showArrow={this.props.showArrow}
        className='react-autoql-text-input-selector'
        options={this.props.selectOptions}
        value={this.props.selectValue}
        onChange={this.onSelectChange}
      />
    )
  }
  renderColumnSelectDropdown = () => {
    return (
      <Select
        showArrow={this.props.showArrow}
        className='react-autoql-text-input-selector'
        options={this.props.columnSelectOptions}
        value={this.props.columnSelectValue}
        onChange={this.onColumnSelectValueChange}
      />
    )
  }

  renderDateRangePickerPopover = () => {
    if (!this.props.datePicker) {
      return null
    }

    return (
      <Popover
        isOpen={this.state.isDatePickerOpen}
        align='middle'
        positions={['top', 'bottom', 'right', 'left']}
        containerClassName='react-autoql-inline-input-date-picker-popover'
        onClickOutside={(e) => {
          this.setState({ isDatePickerOpen: false }, () => {
            this.focus()
          })
        }}
        content={
          <div className='react-autoql-popover-date-picker'>
            <DateRangePicker onSelection={this.onDateRangeSelection} initialRange={this.props.initialDateRange} />
            <Button type='primary' onClick={this.onDateRangeApplyClick}>
              Apply
            </Button>
          </div>
        }
      >
        <div className='react-autoql-inline-input-date-picker-btn'>
          <Icon
            className='react-autoql-inline-input-date-picker-btn-icon'
            type='calendar'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Pick a date range'
            onClick={(e) => {
              e.preventDefault()
              this.setState({ isDatePickerOpen: !this.state.isDatePickerOpen })
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
          />
        </div>
      </Popover>
    )
  }

  render = () => {
    const {
      icon,
      area,
      size,
      selectOptions,
      style,
      selectValue,
      onSelectChange,
      fullWidth,
      datePicker,
      onDateRangeChange,
      initialDateRange,
      focusOnMount,
      showSpinWheel,
      showArrow,
      selectLocation,
      disabled,
      displayColumnSelector,
      isRequired,
      ...nativeProps
    } = this.props

    const { className, type, label } = nativeProps

    const hasSelect = !!selectOptions?.length

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.wrapper = r)}
          className={`react-autoql-input-and-label-container
        ${className ?? ''}
        ${fullWidth ? 'react-autoql-input-full-width' : ''}`}
          style={style}
        >
          {!!label && <div className='react-autoql-input-label'>{`${label}${this.props.isRequired ? ' *' : ''}`}</div>}
          <div
            className={`react-autoql-input-container
            ${this.state.focused ? 'focus' : ''}
            ${hasSelect ? 'with-select' : ''}
            ${size === 'small' ? 'react-autoql-input-small' : 'react-autoql-input-large'}
            ${
              type === 'text' || type === 'number'
                ? 'react-autoql-input-number'
                : 'hidden'
                ? 'react-autoql-input-hidden'
                : ''
            }
            ${selectLocation === 'left' ? 'react-autoql-input-select-left' : 'react-autoql-input-select-right'}
            ${showSpinWheel ? 'react-autoql-input-number-spin-wheel' : ''}`}
            data-test='react-autoql-input'
          >
            {hasSelect && selectLocation === 'left' && this.renderSelectDropdown()}
            {!!area ? (
              <textarea
                {...nativeProps}
                ref={(r) => (this.inputRef = r)}
                className='react-autoql-input area'
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                style={this.props.inputStyle}
              />
            ) : (
              <div className={`react-autoql-input-and-icon ${this.props.datePicker ? 'with-date-picker' : ''}`}>
                <input
                  autoComplete='one-time-code'
                  {...nativeProps}
                  ref={(r) => (this.inputRef = r)}
                  className={`react-autoql-input
                ${icon ? 'with-icon' : ''}
                ${hasSelect ? 'with-select' : ''}`}
                  onFocus={this.onFocus}
                  onBlur={this.onBlur}
                  style={this.props.inputStyle}
                  disabled={disabled}
                />
                {icon && (
                  <Icon className={`react-autoql-input-icon ${this.state.focused ? ' focus' : ''}`} type={icon} />
                )}
                {this.props.errormessage && (
                  <span id='input-error' className='error-message'>
                    {this.props.errormessage}
                  </span>
                )}
                {this.props.datePicker ? this.renderDateRangePickerPopover() : null}
                {this.props.displayColumnSelector ? this.renderColumnSelectDropdown() : false}
              </div>
            )}
            {type === 'number' && this.props.showSpinWheel && this.renderSpinWheel()}
            {hasSelect && selectLocation === 'right' && this.renderSelectDropdown()}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
