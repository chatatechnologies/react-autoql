import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Icon } from '../Icon'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './Menu.scss'

export class MenuItem extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
  }

  static propTypes = {
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    icon: PropTypes.string,
    active: PropTypes.bool,
    tooltip: PropTypes.string,
    tooltipID: PropTypes.string,
    onClick: PropTypes.func,
  }

  static defaultProps = {
    title: '',
    subtitle: undefined,
    icon: undefined,
    active: false,
    tooltip: undefined,
    tooltipID: undefined,
    onClick: () => {},
  }

  render = () => {
    return (
      <li
        id={`react-autoql-menu-item-${this.ID}`}
        key={`react-autoql-menu-item-${this.ID}`}
        className={`react-autoql-menu-item
          ${this.props.className ?? ''}
          ${this.props.active ? 'active' : ''}`}
        data-tip={this.props.tooltip}
        data-for={this.props.tooltipID}
        data-offset={10}
        onClick={(e) => {
          e.stopPropagation()
          this.props.onClick()
        }}
      >
        <span className='select-option-span'>
          <span className='select-option-value-container'>
            <span className='react-autoql-menu-item-title'>
              {!!this.props.icon && (
                <span className='react-autoql-menu-icon'>
                  <Icon type={this.props.icon} />
                  &nbsp;&nbsp;
                </span>
              )}
              <span>{this.props.title}</span>
            </span>
            {!!this.props.subtitle && <span className='select-option-value-subtitle'>{this.props.subtitle}</span>}
          </span>
        </span>
      </li>
    )
  }
}

export default class Menu extends React.Component {
  render = () => {
    return (
      <ErrorBoundary>
        <ul className={`react-autoql-menu ${this.props.className ?? ''}`} onClick={(e) => e.stopPropagation()}>
          {this.props.children}
        </ul>
      </ErrorBoundary>
    )
  }
}
