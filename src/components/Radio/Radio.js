import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import './Radio.scss'

export default class Radio extends React.Component {
  static propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func
  }

  static defaultProps = {
    options: [],
    onChange: () => {}
  }

  render = () => {
    if (!_get(this.props.options, 'length')) {
      return null
    }

    return (
      <div className="chata-radio-btn-container" data-test="chata-radio">
        {this.props.options.map(option => {
          return (
            <div
              className={`chata-radio-btn${
                this.props.value === option ? ' active' : ''
              }`}
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
