import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'

import './Steps.scss'

export default class Steps extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    steps: PropTypes.arrayOf(PropTypes.shape({})).isRequired
  }

  render = () => {
    return (
      <div className="chata-steps-container" data-test="chata-steps">
        {this.props.steps.map((step, i) => {
          return (
            <div
              key={`chata-steps-${this.COMPONENT_KEY}-${i}`}
              className={`chata-step-container
                ${step.complete ? ' complete' : ''}`}
            >
              <div className="chata-step-title">{step.title}</div>
              {step.subtitle && (
                <div className="chata-step-subtitle">{step.subtitle}</div>
              )}
              <div className="chata-step-content">{step.content}</div>
              <div className="chata-step-dot" />
            </div>
          )
        })}
      </div>
    )
  }
}
