import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from '../Popover'
import { v4 as uuid } from 'uuid'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { Menu, MenuItem } from '../Menu'

import './MultiSelect.scss'
import { Checkbox } from '../Checkbox'

export default class MultiSelect extends React.Component {
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
    selected: PropTypes.arrayOf(PropTypes.string),
    label: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    title: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    size: PropTypes.string,
    showArrow: PropTypes.bool,
    outlined: PropTypes.bool,
    placeholder: PropTypes.string,
    fullWidth: PropTypes.bool,
    showBadge: PropTypes.bool,
  }

  static defaultProps = {
    onChange: () => {},
    options: [],
    popupClassname: null,
    selected: [],
    label: null,
    size: 'large',
    style: {},
    showArrow: true,
    outlined: true,
    placeholder: 'Select an item',
    fullWidth: false,
    showBadge: true,
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
    const index = this.props.options?.findIndex((option) => this.props.selected === option.value)
    const element = document.querySelector(`#select-option-${this.ID}-${index}`)
    if (element) {
      element.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center',
      })
    }
  }

  onItemClick = (option) => {
    let selected = []

    if (this.props.selected?.includes(option.value)) {
      selected = this.props.selected.filter((value) => value !== option.value)
    } else {
      selected = [...this.props.selected, option.value]
    }

    this.props.onChange(selected)
  }

  renderSelect = () => {
    return (
      <div
        className={`react-autoql-select-and-label
        ${this.props.className ?? ''}
        ${this.props.fullWidth ? 'react-autoql-select-full-width' : ''}`}
      >
        {!!this.props.label && <div className='react-autoql-input-label'>{this.props.label}</div>}
        <div
          className={`react-autoql-select react-autoql-multi-select
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
          <div className='react-autoql-multi-select-text'>
            <span>{this.props.title}</span>
          </div>
          {this.props.showBadge && this.props.selected?.length ? (
            <div className='react-autoql-multi-select-badge'>{this.props.selected?.length}</div>
          ) : null}
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
        {this.props.listTitle ? (
          <div className='react-autoql-multi-select-list-title'>{this.props.listTitle}</div>
        ) : null}
        <Menu options={this.props.options}>
          {this.props.options?.map((option, i) => {
            return (
              <div
                key={`${option.value}-${i}`}
                className={`react-autoql-multi-select-item-wrapper${
                  this.props.selected.includes(option.value) ? ' react-autoql-multi-select-selected' : ''
                }`}
                onClick={() => this.onItemClick(option)}
              >
                <Checkbox
                  className='react-autoql-multi-select-item-checkbox'
                  checked={this.props.selected.includes(option.value)}
                />
                <div
                  className='react-autoql-multi-select-menu-item'
                  data-tooltip-id={this.props.tooltipID ?? `select-tooltip-${this.ID}`}
                  data-tooltip-html={option.tooltip}
                >
                  {option.label ?? option.value}
                </div>
                {/* <MenuItem
                  id={`select-option-${this.ID}-${i}`}
                  className='react-autoql-multi-select-menu-item'
                  key={option.value}
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
                /> */}
              </div>
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
