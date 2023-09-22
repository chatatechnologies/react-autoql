import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import { v4 as uuid } from 'uuid'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Radio.scss'

export default class Radio extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func,
    value: PropTypes.string,
    multiSelect: PropTypes.bool,
    type: PropTypes.string,
    tooltips: PropTypes.arrayOf(PropTypes.string),
    tooltipId: PropTypes.string,
  }

  static defaultProps = {
    options: [],
    multiSelect: false,
    value: undefined,
    type: 'original',
    tooltips: [],
    tooltipId: null,
    onChange: () => {},
  }

  renderButtonType = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-radio-btn-container
            react-autoql-radio-btn-container-buttons
            ${this.props.className ?? ''}`}
          data-test='react-autoql-radio'
        >
          {this.props.options.map((option, i) => {
            let isActive = this.props.value === option
            if (this.props.multiSelect) {
              isActive = this.props.value.includes(option)
            }
            return (
              <div
                key={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                className={`react-autoql-radio-btn
                  ${isActive ? ' active' : ''}`}
                data-test='react-autoql-radio-btn'
                onClick={() => this.props.onChange(option)}
                data-tip={this.props.tooltips?.[i]}
                data-for={this.props.tooltipID}
                data-delay-show={500}
              >
                <div>{option}</div>
              </div>
            )
          })}
        </div>
      </ErrorBoundary>
    )
  }

  renderOriginalType = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-radio-btn-container react-autoql-radio-btn-container-list ${this.props.className}`}
          data-test='react-autoql-radio'
        >
          {this.props.options.map((option, i) => {
            let isActive = this.props.value === option
            if (this.props.multiSelect) {
              isActive = this.props.value.includes(option)
            }
            return (
              <p key={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}>
                <input
                  id={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                  name={`react-autoql-radio-${this.COMPONENT_KEY}`}
                  type='radio'
                  defaultChecked={isActive}
                />
                <label
                  htmlFor={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                  onClick={() => this.props.onChange(option)}
                >
                  {option}
                </label>
              </p>
            )
          })}
        </div>
      </ErrorBoundary>
    )
  }

  render = () => {
    if (!this.props.options?.length) {
      return null
    }

    if (this.props.type === 'button') {
      return this.renderButtonType()
    }

    return this.renderOriginalType()
  }
}
