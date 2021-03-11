import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _isEqual from 'lodash.isequal'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { setCSSVars } from '../../js/Util'
import { themeConfigType } from '../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../props/defaults'

import './Checkbox.scss'

export default class Checkbox extends React.Component {
  ID = uuid.v4()

  static propTypes = {
    themeConfig: themeConfigType,
    hasError: PropTypes.bool,
    indeterminate: PropTypes.bool,
    label: PropTypes.string,
    type: PropTypes.oneOf(['default', 'switch']),
    checked: PropTypes.bool,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
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

    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.indeterminate !== this.props.indeterminate) {
      this.selector.indeterminate = this.props.indeterminate
    }

    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  onCheckedChange = (e) => {
    this.props.onChange(e)
  }

  render = () => {
    const {
      label,
      type,
      indeterminate,
      hasError,
      style,
      themeConfig,
      onChange,
      checked,
      ...nativeProps
    } = this.props

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
      <ErrorBoundary>
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
      </ErrorBoundary>
    )
  }
}
