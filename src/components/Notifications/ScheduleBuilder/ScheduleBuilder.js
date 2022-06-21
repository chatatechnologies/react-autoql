import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import { v4 as uuid } from 'uuid'

import { Radio } from '../../Radio'
import { TimezoneSelector } from '../../TimezoneSelector'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { themeConfigType } from '../../../props/types'
import { themeConfigDefault } from '../../../props/defaults'

import './ScheduleBuilder.scss'

const getFrequencyValue = (dataAlert) => {
  if (!dataAlert) {
    return undefined
  }

  const notificationType = dataAlert.notification_type
  const resetPeriod = dataAlert.reset_period
  let frequencySelectValue = undefined

  if (notificationType === 'CONTINUOUS') {
    frequencySelectValue = 'Every time this happens'
  } else if (resetPeriod === 'DAY') {
    frequencySelectValue = 'Only once per day'
  } else if (resetPeriod === 'WEEK') {
    frequencySelectValue = 'Only once per week'
  } else if (resetPeriod === 'MONTH') {
    frequencySelectValue = 'Only once per month'
  }

  return frequencySelectValue
}

export default class ScheduleBuilder extends React.Component {
  COMPONENT_KEY = uuid()

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
    timezone: _get(this.props.dataAlert, 'time_zone'),
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

    if (frequencySelectValue === 'Every time this happens') {
      notificationType = 'CONTINUOUS'
    } else if (frequencySelectValue === 'Only once per day') {
      resetPeriod = 'DAY'
    } else if (frequencySelectValue === 'Only once per week') {
      resetPeriod = 'WEEK'
    } else if (frequencySelectValue === 'Only once per month') {
      resetPeriod = 'MONTH'
    }

    return {
      notificationType,
      resetPeriod,
      timezone,
    }
  }

  getResetPeriod = (frequencySelectValue) => {
    if (frequencySelectValue === 'Only once per day') {
      return 'DAY'
    } else if (frequencySelectValue === 'Only once per month') {
      return 'MONTH'
    } else if (frequencySelectValue === 'Only once per week') {
      return 'WEEK'
    } else if (frequencySelectValue === 'Every time this happens') {
      return 'CONTINUOUS'
    }

    return undefined
  }

  onTimezoneChange = (timezone) => {
    this.setState({ timezone: timezone.value })
  }

  renderTimezoneComponent = () => {
    return (
      <div>
        <span>Time zone: </span>
        <TimezoneSelector
          onChange={this.onTimezoneChange}
          defaultSelection={this.state.timezone}
        />
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
            <p>
              When the conditions of this Data Alert are met, how often do you
              want to be notified?
            </p>
            <Radio
              themeConfig={this.props.themeConfig}
              options={[
                'Every time this happens',
                'Only once per day',
                'Only once per week',
                'Only once per month',
              ]}
              selectionPlaceholder="Select a frequency"
              value={this.state.frequencySelectValue}
              type="original"
              onChange={(option) =>
                this.setState({ frequencySelectValue: option })
              }
            />
          </div>
        </div>
        <div className="schedule-builder-timezone-section">
          {this.renderTimezoneComponent()}
        </div>
      </ErrorBoundary>
    )
  }
}
