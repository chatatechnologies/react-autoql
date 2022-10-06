import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './Steps.scss'

export default class Steps extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    steps: PropTypes.arrayOf(PropTypes.shape({})),
    initialActiveStep: PropTypes.number,
    collapsible: PropTypes.bool,
  }

  static defaultProps = {
    steps: undefined,
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
      !isNaN(this.props.initialActiveStep) &&
      !this.props.steps?.[this.props.initialActiveStep]
    ) {
      console.error(new Error('Initial active step provided is invalid'))
      this.setState({
        activeStep: 0,
      })
    }
  }

  prevStep = () => {
    if (this.state.activeStep >= 1) {
      this.onStepTitleClick(this.state.activeStep - 1)
    }
  }

  nextStep = () => {
    const nextStep = isNaN(this.state.activeStep)
      ? 0
      : this.state.activeStep + 1
    this.onStepTitleClick(nextStep)
  }

  setStep = (step) => {
    this.setState({ activeStep: step })
  }

  getHeightOfStepContent = (index) => {
    if (this.props.collapsible) {
      const content = document.querySelector(
        `#react-autoql-step-content-${this.COMPONENT_KEY}-${index}`
      )
      if (content) {
        return content.scrollHeight + 15
      }
    }
    return undefined
  }

  onStepTitleClick = (i, step) => {
    try {
      if (step && step.onClick) {
        step.onClick()
      }

      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout)
      }

      let newActiveStep = i

      // If there is an active step, explicitly set the height
      // at the moment of the click then back to 0
      const activeContentContainer = document.querySelector(
        `#react-autoql-step-content-${this.COMPONENT_KEY}-${this.state.activeStep}`
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
          `#react-autoql-step-content-${this.COMPONENT_KEY}-${i}`
        )
        if (contentContainer) {
          contentContainer.style.height = `${this.getHeightOfStepContent(i)}px`
          // Set height back to auto after transition so it can
          // be dynamically adjusted when the content changes
          clearTimeout(this.autoHideTimeout)
          this.autoHideTimeout = setTimeout(() => {
            const activeContentContainerAfterTransition =
              document.querySelector(
                `#react-autoql-step-content-${this.COMPONENT_KEY}-${i}`
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

  getStepStatus = (step) => {
    if (step.error) {
      return 'error'
    } else if (step.complete) {
      return 'complete'
    }

    return ''
  }

  render = () => {
    if (!this.props.steps || !this.props.steps.length) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-steps-${this.COMPONENT_KEY}`}
          className="react-autoql-steps-container"
          data-test="react-autoql-steps"
        >
          {this.props.steps.map((step, i) => {
            return (
              <div
                key={`react-autoql-steps-${this.COMPONENT_KEY}-${i}`}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className={`react-autoql-step-container
                ${this.getStepStatus(step)}
                ${
                  this.props.collapsible && i === this.state.activeStep
                    ? ' active'
                    : ''
                }`}
                  data-test={`react-autoql-step-container-${i}`}
                >
                  <div
                    className="react-autoql-step-title-container"
                    data-test={`react-autoql-step-title-${i}`}
                    onClick={() => this.onStepTitleClick(i, step)}
                  >
                    <div className="react-autoql-step-title">{step.title}</div>
                  </div>
                  <div
                    id={`react-autoql-step-content-${this.COMPONENT_KEY}-${i}`}
                    className="react-autoql-step-content-container"
                  >
                    <div className="react-autoql-step-subtitle">
                      {step.subtitle || null}
                    </div>
                    <div
                      className="react-autoql-step-content"
                      data-test={`react-autoql-step-content-${i}`}
                    >
                      {step.content}
                    </div>
                  </div>
                  <div className="react-autoql-step-dot">{i + 1}</div>
                </div>
              </div>
            )
          })}
        </div>
      </ErrorBoundary>
    )
  }
}
