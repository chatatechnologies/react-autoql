import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import './Radio.scss'

export default class Radio extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func,
    value: PropTypes.string,
    multiSelect: PropTypes.bool,
    type: PropTypes.string,
  }

  static defaultProps = {
    options: [],
    multiSelect: false,
    value: undefined,
    type: 'original',
    onChange: () => {},
  }

  renderButtonType = () => {
    return (
      <div
        className="react-autoql-radio-btn-container"
        data-test="react-autoql-radio"
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
              onClick={() => this.props.onChange(option)}
            >
              {option}
            </div>
          )
        })}
      </div>
    )
  }

  renderOriginalType = () => {
    return (
      <div
        className="react-autoql-radio-btn-container"
        data-test="react-autoql-radio"
      >
        {this.props.options.map((option, i) => {
          let isActive = this.props.value === option
          if (this.props.multiSelect) {
            isActive = this.props.value.includes(option)
          }
          return (
            <p>
              <input
                type="radio"
                id={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                name={`react-autoql-radio-${this.COMPONENT_KEY}`}
                checked={isActive}
              />
              <label
                for={`react-autoql-radio-${this.COMPONENT_KEY}-${i}`}
                onClick={() => this.props.onChange(option)}
              >
                {option}
              </label>
            </p>
          )
        })}
      </div>
    )
  }

  render = () => {
    if (!_get(this.props.options, 'length')) {
      return null
    }

    if (this.props.type === 'button') {
      return this.renderButtonType()
    }

    return this.renderOriginalType()
  }
}
