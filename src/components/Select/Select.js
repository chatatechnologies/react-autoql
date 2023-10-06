import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../Popover'
import { v4 as uuid } from 'uuid'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { Menu, MenuItem } from '../Menu'

import './Select.scss'

export default class Select extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()

    this.state = {
      isOpen: false,
    }
  }

  static propTypes = {
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    popupClassname: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    size: PropTypes.string,
    showArrow: PropTypes.bool,
    outlined: PropTypes.bool,
    placeholder: PropTypes.string,
    fullWidth: PropTypes.bool,
  }

  static defaultProps = {
    onChange: () => {},
    options: [],
    popupClassname: null,
    value: null,
    label: null,
    size: 'large',
    style: {},
    showArrow: true,
    outlined: true,
    placeholder: 'Select an item',
    fullWidth: false,
  }

  componentDidMount = () => {
    this.scrollToValue()
  }

  componentDidUpdate = (nextProps, nextState) => {
    if (this.state.isOpen !== nextState.isOpen) {
      if (this.state.isOpen) {
        this.scrollToValue()
      }
    }
  }

  scrollToValue = () => {
    const index = this.props.options?.findIndex((option) => this.props.value === option.value)
    const element = document.querySelector(`#select-option-${this.ID}-${index}`)
    if (element) {
      element.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center',
      })
    }
  }

  renderSelect = () => {
    const selectedOption = this.props.options.find((option) => option.value === this.props.value)
    return (
      <div
        className={`react-autoql-select-and-label
        ${this.props.className ?? ''}
        ${this.props.fullWidth ? 'react-autoql-select-full-width' : ''}`}
      >
        {!!this.props.label && <div className='react-autoql-input-label'>{this.props.label}</div>}
        <div
          className={`react-autoql-select
          ${this.props.outlined ? 'outlined' : ''}
          ${this.props.size === 'small' ? 'react-autoql-select-small' : 'react-autoql-select-large'}`}
          data-test='react-autoql-select'
          onClick={() => this.setState({ isOpen: !this.state.isOpen })}
          style={this.props.style}
          data-tooltip-html={this.props.tooltip}
          data-tooltip-id={this.props.tooltipID}
          data-offset={10}
          data-tooltip-delay-show={500}
        >
          <span className='react-autoql-select-text'>
            {selectedOption?.label || selectedOption?.value ? (
              <span className='react-autoql-menu-item-value-title'>
                {!!selectedOption.icon && (
                  <span>
                    <Icon style={{ marginLeft: '-3px' }} type={selectedOption.icon} />
                    &nbsp;&nbsp;
                  </span>
                )}
                <span>{selectedOption.label ?? selectedOption.value}</span>
              </span>
            ) : (
              <span className='react-autoql-select-text-placeholder'>{this.props.placeholder}</span>
            )}
          </span>
          {this.props.showArrow && (
            <div className='react-autoql-select-arrow'>
              <Icon type='caret-down' />
            </div>
          )}
        </div>
      </div>
    )
  }

  renderPopoverContent = () => {
    return (
      <div className='react-autoql-select-popup-container' style={{ width: this.props.style.width }}>
        {!this.props.tooltipID && (
          <Tooltip id={`select-tooltip-${this.ID}`} className='react-autoql-tooltip' delayShow={500} />
        )}
        <Menu options={this.props.options}>
          {this.props.options?.map((option, i) => {
            return (
              <MenuItem
                id={`select-option-${this.ID}-${i}`}
                key={`select-menu-${option.value}-${i}`}
                title={option.listLabel ?? option.label ?? option.value}
                subtitle={option.subtitle}
                tooltip={option.tooltip}
                tooltipID={this.props.tooltipID ?? `select-tooltip-${this.ID}`}
                active={option.value === this.props.value}
                icon={option.icon}
                onClick={() => {
                  this.setState({ isOpen: false })
                  this.props.onChange(option.value)
                }}
              />
            )
          })}
        </Menu>
      </div>
    )
  }

  render = () => {
    if (!this.props.options) {
      return null
    }

    return (
      <ErrorBoundary>
        <Popover
          id={`select-popover-${this.ID}`}
          key={`select-popover-${this.ID}`}
          containerClassName={`react-tiny-popover-container react-autoql-select-popover-container ${
            this.props.popupClassname ?? ''
          }`}
          isOpen={this.state.isOpen}
          positions={this.props.positions ?? ['bottom', 'top', 'left', 'right']}
          align={this.props.align ?? 'start'}
          padding={0}
          parentElement={this.props.popoverParentElement}
          boundaryElement={this.props.popoverBoundaryElement}
          onClickOutside={() => this.setState({ isOpen: false })}
          content={this.renderPopoverContent()}
        >
          {this.renderSelect()}
        </Popover>
      </ErrorBoundary>
    )
  }
}
