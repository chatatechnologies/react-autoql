import React, { Fragment } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Input.scss'
import { Select } from '../Select'

export default class Input extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      focused: false,
    }
  }

  static propTypes = {
    icon: PropTypes.string,
    type: PropTypes.string,
    step: PropTypes.string,
    size: PropTypes.oneOf(['small', 'large']),
    label: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    fullWidth: PropTypes.bool,
  }

  static defaultProps = {
    icon: undefined,
    type: 'text',
    step: '1',
    size: 'large',
    label: '',
    fullWidth: false,
  }

  onFocus = () => {
    this.setState({ focused: true })
    if (this.props.onFocus) {
      this.props.onFocus()
    }
  }

  onBlur = () => {
    this.setState({ focused: false })
    if (this.props.onBlur) {
      this.props.onBlur()
    }
  }

  focus = () => {
    this.inputRef?.focus()
  }

  onSelectChange = (value) => {
    this.props.onSelectChange(value)
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

  renderSpinWheel = () => {
    return (
      <div className='react-autoql-input-number-spin-button-container'>
        <button className='react-autoql-input-number-spin-button' onClick={this.incrementNumber}>
          <Icon type='caret-up' />
        </button>
        <button className='react-autoql-input-number-spin-button' onClick={this.decrementNumber}>
          <Icon type='caret-down' />
        </button>
      </div>
    )
  }

  renderSelectDropdown = () => {
    return (
      <Select
        className='react-autoql-text-input-selector'
        options={this.props.selectOptions}
        value={this.props.selectValue}
        onChange={this.onSelectChange}
      />
    )
  }

  render = () => {
    const { icon, area, size, selectOptions, style, selectValue, onSelectChange, fullWidth, ...nativeProps } =
      this.props
    const { className, type, label } = nativeProps

    const hasSelect = !!selectOptions?.length

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-input-and-label-container
        ${className ?? ''}
        ${fullWidth ? 'react-autoql-input-full-width' : ''}`}
          style={style}
        >
          {!!label && <div className='react-autoql-input-label'>{label}</div>}
          <div
            className={`react-autoql-input-container
            ${this.state.focused ? 'focus' : ''}
            ${hasSelect ? 'with-select' : ''}
            ${size === 'small' ? 'react-autoql-input-small' : 'react-autoql-input-large'}
            ${type === 'number' ? 'react-autoql-input-number' : ''}`}
            data-test='react-autoql-input'
          >
            {hasSelect && this.renderSelectDropdown()}
            {!!area ? (
              <textarea
                {...nativeProps}
                ref={(r) => (this.inputRef = r)}
                className='react-autoql-input area'
                onFocus={this.onFocus}
                onBlur={this.onBlur}
              />
            ) : (
              <div className='react-autoql-input-and-icon'>
                <input
                  autoComplete='off'
                  {...nativeProps}
                  ref={(r) => (this.inputRef = r)}
                  className={`react-autoql-input
                ${icon ? 'with-icon' : ''}
                ${hasSelect ? 'with-select' : ''}`}
                  onFocus={this.onFocus}
                  onBlur={this.onBlur}
                />
                {icon && (
                  <Icon className={`react-autoql-input-icon ${this.state.focused ? ' focus' : ''}`} type={icon} />
                )}
              </div>
            )}
            {type === 'number' && this.renderSpinWheel()}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
