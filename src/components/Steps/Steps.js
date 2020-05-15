import React from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import _get from 'lodash.get'

import './Steps.scss'

export default class Steps extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    steps: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    initialActiveStep: PropTypes.number,
    collapsible: PropTypes.bool,
  }

  static defaultProps = {
    initialActiveStep: undefined,
    collapsible: true,
  }

  state = {
    activeStep: this.props.initialActiveStep || 0,
  }

  componentDidMount = () => {
    if (!this.props.steps || !this.props.steps.length) {
      console.error(new Error('No steps were provided'))
    } else if (
      this.props.initialActiveStep != null &&
      !Number.isNaN(this.props.initialActiveStep) &&
      !_get(this.props.steps, `${this.props.initialActiveStep}`)
    ) {
      console.error(new Error('Initial active step provided is invalid'))
      this.setState({
        activeStep: 0,
      })
    }
  }

  nextStep = () => {
    const nextStep = Number.isNaN(this.state.activeStep)
      ? 0
      : this.state.activeStep + 1
    this.onStepTitleClick(nextStep)
  }

  getHeightOfStepContent = index => {
    if (this.props.collapsible) {
      const content = document.querySelector(
        `#chata-step-content-${this.COMPONENT_KEY}-${index}`
      )
      if (content) {
        return content.scrollHeight
      }
    }
    return undefined
  }

  onStepTitleClick = i => {
    try {
      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout)
      }

      let newActiveStep = i

      // If there is an active step, explicitly set the height
      // at the moment of the click then back to 0
      const activeContentContainer = document.querySelector(
        `#chata-step-content-${this.COMPONENT_KEY}-${this.state.activeStep}`
      )
      if (activeContentContainer) {
        activeContentContainer.style.height = `${this.getHeightOfStepContent(
          this.state.activeStep
        )}px`
        setTimeout(() => {
          activeContentContainer.style.height = '10px'
        }, 0)
      }

      // Explicitly set height of new active container and
      // set height back to 0 for the previous active container
      if (i !== this.state.activeStep) {
        const contentContainer = document.querySelector(
          `#chata-step-content-${this.COMPONENT_KEY}-${i}`
        )
        if (contentContainer) {
          contentContainer.style.height = `${this.getHeightOfStepContent(i)}px`
          // Set height back to auto after transition so it can
          // be dynamically adjusted when the content changes
          this.autoHideTimeout = setTimeout(() => {
            const activeContentContainerAfterTransition = document.querySelector(
              `#chata-step-content-${this.COMPONENT_KEY}-${i}`
            )
            if (activeContentContainerAfterTransition) {
              activeContentContainerAfterTransition.style.height = 'auto'
            }
          }, 500)
        }
      } else {
        newActiveStep = undefined
      }

      this.setState({ activeStep: newActiveStep })
    } catch (error) {
      console.error(error)
    }
  }

  render = () => {
    if (!this.props.steps || !this.props.steps.length) {
      return null
    }

    return (
      <div
        id={`chata-steps-${this.COMPONENT_KEY}`}
        className="chata-steps-container"
        data-test="chata-steps"
      >
        {this.props.steps.map((step, i) => {
          return (
            <div
              key={`chata-steps-${this.COMPONENT_KEY}-${i}`}
              style={{ overflow: 'hidden' }}
            >
              <div
                className={`chata-step-container
                ${step.complete ? ' complete' : ''}
                ${
                  this.props.collapsible && i === this.state.activeStep
                    ? ' active'
                    : ''
                }`}
              >
                <div
                  className="chata-step-title-container"
                  onClick={() => this.onStepTitleClick(i)}
                >
                  <div className="chata-step-title">{step.title}</div>
                </div>
                <div
                  id={`chata-step-content-${this.COMPONENT_KEY}-${i}`}
                  className="chata-step-content-container"
                >
                  <div className="chata-step-subtitle">
                    {step.subtitle || null}
                  </div>
                  <div className="chata-step-content">{step.content}</div>
                </div>
                <div className="chata-step-dot">{i + 1}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}
