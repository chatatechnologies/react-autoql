import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Radio } from '../../Radio'
import { TimezoneSelector } from '../../TimezoneSelector'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { themeConfigType } from '../../../props/types'
import { themeConfigDefault, getThemeConfig } from '../../../props/defaults'

import './ScheduleBuilder.scss'

const getFrequencyValue = (dataAlert) => {
  if (!dataAlert) {
    return undefined
  }

  const notificationType = dataAlert.notification_type
  const resetPeriod = dataAlert.reset_period
  let frequencySelectValue = undefined

  if (notificationType === 'CONTINUOUS') {
    frequencySelectValue = 'Immediately'
  } else if (resetPeriod === 'DAY') {
    frequencySelectValue = 'Daily'
  } else if (resetPeriod === 'WEEK') {
    frequencySelectValue = 'Weekly'
  } else if (resetPeriod === 'MONTH') {
    frequencySelectValue = 'Monthly'
  }

  return frequencySelectValue
}

export default class ScheduleBuilder extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    themeConfig: themeConfigType,
    dataAlert: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompletedChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataAlert: undefined,
    onChange: () => {},
    onCompletedChange: () => {},
    onErrorCallback: () => {},
  }

  state = {
    frequencySelectValue: getFrequencyValue(this.props.dataAlert),
  }

  componentDidMount = () => {
    this.props.onCompletedChange(this.isComplete())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.isComplete() !== this.isComplete(prevState)) {
      this.props.onCompletedChange(this.isComplete())
    }
  }

  isComplete = (state) => {
    if (state) {
      return !!state.frequencySelectValue
    }

    return !!this.state.frequencySelectValue
  }

  getData = () => {
    const { frequencySelectValue, timezone } = this.state
    let notificationType = 'PERIODIC'
    let resetPeriod = null

    if (frequencySelectValue === 'Immediately') {
      notificationType = 'CONTINUOUS'
    } else if (frequencySelectValue === 'Daily') {
      resetPeriod = 'DAY'
    } else if (frequencySelectValue === 'Weekly') {
      resetPeriod = 'WEEK'
    } else if (frequencySelectValue === 'Monthly') {
      resetPeriod = 'MONTH'
    }

    return {
      notificationType,
      resetPeriod,
      timezone,
    }
  }

  renderFrequencyDescription = () => {
    if (!this.isComplete()) {
      return null
    }

    const selection = this.state.frequencySelectValue

    let description = null
    if (selection === 'Daily') {
      description =
        'You will be notified as soon as this happens. If the Alert is triggered multiple times, you will only be notified a maximum of once per day.'
    } else if (selection === 'Monthly') {
      description =
        'You will be notified as soon as this happens. If the Alert is triggered multiple times, you will only be notified on a monthly basis.'
    } else if (selection === 'Weekly') {
      description =
        'You will be notified as soon as this happens. If the Alert is triggered multiple times, you will only be notified on a weekly basis.'
    } else if (selection === 'Immediately') {
      description =
        'You will be notified as soon as this happens, any time this happens.'
    }

    return <div className="frequency-description-box">{description}</div>
  }

  onTimezoneChange = (timezone) => {
    this.setState({ timezone: timezone.value })
  }

  defaultTimezoneComponent = () => {
    if (this.state.timezone) {
      return (
        <div>
          We detected your timezone to be <em>{this.state.timezone}</em>.{' '}
          <a onClick={() => this.setState({ isEditingTimezone: true })}>
            Change
          </a>
        </div>
      )
    }
  }

  editTimezoneComponent = () => {
    return (
      <div>
        <span>Select your time zone: </span>
        <TimezoneSelector onChange={this.onTimezoneChange} />
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className="notification-frequency-step"
          data-test="schedule-builder"
        >
          <div className="frequency-settings-container">
            <p>You will be notified as soon as the Alert conditions are met.</p>
            <p>Reset Alert to run:</p>
            <Radio
              themeConfig={getThemeConfig(this.props.themeConfig)}
              options={['Immediately', 'Daily', 'Weekly', 'Monthly']}
              selectionPlaceholder="Select a frequency"
              value={this.state.frequencySelectValue}
              type="original"
              onChange={(option) =>
                this.setState({ frequencySelectValue: option })
              }
            />
          </div>
          <div className="frequency-description-box-container">
            {this.renderFrequencyDescription()}
          </div>
        </div>
        <div className="schedule-builder-timezone-section">
          {this.state.isEditingTimezone || !this.state.timezone
            ? this.editTimezoneComponent()
            : this.defaultTimezoneComponent()}
        </div>
      </ErrorBoundary>
    )
  }
}
