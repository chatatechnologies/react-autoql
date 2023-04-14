import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import { Icon } from '../Icon'
import { hideTooltips, rebuildTooltips, Tooltip } from '../Tooltip'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './Select.scss'

export default class Select extends React.Component {
  ID = uuid()

  static propTypes = {
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    popupClassname: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.oneOfType(PropTypes.element || PropTypes.string),
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

  state = {
    isOpen: false,
  }

  componentDidMount = () => {
    rebuildTooltips()
    this.scrollToValue()
  }

  componentDidUpdate = (nextProps, nextState) => {
    if (this.state.isOpen !== nextState.isOpen) {
      hideTooltips()
      rebuildTooltips()

      if (this.state.isOpen) {
        this.scrollToValue()
      }
    }

    if (this.props.value !== nextProps.value) {
      rebuildTooltips()
    }
  }

  scrollToValue = () => {
    const index = this.props.options?.findIndex((option) => this.props.value === option.value)
    const element = document.querySelector(`#select-option-${this.ID}-${index}`)
    if (element) {
      element.scrollIntoView()
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
          data-tip={this.props.tooltip}
          data-for={this.props.tooltipID}
          data-offset={10}
          data-delay-show={500}
        >
          <span className='react-autoql-select-text'>
            {selectedOption?.label || selectedOption?.value ? (
              <span className='react-autoql-select-option-value-label'>
                {!!selectedOption.icon && (
                  <span>
                    <Icon type={selectedOption.icon} />
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
      <div
        className={`react-autoql-select-popup-container
        ${this.props.popupClassname || ''}`}
        style={{ width: this.props.style.width }}
      >
        {!this.props.tooltipID && (
          <Tooltip id={`select-tooltip-${this.ID}`} className='react-autoql-tooltip' effect='solid' delayShow={500} />
        )}
        <ul className='react-autoql-select-popup'>
          {this.props.options.map((option, i) => {
            return (
              <li
                id={`select-option-${this.ID}-${i}`}
                key={`select-option-${this.ID}-${i}`}
                className={`react-autoql-select-option${option.value === this.props.value ? ' active' : ''}`}
                onClick={() => {
                  this.setState({ isOpen: false })
                  this.props.onChange(option.value)
                }}
                data-tip={option.tooltip || null}
                data-for={this.props.tooltipID ?? `select-tooltip-${this.ID}`}
                data-offset={10}
              >
                <span className='select-option-span'>
                  <span className='select-option-value-container'>
                    <span className='react-autoql-select-option-value-label'>
                      {!!option.icon && (
                        <span>
                          <Icon type={option.icon} />
                          &nbsp;&nbsp;
                        </span>
                      )}
                      <span>{option.listLabel ?? option.label ?? option.value}</span>
                    </span>
                    {!!option.subtitle && <span className='select-option-value-subtitle'>{option.subtitle}</span>}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
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
          containerClassName='react-tiny-popover-container react-autoql-select-popover-container'
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
