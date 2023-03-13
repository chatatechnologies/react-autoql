import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { Select } from '../../Select'
import { TimezoneSelector } from '../../TimezoneSelector'
import { getTimeRangeFromRT } from '../../../js/reverseTranslationHelpers'

import { WEEKDAY_NAMES_MON } from '../../../js/Constants'

import './ScheduleBuilderV2.scss'

const DATA_ALERT_FREQUENCY_TYPE_OPTIONS = {
  PERIODIC: {
    displayName: 'at the following regular intervals:', // DEFAULT
  },
  CONTINUOUS: {
    displayName: 'as soon as it happens.',
  },
}

const SCHEDULE_INTERVAL_OPTIONS = {
  DAY: {
    displayName: <span>Daily</span>,
  },
  WEEK: {
    displayName: <span>Weekly</span>,
  },
  MONTH: {
    displayName: <span>Monthly</span>,
  },
  YEAR: {
    displayName: <span>Yearly</span>,
  },
}

const RESET_PERIOD_OPTIONS = {
  DAY: {
    displayName: (
      <span>
        At most once <strong>every 24 hours</strong>
      </span>
    ),
  },
  WEEK: {
    displayName: (
      <span>
        At most <strong>once a week</strong>
      </span>
    ),
  },
  MONTH: {
    displayName: (
      <span>
        At most <strong>once a month</strong>
      </span>
    ),
  },
  YEAR: {
    displayName: (
      <span>
        At most <strong>once a year</strong>
      </span>
    ),
  },
  NONE: {
    displayName: (
      <span>
        <strong>Every time</strong> it happens
      </span>
    ),
  },
}

const MONTH_DAY_SELECT_OPTIONS = {
  FIRST: (
    <span>
      on the <strong>first day</strong>
    </span>
  ),
  LAST: (
    <span>
      on the <strong>last day</strong>
    </span>
  ),
}

