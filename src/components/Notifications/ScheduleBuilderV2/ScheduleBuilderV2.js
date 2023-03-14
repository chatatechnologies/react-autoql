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
    label: 'at the following regular intervals:',
    listLabel: 'at the following regular intervals',
  },
  CONTINUOUS: {
    label: 'as soon as it happens.',
    listLabel: 'as soon as it happens',
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

    const defaultResetPeriod = this.getResetPeriodSelectValue()

    this.state = {
      resetPeriodSelectValue: props.dataAlert?.reset_period ?? defaultResetPeriod,
      checkFrequencySelectValue: props.dataAlert?.check_frequency ?? defaultResetPeriod,
      frequencyType: props.dataAlert?.notification_type ?? Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS)[0],
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
      return !!state.resetPeriodSelectValue
    } else if (state.frequencyType === 'CONTINUOUS') {
      return true
    }

    return false
  }

  getData = () => {
    const { resetPeriodSelectValue, timezone } = this.state

    let resetPeriod = null
    if (resetPeriodSelectValue !== 'NONE') {
      resetPeriod = resetPeriodSelectValue
    }

    return {
      notificationType: this.state.frequencyType,
      resetPeriod,
      timezone,
    }
  }

  // Reset period is only relevant for "continuous" type data alerts, not scheduled alerts
  getResetPeriodSelectValue = () => {
    const { dataAlert, queryResponse } = this.props
    if (!dataAlert) {
      return getTimeRangeFromRT(queryResponse)
    }

    if (dataAlert.notification_type === 'CONTINUOUS') {
      return undefined
    }

    return RESET_PERIOD_OPTIONS[dataAlert.reset_period]
  }

  getResetPeriod = (resetPeriodSelectValue) => {
    if (resetPeriodSelectValue === 'Only once per day') {
      return 'DAY'
    } else if (resetPeriodSelectValue === 'Only once per month') {
      return 'MONTH'
    } else if (resetPeriodSelectValue === 'Only once per week') {
      return 'WEEK'
    } else if (resetPeriodSelectValue === 'Every time this happens') {
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
                value={this.state.resetPeriodSelectValue ?? Object.keys(SCHEDULE_INTERVAL_OPTIONS)[0]}
                onChange={(option) => this.setState({ resetPeriodSelectValue: option })}
              />
            </div>
            {this.state.resetPeriodSelectValue === 'MONTH' && (
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
            {this.state.resetPeriodSelectValue === 'WEEK' && (
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
              {/* <div className='react-autoql-input-label'>Time</div> */}
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
            value={this.state.resetPeriodSelectValue ?? Object.keys(RESET_PERIOD_OPTIONS)[0]}
            onChange={(option) => this.setState({ resetPeriodSelectValue: option })}
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
    const query = this.props.queryResponse?.data?.data?.text
    const queryText = query ? <span className='schedule-builder-query-text'>"{query}"</span> : 'this query'

    let helperText = <span>If new data is detected for {queryText}, you'll be notified</span>
    if (this.props.conditionType === 'COMPARE') {
      helperText = <span>If the condition for this Data Alert is met, you'll be notified</span>
    }

    return (
      <>
        <span>
          {helperText}
          <Select
            options={Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS).map((key) => {
              return {
                value: key,
                label: DATA_ALERT_FREQUENCY_TYPE_OPTIONS[key]?.label,
                listLabel: DATA_ALERT_FREQUENCY_TYPE_OPTIONS[key]?.listLabel,
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

  renderQuery = () => {
    let queryText = this.props.queryResponse?.data?.data?.text
    queryText = queryText[0].toUpperCase() + queryText.substring(1)
    // return (
    //   <div className='data-alert-rule-formatted-query'>
    //     <span>{queryText}</span>
    //     {/* <span>{this.renderChunkedInterpretation()} </span> */}
    //     <Icon
    //       type='info'
    //       className='data-alert-rule-tooltip-icon'
    //       data-for={this.props.tooltipID}
    //       data-tip='This query will be used to evaluate the conditions below. If the query result meets the specified conditons, an alert will be triggered.'
    //       // data-tip={`This is how AutoQL interpreted the query "${this.props.queryResponse?.data?.data?.text}".<br /><br />If there was a date or time frame in the original query, you will be able to configure that in the next step.`}
    //       data-place='right'
    //     />
    //     {/*
    //     Do we want the ability to edit this?
    //     <Icon type='edit' onClick={() => this.setState({ isEditingQuery: true })} />
    //     */}
    //   </div>
    // )

    {
      /* <div className='react-autoql-input-label'>Query</div>
        <div className='data-alert-rule-formatted-query'>{queryText}</div> */
    }

    return <div>Query: {queryText}</div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='notification-frequency-step' data-test='schedule-builder'>
          {/* <div className='schedule-builder-query-container'>{this.renderQuery()}</div> */}
          <div className='frequency-type-container'>{this.renderFrequencyTypeSelector()}</div>
          <div className='frequency-settings-container'>{this.renderFrequencyOptions()}</div>
        </div>
      </ErrorBoundary>
    )
  }
}
