import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'

import { Icon } from '../Icon'
import { v4 as uuid } from 'uuid'
import { Popover } from '../Popover'
import { Tooltip } from '../Tooltip'
import { Menu, MenuItem } from '../Menu'
import { LoadingDots } from '../LoadingDots'
import { CustomScrollbars } from '../CustomScrollbars'
import { ErrorBoundary } from '../../containers/ErrorHOC'

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
    placeholder: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    fullWidth: PropTypes.bool,
    color: PropTypes.oneOf(['primary', 'text']),
    isDisabled: PropTypes.bool,
    isRequired: PropTypes.bool,
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
    color: 'primary',
    isDisabled: false,
    isRequired: false,
  }

  componentDidMount = () => {
    this.scrollToValue()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.isOpen !== prevState.isOpen || !_isEqual(this.props.options, prevProps.options)) {
      if (this.state.isOpen) {
        this.scrollToValue()
      }
    }
  }

  scrollToValue = () => {
    this.scrollbars?.update()

    let index = this.props.options?.findIndex((option) => this.props.value === option.value)
    if (index === -1) {
      index = 0
    }

    const element = document.querySelector(`#select-option-${this.ID}-${index}`)

    if (element) {
      element.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center',
      })
    } else {
      this.popoverContent?.scrollIntoView?.()
    }
  }

  renderSelect = () => {
    const selectedOption = this.props.options.find((option) => option.value === this.props.value)
    return (
      <div
        className={`react-autoql-select-and-label
        ${this.props.className ?? ''}
        ${this.props.isDisabled ? '' : this.props.outlined ? 'outlined disabled' : 'underlined'}
        ${this.props.fullWidth ? 'react-autoql-select-full-width' : ''}`}
      >
        {!!this.props.label && (
          <div
            className={`react-autoql-input-label
         ${this.props.isDisabled ? 'disabled' : ''}`}
          >
            {`${this.props.label}${this.props.isRequired ? ' *' : ''}`}
          </div>
        )}
        <div
          className={`
            ${this.props.isDisabled ? (this.props.outlined ? 'react-autoql-select' : '') : 'react-autoql-select'}
            ${
              this.props.isDisabled
                ? this.props.outlined
                  ? 'outlined disabled'
                  : ''
                : this.props.outlined
                ? 'outlined'
                : 'underlined'
            }
            ${this.props.size === 'small' ? 'react-autoql-select-small' : 'react-autoql-select-large'}
            ${this.props.color === 'text' ? 'text-color' : ''}`}
          data-test='react-autoql-select'
          onClick={() => {
            if (!this.props.isDisabled) this.setState({ isOpen: !this.state.isOpen })
          }}
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
                    <Icon style={{ marginLeft: this.props.outlined ? '-1px' : '0px' }} type={selectedOption.icon} />
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
            <div className={`react-autoql-select-arrow ${this.props.color === 'text' ? 'text-color' : ''}`}>
              {this.state.isOpen ? <Icon type='caret-up' /> : <Icon type='caret-down' />}
            </div>
          )}
        </div>
      </div>
    )
  }

  renderPopoverContent = () => {
    return (
      <div
        ref={(r) => (this.popoverContent = r)}
        className='react-autoql-select-popup-container'
        style={{ width: this.props.style.width }}
      >
        {!this.props.tooltipID && <Tooltip tooltipId={`select-tooltip-${this.ID}`} delayShow={500} />}
        {this.props.options?.length ? (
          <CustomScrollbars
            ref={(r) => (this.scrollbars = r)}
            autoHide={false}
            contentHidden={!this.state.isOpen}
            maxHeight='100%'
          >
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
                    disabled={option.disabled}
                    icon={option.icon}
                    onClick={() => {
                      this.setState({ isOpen: false })
                      this.props.onChange(option.value)
                    }}
                  />
                )
              })}
            </Menu>
          </CustomScrollbars>
        ) : (
          <LoadingDots />
        )}
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
          containerClassName={`react-tiny-popover-container react-autoql-select-popover-container
            ${this.props.popupClassname ?? ''}
            ${this.props.outlined ? '' : 'react-autoql-select-popover-no-margin'}`}
          isOpen={this.state.isOpen}
          positions={this.props.positions ?? ['bottom', 'top', 'left', 'right']}
          align={this.props.align ?? 'start'}
          padding={0}
          parentElement={this.props.popoverParentElement}
          boundaryElement={this.props.popoverBoundaryElement}
          onClickOutside={() => this.setState({ isOpen: false })}
          content={this.renderPopoverContent()}
          containerStyle={{ maxHeight: '100%' }}
        >
          {this.renderSelect()}
        </Popover>
      </ErrorBoundary>
    )
  }
}
