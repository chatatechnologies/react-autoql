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
    console.log('ON CHECKED CHANGE IN CHECKBOX')
    this.props.onChange(e)
  }

  render = () => {
    const { label, type, indeterminate, hasError, ...inputProps } = this.props
    const nativeProps = { ...inputProps, style: undefined }

    const checkboxClassname = `
      chata-checkbox
      ${type === 'switch' && 'chata-checkbox--switch'}
      ${hasError && 'chata-checkbox--has-error'}
    `

    const inputClassname = `
      chata-checkbox__input
      ${type === 'switch' ? 'chata-checkbox--switch__input' : ''}
      ${hasError ? 'chata-checkbox--has-error__input' : ''}
    `

    const labelClassname = `
      chata-checkbox__label
      ${type === 'switch' && 'chata-checkbox--switch__label'}
    `

    return (
      <div className="chata-checkbox-container" data-test="chata-checkbox">
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
            <div className="chata-checkbox-tick">
              <Icon type="check" />
            </div>
          )}
          {label && (
            <div
              className="chata-checkbox-label"
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
