import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { TimezoneSelector } from '../../TimezoneSelector'
import { getTimeRangeFromRT } from '../../../js/reverseTranslationHelpers'
import { TimePicker } from '../../TimePicker'

import { MONTH_NAMES, WEEKDAY_NAMES_MON } from '../../../js/Constants'
import {
  CONTINUOUS_TYPE,
  DATA_ALERT_FREQUENCY_TYPE_OPTIONS,
  SCHEDULE_INTERVAL_OPTIONS,
  RESET_PERIOD_OPTIONS,
  CHECK_FREQUENCY_OPTIONS,
  MONTH_DAY_SELECT_OPTIONS,
  COMPARE_TYPE,
  EXISTS_TYPE,
  SCHEDULED_TYPE,
  PERIODIC_TYPE,
} from '../DataAlertConstants'

import './ScheduleBuilder.scss'
import { showCheckFrequencySetting } from '../helpers'

export default class ScheduleBuilder extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.DEFAULT_CHECK_FREQUENCY_INDEX = 3 // index 3 -> "5 mins"
    this.DEFAULT_RESET_PERIOD_SELECT_VALUE = 'MONTH'
    this.DEFAULT_WEEKDAY_SELECT_VALUE = 'Friday'
    this.DEFAULT_MONTH_DAY_SELECT_VALUE = 'LAST'
    this.DEFAULT_MONTH_OF_YEAR_SELECT_VALUE = 'December'
    this.DEFAULT_FREQUENCY_TYPE = SCHEDULED_TYPE
    this.DEFAULT_TIME_SELECT_VALUE = {
      ampm: 'pm',
      minute: 0,
      hour: 5,
      hour24: 17,
      value: '5:00pm',
      value24hr: '17:00',
    }

    const timeRange = getTimeRangeFromRT(props.queryResponse)

    // let frequencyType = props.dataAlert?.notification_type
    // if (frequencyType === PERIODIC_TYPE) {
    //   frequencyType = CONTINUOUS_TYPE
    // }

    this.state = {
      timeRange: props.dataAlert?.reset_period ?? timeRange,
      resetPeriodSelectValue: props.dataAlert?.reset_period ?? timeRange ?? this.DEFAULT_RESET_PERIOD_SELECT_VALUE,
      checkFrequencySelectValue: props.dataAlert?.check_frequency ?? this.DEFAULT_CHECK_FREQUENCY_INDEX,
      frequencyType: props.dataAlert?.notification_type ?? this.DEFAULT_FREQUENCY_TYPE,
      timezone: props.dataAlert?.time_zone,
      monthDaySelectValue: this.DEFAULT_MONTH_DAY_SELECT_VALUE,
      intervalTimeSelectValue: this.DEFAULT_TIME_SELECT_VALUE,
      weekDaySelectValue: this.DEFAULT_WEEKDAY_SELECT_VALUE,
      monthOfYearSelectValue: this.DEFAULT_MONTH_OF_YEAR_SELECT_VALUE,
    }
  }

  static propTypes = {
    conditionType: PropTypes.string,
    showTypeSelector: PropTypes.bool,
    dataAlert: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompletedChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    conditionType: EXISTS_TYPE,
    showTypeSelector: true,
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

    if (this.props.queryResponse?.data?.data?.text !== prevProps.queryResponse?.data?.data?.text) {
      this.setState({
        timeRange: getTimeRangeFromRT(props.queryResponse),
      })
    }
  }

  isComplete = (prevState) => {
    const state = prevState ?? this.state

    if (this.shouldRenderResetPeriodSelector(prevState) && !state.resetPeriodSelectValue) {
      return false
    } else if (this.shouldRenderCheckFrequencySelector(prevState) && !state.checkFrequencySelectValue) {
      return false
    }

    return true
  }

  getData = () => {
    const notificationType = this.getNotificationType()
    const resetPeriod = this.state.frequencyType !== SCHEDULED_TYPE ? this.getResetPeriod() : undefined
    const schedules = this.getSchedules()
    const timezone = this.state.timezone

    return {
      notificationType,
      resetPeriod,
      schedules,
      timezone,
    }
  }

  getNotificationPeriod = () => {
    if (this.state.resetPeriodSelectValue === 'MONTH' && this.state.monthDaySelectValue === 'LAST') {
      return 'MONTH_LAST_DAY'
    }

    return this.state.resetPeriodSelectValue
  }

  getLocalStartDate = ({ daysToAdd } = {}) => {
    return SCHEDULE_INTERVAL_OPTIONS[this.state.resetPeriodSelectValue]?.getLocalStartDate({
      timeObj: this.state.intervalTimeSelectValue,
      timezone: this.state.timezone,
      monthDay: this.state.monthDaySelectValue,
      weekDay: this.state.weekDaySelectValue,
      daysToAdd,
    })
  }

  getSchedules = () => {
    if (this.state.frequencyType !== SCHEDULED_TYPE) {
      return
    }

    if (this.state.resetPeriodSelectValue === 'DAY') {
      const schedules = []
      WEEKDAY_NAMES_MON.forEach((weekday, i) => {
        schedules.push({
          notification_period: 'WEEK',
          start_date: this.getLocalStartDate({ daysToAdd: i }),
          time_zone: this.state.timezone,
        })
      })

      return schedules
    }

    return [
      {
        notification_period: this.getNotificationPeriod(),
        start_date: this.getLocalStartDate(),
        time_zone: this.state.timezone,
      },
    ]
  }

  getResetPeriod = () => {
    if (this.state.resetPeriodSelectValue === 'NONE') {
      return null
    }

    return this.state.resetPeriodSelectValue
  }

  getNotificationType = () => {
    if (this.state.frequencyType === CONTINUOUS_TYPE && this.state.resetPeriodSelectValue !== 'NONE') {
      return PERIODIC_TYPE
    }

    return this.state.frequencyType
  }

  shouldRenderResetPeriodSelector = (prevState) => {
    const state = prevState ?? this.state
    return this.props.conditionType === COMPARE_TYPE // && !state.timeRange // Keep this in case we want to revert
  }

  renderQuery = () => {
    let queryText = this.props.queryResponse?.data?.data?.text
    queryText = queryText[0].toUpperCase() + queryText.substring(1)
    // Keep for now in case we want to display the RT
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

    return <div>Query: {queryText}</div>
  }

  // Reset period selector is only visible for "continuous" type data alerts, not scheduled alerts
  // For scheduled alerts, the reset period will be the same as the check frequency
  getResetPeriodSelectValue = () => {
    const { dataAlert } = this.props
    if (!dataAlert) {
      return this.state.timeRange
    }

    if (dataAlert.notification_type === PERIODIC_TYPE) {
      return undefined
    }

    return RESET_PERIOD_OPTIONS[dataAlert.reset_period]
  }

  scheduleIntervalSelector = () => {
    return (
      <div className='react-autoql-data-alert-frequency-option'>
        <Select
          options={Object.keys(SCHEDULE_INTERVAL_OPTIONS).map((value) => ({
            value,
            label: SCHEDULE_INTERVAL_OPTIONS[value].displayName,
          }))}
          label='Send a Notification'
          value={this.state.resetPeriodSelectValue}
          onChange={(option) => this.setState({ resetPeriodSelectValue: option })}
        />
      </div>
    )
  }

  dayOfWeekSelector = () => {
    return (
      <div className='react-autoql-data-alert-frequency-option'>
        <Select
          value={this.state.weekDaySelectValue}
          onChange={(weekDaySelectValue) => this.setState({ weekDaySelectValue })}
          options={WEEKDAY_NAMES_MON.map((value) => ({
            value,
            label: (
              <span>
                on <strong>{value}</strong>
              </span>
            ),
          }))}
        />
      </div>
    )
  }

  dayOfMonthSelector = () => {
    return (
      <div className='react-autoql-data-alert-frequency-option'>
        <Select
          value={this.state.monthDaySelectValue}
          onChange={(monthDaySelectValue) => this.setState({ monthDaySelectValue })}
          options={Object.keys(MONTH_DAY_SELECT_OPTIONS).map((value) => ({
            value,
            label: MONTH_DAY_SELECT_OPTIONS[value],
          }))}
        />
      </div>
    )
  }

  dayOfYearSelector = () => {
    return (
      <span className='schedule-builder-day-of-year-selector'>
        <div className='react-autoql-data-alert-frequency-option schedule-builder-at-connector'>
          <span>in</span>
        </div>
        <Select
          options={MONTH_NAMES.map((month) => {
            return {
              value: month,
            }
          })}
          value={this.state.monthOfYearSelectValue}
          onChange={(monthOfYearSelectValue) => this.setState({ monthOfYearSelectValue })}
        />
        {this.dayOfMonthSelector()}
      </span>
    )
  }

  dayOfSelector = () => {
    switch (this.state.resetPeriodSelectValue) {
      case 'YEAR': {
        return this.dayOfYearSelector()
      }
      case 'MONTH': {
        return this.dayOfMonthSelector()
      }
      case 'WEEK': {
        return this.dayOfWeekSelector()
      }
    }

    return null
  }

  hourMinSelector = () => {
    return (
      <>
        <div className='react-autoql-data-alert-frequency-option schedule-builder-at-connector'>
          <span>at</span>
        </div>
        <div className='react-autoql-data-alert-frequency-option'>
          <TimePicker
            value={this.state.intervalTimeSelectValue?.value}
            onChange={(timeObj) => this.setState({ intervalTimeSelectValue: timeObj })}
          />
        </div>
      </>
    )
  }

  timezoneSelector = () => {
    return (
      <div className='react-autoql-data-alert-frequency-option schedule-builder-timezone-section'>
        <div>
          <TimezoneSelector
            value={this.state.timezone}
            onChange={(timezone) => this.setState({ timezone })}
            popoverParentElement={this.props.popoverParentElement}
            popoverBoundaryElement={this.props.popoverBoundaryElement}
            label='Time Zone'
          />
        </div>
      </div>
    )
  }

  shouldRenderCheckFrequencySelector = (prevState) => {
    const state = prevState ?? this.state
    return showCheckFrequencySetting(state?.frequencyType)
  }

  checkFrequencySelector = () => {
    if (this.shouldRenderCheckFrequencySelector()) {
      let tooltip =
        'How often should we run the query to check for new data? (You will only be notified if there is new data)'
      if (this.props.conditionType === COMPARE_TYPE) {
        tooltip = `How often should we run the query to check if the conditions are met?`
      }

      const options = CHECK_FREQUENCY_OPTIONS.map((mins, i) => {
        let label = `${CHECK_FREQUENCY_OPTIONS[i]} min${mins > 1 ? 's' : ''}`
        let listLabel = label
        if (mins === 5) {
          listLabel = `${label} (Recommended)`
        }
        return {
          value: i,
          label: <span>{label}</span>,
          listLabel: <span>{listLabel}</span>,
        }
      })

      return (
        <div className='react-autoql-data-alert-frequency-option check-frequency'>
          <Select
            options={options}
            value={this.state.checkFrequencySelectValue}
            label={
              <span>
                Check conditions every <Icon type='info' data-for={this.props.tooltipID} data-tip={tooltip} />
              </span>
            }
            onChange={(value) => this.setState({ checkFrequencySelectValue: value })}
          />
        </div>
      )
    }

    return null
  }

  resetPeriodSelector = () => {
    if (this.shouldRenderResetPeriodSelector()) {
      return (
        <div className='react-autoql-data-alert-frequency-option'>
          <Select
            options={Object.keys(RESET_PERIOD_OPTIONS).map((value) => ({
              value,
              label: RESET_PERIOD_OPTIONS[value].displayName,
            }))}
            label='Send a notification'
            value={this.state.resetPeriodSelectValue}
            onChange={(option) => this.setState({ resetPeriodSelectValue: option })}
          />
        </div>
      )
    }

    return null
  }

  scheduleFrequencyOptions = () => {
    return (
      <div>
        <div className='react-autoql-data-alert-frequency-options-container'>
          {this.scheduleIntervalSelector()}
          {this.dayOfSelector()}
          {this.hourMinSelector()}
          {this.timezoneSelector()}
        </div>
      </div>
    )
  }

  continuousFrequencyOptions = () => {
    return (
      <div className='react-autoql-data-alert-frequency-options-container continuous-alert'>
        {this.checkFrequencySelector()}
        {this.resetPeriodSelector()}
      </div>
    )
  }

  getConditionStatement = (tense) => {
    const { expressionRef } = this.props
    if (expressionRef) {
      return expressionRef.getConditionStatement(tense)
    }

    return 'the Data Alert is triggered'
  }

  frequencyTypeSection = () => {
    if (!this.props.showTypeSelector) {
      return null
    }

    const query =
      this.props.expressionRef?.getFirstQuery() ??
      this.props.queryResponse?.data?.data?.text ??
      this.props.dataAlert?.expression?.[0]?.term_value
    const queryText = query ? <em>"{query}"</em> : 'this query'

    let value = this.state.frequencyType
    if (value === PERIODIC_TYPE) {
      value = CONTINUOUS_TYPE
    }

    return (
      <div className='frequency-type-container'>
        <span>
          {this.props.conditionType === EXISTS_TYPE ? (
            <span>If new data is detected for {queryText},&nbsp;&nbsp;you'll be notified</span>
          ) : (
            <span>If {this.getConditionStatement()},&nbsp;&nbsp;you'll be notified</span>
          )}
          <Select
            options={Object.keys(DATA_ALERT_FREQUENCY_TYPE_OPTIONS).map((key) => ({
              value: key,
              label: DATA_ALERT_FREQUENCY_TYPE_OPTIONS[key]?.label,
              listLabel: DATA_ALERT_FREQUENCY_TYPE_OPTIONS[key]?.listLabel,
            }))}
            value={value}
            onChange={(type) => this.setState({ frequencyType: type })}
            outlined={false}
          />
        </span>
      </div>
    )
  }

  frequencyOptionsSection = () => {
    let content = null

    switch (this.state.frequencyType) {
      case SCHEDULED_TYPE: {
        content = this.scheduleFrequencyOptions()
        break
      }
      case CONTINUOUS_TYPE: {
        content = this.continuousFrequencyOptions()
        break
      }
      case PERIODIC_TYPE: {
        content = this.continuousFrequencyOptions()
        break
      }
    }

    if (!content) {
      return null
    }

    return <div className='frequency-settings-container'>{content}</div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div className='data-alert-schedule-builder-step' data-test='schedule-builder'>
          {this.frequencyTypeSection()}
          {this.frequencyOptionsSection()}
        </div>
      </ErrorBoundary>
    )
  }
}