export default class ScheduleBuilderV2 extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      frequencySelectValue: this.getFrequencySelectValue(),
      frequencyType: Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS)[0],
      timezone: props.dataAlert?.time_zone,
      monthDaySelectValue: 'LAST',
      intervalTimeHour: '12',
      weekDaySelectValue: 'Friday',
    }
  }

  static propTypes = {
    conditionType: PropTypes.string,
    dataAlert: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompletedChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    conditionType: 'EXISTS',
    dataAlert: undefined,
    onChange: () => {},
    onCompletedChange: () => {},
    onErrorCallback: () => {},
  }

  componentDidMount = () => {
    this.props.onCompletedChange(this.isComplete())
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.isComplete() !== this.isComplete(prevState)) {
      this.props.onCompletedChange(this.isComplete())
    }
  }

  isComplete = (prevState) => {
    const state = prevState ?? this.state

    if (state.frequencyType === 'PERIODIC') {
      return !!state.frequencySelectValue
    } else if (state.frequencyType === 'CONTINUOUS') {
      return true
    }

    return false
  }

  getData = () => {
    const { frequencySelectValue, timezone } = this.state

    let resetPeriod = null
    if (frequencySelectValue !== 'NONE') {
      resetPeriod = frequencySelectValue
    }

    return {
      notificationType: this.state.frequencyType,
      resetPeriod,
      timezone,
    }
  }

  getFrequencySelectValue = () => {
    const { dataAlert, queryResponse } = this.props
    if (!dataAlert) {
      return getTimeRangeFromRT(queryResponse)
    }

    if (dataAlert.notification_type === 'CONTINUOUS') {
      return undefined
    }

    return RESET_PERIOD_OPTIONS[dataAlert.reset_period]
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

  renderFrequencyOptions = () => {
    if (this.state.frequencyType === 'PERIODIC') {
      return (
        <div>
          <div className='react-autoql-data-alert-frequency-options-container'>
            <div>
              <div className='react-autoql-input-label'>How often</div>
              <Select
                options={Object.keys(SCHEDULE_INTERVAL_OPTIONS).map((value) => {
                  return {
                    value,
                    label: SCHEDULE_INTERVAL_OPTIONS[value].displayName,
                  }
                })}
                value={this.state.frequencySelectValue ?? Object.keys(SCHEDULE_INTERVAL_OPTIONS)[0]}
                onChange={(option) => this.setState({ frequencySelectValue: option })}
              />
            </div>
            {this.state.frequencySelectValue === 'MONTH' && (
              <div>
                <Select
                  value={this.state.monthDaySelectValue}
                  onChange={(monthDaySelectValue) => this.setState({ monthDaySelectValue })}
                  options={Object.keys(MONTH_DAY_SELECT_OPTIONS).map((value) => {
                    return {
                      value,
                      label: MONTH_DAY_SELECT_OPTIONS[value],
                    }
                  })}
                />
              </div>
            )}
            {this.state.frequencySelectValue === 'WEEK' && (
              <div>
                <Select
                  value={this.state.weekDaySelectValue}
                  onChange={(weekDaySelectValue) => this.setState({ weekDaySelectValue })}
                  options={WEEKDAY_NAMES_MON.map((value) => {
                    return {
                      value,
                      label: (
                        <span>
                          on <strong>{value}</strong>
                        </span>
                      ),
                    }
                  })}
                />
              </div>
            )}
            <div className='schedule-builder-at-connector'>
              <span>at</span>
            </div>
            <div>
              {/* <div className='react-autoql-input-label'>When</div> */}
              <div className='react-autoql-input-label'>Time</div>
              <Select
                options={[{ value: '12', label: '12:00am' }]}
                value={this.state.intervalTimeHour}
                onChange={(intervalTimeHour) => this.setState({ intervalTimeHour })}
              />
            </div>
            <div className='schedule-builder-timezone-section'>{this.renderTimezoneComponent()}</div>
          </div>
        </div>
      )
    } else if (this.state.frequencyType === 'CONTINUOUS') {
      return (
        <>
          <div className='react-autoql-input-label'>How often</div>
          <Select
            options={Object.keys(RESET_PERIOD_OPTIONS).map((value) => {
              return {
                value,
                label: RESET_PERIOD_OPTIONS[value].displayName,
              }
            })}
            value={this.state.frequencySelectValue ?? Object.keys(RESET_PERIOD_OPTIONS)[0]}
            onChange={(option) => this.setState({ frequencySelectValue: option })}
          />
        </>
      )
    }
  }

  onTimezoneChange = (timezone) => {
    this.setState({ timezone: timezone.value })
  }

  renderTimezoneComponent = () => {
    return (
      <div>
        <div className='react-autoql-input-label'>Time zone</div>
        <TimezoneSelector
          onChange={this.onTimezoneChange}
          defaultSelection={this.state.timezone}
          popoverParentElement={this.props.popoverParentElement}
          popoverBoundaryElement={this.props.popoverBoundaryElement}
        />
      </div>
    )
  }

  renderFrequencyTypeSelector = () => {
    let helperText = "If the data for this query changes, you'll be notified of the changes"
    if (this.props.conditionType === 'COMPARE') {
      helperText = "If the condition for this Data Alert is met, you'll be notified"
    }

    return (
      <>
        <span>
          {helperText}
          <Select
            options={Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS).map((key) => {
              return {
                value: key,
                label: DATA_ALERT_FREQUENCY_TYPE_OPTIONS[key]?.displayName,
              }
            })}
            value={this.state.frequencyType ?? Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS)[0]}
            onChange={(type) => this.setState({ frequencyType: type })}
            outlined={false}
          />
        </span>
      </>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='notification-frequency-step' data-test='schedule-builder'>
          <div className='frequency-type-container'>{this.renderFrequencyTypeSelector()}</div>
          <div className='frequency-settings-container'>{this.renderFrequencyOptions()}</div>
        </div>
      </ErrorBoundary>
    )
  }
}
