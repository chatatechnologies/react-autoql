import React, { Fragment } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'

import './Input.scss'

export default class Input extends React.Component {
  static propTypes = {
    icon: PropTypes.string,
    type: PropTypes.string,
  }

  static defaultProps = {
    icon: undefined,
    type: 'single',
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
    if (this.inputRef) {
      this.inputRef.focus()
    }
  }

  render = () => {
    const { icon, className } = this.props
    const nativeProps = {
      ...this.props,
      icon: undefined,
    }

    return (
      <div
        className={`chata-input-container${
          this.state.focused ? ' focus' : ''
        } ${className} `}
        data-test="chata-input"
      >
        {this.props.type === 'multi' ? (
          <textarea
            {...nativeProps}
            ref={(r) => (this.inputRef = r)}
            className="chata-input area"
            onFocus={this.onFocus}
            onBlur={this.onBlur}
          />
        ) : (
          <Fragment>
            <input
              {...nativeProps}
              ref={(r) => (this.inputRef = r)}
              className={`chata-input ${icon ? 'with-icon' : ''}`}
              onFocus={this.onFocus}
              onBlur={this.onBlur}
            />
            {icon && (
              <Icon
                className={`chata-input-icon ${
                  this.state.focused ? ' focus' : ''
                }`}
                type={icon}
              />
            )}
          </Fragment>
        )}
      </div>
    )
  }
}
