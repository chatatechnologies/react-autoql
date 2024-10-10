import React from 'react'
import PropTypes from 'prop-types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Switch.scss'

export default class Switch extends React.Component {
  static propTypes = {
    hasError: PropTypes.bool,
    checked: PropTypes.bool,
    onChange: PropTypes.func,
    onText: PropTypes.string,
    offText: PropTypes.string,
    disabled: PropTypes.bool,
    displayswitchtext: PropTypes.bool,
  }

  static defaultProps = {
    hasError: false,
    checked: false,
    onChange: () => {},
    onText: '',
    offText: '',
    disabled: false,
    displayswitchtext: true,
  }

  toggleChecked = () => {
    this.props.onChange(!this.props.checked)
  }
  spanStyle = {
    pointerEvents: this.props.disabled ? 'none' : 'auto',
  }
  render = () => {
    const { type, hasError, style, onChange, checked, offText, onText, ...nativeProps } = this.props
    const switchText = this.props.checked ? this.props.onText : this.props.offText

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-switch-container ${
            this.props.checked ? 'react-autoql-switch-container-checked' : 'react-autoql-switch-container-unchecked'
          } ${this.props.className}`}
          data-test='react-autoql-switch-container'
          style={this.props.style}
        >
          <span className='toggle-switch-text-ruler'> {this.props.displayswitchtext ? switchText : null} </span>
          <div className={`react-autoql-toggle-switch`}>
            <input
              {...nativeProps}
              type='checkbox'
              data-test='react-autoql-switch'
              ref={(el) => (this.selector = el)}
              checked={this.props.checked}
              disabled={this.props.disabled}
              onClick={(e) => e.stopPropagation()}
              onChange={this.toggleChecked}
            />
            <span style={this.spanStyle} className='toggle-switch-slider' onClick={this.toggleChecked}>
              <span className='toggle-switch-text'>{this.props.displayswitchtext ? switchText : null}</span>
            </span>
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
