import React from 'react'
import PropTypes from 'prop-types'
import { Popover } from 'react-tiny-popover'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import ReactTooltip from 'react-tooltip'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Select.scss'

export default class Select extends React.Component {
  ID = uuid()

  static propTypes = {
    onChange: PropTypes.func,
    options: PropTypes.arrayOf(PropTypes.shape({})),
    popupClassname: PropTypes.string,
    value: PropTypes.string,
    label: PropTypes.string,
    size: PropTypes.string,
    rebuildTooltips: PropTypes.func,
  }

  static defaultProps = {
    onChange: () => {},
    options: [],
    popupClassname: null,
    value: null,
    label: null,
    size: 'large',
    style: {},
    rebuildTooltips: () => {},
  }

  state = {
    isOpen: false,
  }

  componentDidMount = () => {
    this.props.rebuildTooltips()
  }

  componentDidUpdate = (nextProps, nextState) => {
    if (this.state.isOpen !== nextState.isOpen) {
      ReactTooltip.hide()
      this.props.rebuildTooltips()
    }

    if (this.props.value !== nextProps.value) {
      this.props.rebuildTooltips()
    }
  }

  renderSelect = () => {
    return (
      <div
        className={`react-autoql-select ${this.props.className}`}
        data-test='react-autoql-select'
        onClick={(e) => {
          // e.stopPropagation()
          this.setState({ isOpen: !this.state.isOpen })
        }}
        style={this.props.style}
        data-tip={this.props.tooltip}
        data-for={this.props.tooltipID}
        data-offset={10}
        data-delay-show={500}
      >
        {_get(
          this.props.options.find((option) => option.value === this.props.value),
          'label',
        ) ||
          _get(
            this.props.options.find((option) => option.value === this.props.value),
            'value',
            <span style={{ color: 'rgba(0,0,0,0.4)', fontStyle: 'italic' }}>
              {this.props.selectionPlaceholder || 'Select an item'}
            </span>,
          )}
      </div>
    )
  }

  renderPopoverContent = () => {
    return (
      <div
        className={`react-autoql-select-popup-container ${this.props.popupClassname || ''}`}
        style={{ width: this.props.style.width }}
      >
        {!!this.props.tooltipID && (
          <ReactTooltip
            id={`select-tooltip-${this.ID}`}
            className='react-autoql-tooltip'
            effect='solid'
            delayShow={500}
          />
        )}
        <ul className='react-autoql-select-popup'>
          {this.props.options.map((option) => {
            return (
              <li
                key={`select-option-${this.ID}-${option.value}`}
                className={`react-autoql-select-option${option.value === this.props.value ? ' active' : ''}`}
                onClick={() => {
                  this.setState({ isOpen: false })
                  this.props.onChange(option.value)
                }}
                data-tip={option.tooltip || null}
                data-for={this.props.tooltipID ?? `select-tooltip-${this.ID}`}
                data-offset={10}
              >
                {option.listLabel || option.label}
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
          isOpen={this.state.isOpen}
          positions={this.props.positions ?? ['bottom', 'top', 'left', 'right']}
          align={this.props.align}
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
