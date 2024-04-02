import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './MultilineButton.scss'

export class MultlineButtonWithoutRef extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    tooltip: PropTypes.string,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    title: PropTypes.string,
    subtitle: PropTypes.string,
    radio: PropTypes.boolean,
    onClick: PropTypes.func,
  }

  static defaultProps = {
    disabled: false,
    tooltip: undefined,
    icon: undefined,
    title: '',
    subtitle: '',
    radio: false,
    onClick: () => {},
  }

  renderRadioBtn = () => {
    return (
      <div className='react-autoql-multiline-radio-btn-container'>
        <div className='react-autoql-multiline-radio-btn' />
      </div>
    )
  }

  renderIcon = () => {
    if (!this.props.icon) {
      return null
    }

    let icon = this.props.icon

    console.log('typeof icon:', typeof this.props.icon, this.props.icon)

    if (typeof this.props.icon === 'string') {
      icon = <Icon className='react-autoql-btn-icon' type={this.props.icon} />
    }

    return <div className='react-autoql-btn-icon-container'>{icon}</div>
  }

  render = () => {
    const isDisabled = this.props.loading || this.props.disabled

    return (
      <ErrorBoundary>
        <button
          ref={this.props.innerRef}
          className={`react-autoql-multiline-btn
            ${this.props.className || ''}
            ${isDisabled ? 'react-autoql-multiline-btn-disabled' : ''}
            ${this.props.isActive ? 'react-autoql-multiline-btn-active' : ''}`}
          data-test='react-autoql-multiline-btn'
          style={{ ...this.props.style }}
          onClick={this.props.onClick}
          data-tooltip-html={this.props.tooltip}
          data-tooltip-id={this.props.tooltipID}
        >
          {this.renderRadioBtn()}
          <div>
            <div className='react-autoql-multiline-btn-title'>
              {this.renderIcon()}
              {this.props.title}
            </div>
            <div className='react-autoql-multiline-btn-subtitle'>{this.props.subtitle}</div>
          </div>
        </button>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <MultlineButtonWithoutRef innerRef={ref} {...props} />)
