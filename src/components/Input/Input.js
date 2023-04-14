import React, { Fragment } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Input.scss'
import { Select } from '../Select'

export default class Input extends React.Component {
  static propTypes = {
    icon: PropTypes.string,
    type: PropTypes.string,
    size: PropTypes.oneOf(['small', 'large']),
    label: PropTypes.oneOfType(PropTypes.element || PropTypes.string),
    fullWidth: PropTypes.bool,
  }

  static defaultProps = {
    icon: undefined,
    type: 'single',
    size: 'large',
    label: '',
    fullWidth: false,
  }

  state = {
    focused: false,
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

  render = () => {
    const { icon, area, size, selectOptions, style, selectValue, onSelectChange, ...nativeProps } = this.props
    const { className } = nativeProps

    const hasSelect = !!this.props.selectOptions?.length

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-input-and-label-container
        ${className ?? ''}
        ${this.props.fullWidth ? 'react-autoql-input-full-width' : ''}`}
          style={style}
        >
          {!!this.props.label && <div className='react-autoql-input-label'>{this.props.label}</div>}
          <div
            className={`react-autoql-input-container
            ${this.state.focused ? 'focus' : ''}
            ${hasSelect ? 'with-select' : ''}
            ${this.props.size === 'small' ? 'react-autoql-input-small' : 'react-autoql-input-large'}`}
            data-test='react-autoql-input'
          >
            {hasSelect && (
              <Select
                className='react-autoql-text-input-selector'
                options={selectOptions}
                value={selectValue}
                onChange={this.onSelectChange}
              />
            )}
            {!!this.props.area ? (
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
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
