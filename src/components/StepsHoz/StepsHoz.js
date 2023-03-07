import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './StepsHoz.scss'
import { Icon } from '../Icon'

export default class Steps extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
  }

  static propTypes = {
    steps: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    activeStep: PropTypes.number.isRequired,
  }

  static defaultProps = {}

  componentDidMount = () => {
    if (!this.props.steps || !this.props.steps.length) {
      console.warn('No steps were provided to StepsHoz component')
    }
  }

  getStepStatus = (step) => {
    if (step.error) {
      return 'error'
    } else if (step.complete) {
      return 'complete'
    }

    return ''
  }

  isStepDisabled = (i, step) => {
    if (i !== 0 && i !== this.props.activeStep && !step?.complete && !this.props.steps?.[i - 1]?.complete) {
      return ' disabled'
    }
    return ''
  }

  onClick = (i, isDisabled) => {
    if (!isDisabled) {
      this.props.onStepChange(i)
    }
  }

  render = () => {
    if (!this.props.steps || !this.props.steps.length) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-steps-hoz-${this.COMPONENT_KEY}`}
          className='react-autoql-steps-hoz-container'
          data-test='react-autoql-steps'
        >
          {this.props.steps.map((step, i) => {
            const isDisabled = this.isStepDisabled(i, step)
            const isActive = this.props.activeStep === i
            const status = this.getStepStatus(step)
            return (
              <div
                key={`steps-hoz-${this.COMPONENT_KEY}-${i}`}
                className={`react-autoql-step-hoz-container
                ${status}
                ${isActive ? ' active' : ''}
                ${isDisabled ? ' disabled' : ''}`}
                data-test={`react-autoql-step-container-${i}`}
              >
                {i !== 0 && (
                  <div className='react-autoql-step-connector-container'>
                    <span className='react-autoql-step-connector' />
                  </div>
                )}
                <div className='react-autoql-step-hoz'>
                  <button className='react-autoql-step-hoz-dot' onClick={() => this.onClick(i, isDisabled)}>
                    {status === 'complete' && !isActive ? <Icon type='check' /> : i + 1}
                  </button>
                  <div
                    className='react-autoql-step-hoz-title-container'
                    data-test={`react-autoql-step-hoz-title-${i}`}
                    onClick={() => this.onClick(i, isDisabled)}
                  >
                    <span className='react-autoql-step-hoz-title'>{step.title}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ErrorBoundary>
    )
  }
}
