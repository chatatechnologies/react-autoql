import React from 'react'
import PropTypes from 'prop-types'

import './Steps.scss'

export default class Steps extends React.Component {
  static propTypes = {
    steps: PropTypes.arrayOf(PropTypes.shape({}))
  }

  render = () => {
    return (
      <div className="chata-steps-container">
        {this.props.steps.map(step => {
          return (
            <div className="chata-step-container">
              <div className="chata-step-title">{step.title}</div>
              <div className="chata-step-content">{step.content}</div>
              <div className="chata-step-dot" />
            </div>
          )
        })}
      </div>
    )
  }
}
