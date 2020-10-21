import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Radio } from '../../Radio'

import { themeConfigType } from '../../../props/types'
import { themeConfigDefault } from '../../../props/defaults'

import './ScheduleBuilder.scss'

export default class ScheduleBuilder extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    themeConfig: themeConfigType,
    rule: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompletedChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    rule: undefined,
    onChange: () => {},
    onCompletedChange: () => {},
    onErrorCallback: () => {},
  }

  state = {
    frequencySelectValue: undefined,
  }

  componentDidMount = () => {
    this.setInitialFrequencyValue()
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

  setInitialFrequencyValue = () => {
    if (!this.props.rule) {
      return
    }

    const notificationType = this.props.rule.notification_type
    const resetPeriod = this.props.rule.reset_period
    let frequencySelectValue = undefined

    if (notificationType === 'REPEAT_EVENT') {
      frequencySelectValue = 'Immediately'
    } else if (resetPeriod === 'DAY') {
      frequencySelectValue = 'Daily'
    } else if (resetPeriod === 'WEEK') {
      frequencySelectValue = 'Weekly'
    } else if (resetPeriod === 'MONTH') {
      frequencySelectValue = 'Monthly'
    }

    this.setState({ frequencySelectValue })
  }

  getData = () => {
    const { frequencySelectValue } = this.state
    let notificationType = 'SINGLE_EVENT'
    let resetPeriod = null

    if (frequencySelectValue === 'Immediately') {
      notificationType = 'REPEAT_EVENT'
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

  render = () => {
    return (
      <div className="notification-frequency-step" data-test="schedule-builder">
        <div className="frequency-settings-container">
          <p>You will be notified as soon as the Alert conditions are met.</p>
          <p>Reset Alert to run:</p>
          <Radio
            themeConfig={this.props.themeConfig}
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
    )
  }
}
