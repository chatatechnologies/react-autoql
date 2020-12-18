import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Radio } from '../../Radio'
import { Icon } from '../../Icon'
import { TimezoneSelector } from '../../TimezoneSelector'
import { formatResetDate } from '../helpers'
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

  getResetPeriod = (frequencySelectValue) => {
    if (frequencySelectValue === 'Daily') {
      return 'DAY'
    } else if (frequencySelectValue === 'Monthly') {
      return 'MONTH'
    } else if (frequencySelectValue === 'Weekly') {
      return 'WEEK'
    } else if (frequencySelectValue === 'Immediately') {
      return 'CONTINUOUS'
    }

    return undefined
  }

  renderFrequencyDescription = () => {
    if (!this.isComplete()) {
      return null
    }

    const selection = this.state.frequencySelectValue
    const timeZone = this.state.timezone

    let description = null
    if (selection === 'Daily') {
      description = `This Alert may be triggered multiple times, but you will only be notified once per day. Scanning will resume daily at 12am (${timeZone}).`
    } else if (selection === 'Weekly') {
      description = `This Alert may be triggered multiple times, but you will only be notified once per week. Scanning will resume next Monday at 12am (${timeZone}).`
    } else if (selection === 'Monthly') {
      description = `This Alert may be triggered multiple times, but you will only be notified once per month. Scanning will resume on the first day of next month at 12am (${timeZone}).`
    } else if (selection === 'Immediately') {
      description =
        'You will be notified as soon as this happens, any time this happens. Scanning will happen continuously.'
    }

    return (
      <div className="frequency-description-box">
        {description}
        {!!_get(this.props.dataAlert, 'reset_date') &&
          this.props.dataAlert.reset_period ===
            this.getResetPeriod(this.state.frequencySelectValue) && (
            <span>
              <br />
              <br />
              <Icon type="hour-glass" />{' '}
              {`This Alert has been triggered. Scanning will resume on ${formatResetDate(
                this.props.dataAlert
              )} (${this.state.timezone})`}
            </span>
          )}
      </div>
    )
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
              We’ll scan your database and notify you as soon as the Alert
              conditions are are met.
            </p>
            <p>Once the Alert has been triggered, resume scanning:</p>
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
          {this.renderTimezoneComponent()}
        </div>
      </ErrorBoundary>
    )
  }
}
