import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'

import { Icon } from '../Icon'

import './Checkbox.scss'

export default class Checkbox extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    hasError: PropTypes.bool,
    indeterminate: PropTypes.bool,
    label: PropTypes.string,
    type: PropTypes.oneOf(['default', 'switch']),
    checked: PropTypes.bool,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    hasError: false,
    indeterminate: undefined,
    type: 'default',
    label: '',
    checked: false,
    onChange: () => {},
  }

  componentDidMount = () => {
    // Apply the indeterminate attribute of the checkbox input
    if (this.selector) {
      this.selector.indeterminate = this.props.indeterminate
    }
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.indeterminate !== this.props.indeterminate) {
      this.selector.indeterminate = this.props.indeterminate
    }
  }

  onCheckedChange = (e) => {
    this.props.onChange(e)
  }

  render = () => {
    const { label, type, indeterminate, hasError, ...inputProps } = this.props
    const nativeProps = { ...inputProps, style: undefined }

    const checkboxClassname = `
      react-autoql-checkbox
      ${type === 'switch' && 'react-autoql-checkbox--switch'}
      ${hasError && 'react-autoql-checkbox--has-error'}
    `

    const inputClassname = `
      react-autoql-checkbox__input
      ${type === 'switch' ? 'react-autoql-checkbox--switch__input' : ''}
      ${hasError ? 'react-autoql-checkbox--has-error__input' : ''}
    `

    const labelClassname = `
      react-autoql-checkbox__label
      ${type === 'switch' && 'react-autoql-checkbox--switch__label'}
    `

    return (
      <div
        className="react-autoql-checkbox-container"
        data-test="react-autoql-checkbox"
      >
        <div
          className={`${checkboxClassname} ${this.props.className}`}
          style={this.props.style}
        >
          <input
            {...nativeProps}
            type="checkbox"
            className={inputClassname}
            ref={(el) => (this.selector = el)}
            id={this.ID}
            checked={this.props.checked}
            onChange={this.onCheckedChange}
          />
          {this.props.checked && this.props.type === 'default' && (
            <div className="react-autoql-checkbox-tick">
              <Icon type="check" />
            </div>
          )}
          {label && (
            <div
              className="react-autoql-checkbox-label"
              onClick={(e) => {
                this.selector.click()
              }}
            >
              {label}
            </div>
          )}
        </div>
      </div>
    )
  }
}
