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
    multiSelect: PropTypes.bool
  }

  static defaultProps = {
    options: [],
    multiSelect: false,
    onChange: () => {}
  }

  render = () => {
    if (!_get(this.props.options, 'length')) {
      return null
    }

    return (
      <div className="chata-radio-btn-container" data-test="chata-radio">
        {this.props.options.map((option, i) => {
          let isActive = this.props.value === option
          if (this.props.multiSelect) {
            isActive = this.props.value.includes(option)
          }
          return (
            <div
              key={`chata-radio-${this.COMPONENT_KEY}-${i}`}
              className={`chata-radio-btn
                ${isActive ? ' active' : ''}
                ${this.props.outlined ? ' outlined' : ''}`}
              onClick={() => this.props.onChange(option)}
            >
              {option}
            </div>
          )
        })}
      </div>
    )
  }
}
