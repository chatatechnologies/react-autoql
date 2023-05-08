import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { TimezoneSelector } from '../../TimezoneSelector'
import { getTimeRangeFromRT } from '../../../js/reverseTranslationHelpers'
import { TimePicker } from '../../TimePicker'

import {
  getSupportedConditionTypes,
  getTimeObjFromTimeStamp,
  getWeekdayFromTimeStamp,
  showEvaluationFrequencySetting,
} from '../helpers'
import { MONTH_NAMES, WEEKDAY_NAMES_MON } from '../../../js/Constants'
import {
  CONTINUOUS_TYPE,
  DATA_ALERT_FREQUENCY_TYPE_OPTIONS,
  SCHEDULE_INTERVAL_OPTIONS,
  RESET_PERIOD_OPTIONS,
  EVALUATION_FREQUENCY_OPTIONS,
  MONTH_DAY_SELECT_OPTIONS,
  COMPARE_TYPE,
  EXISTS_TYPE,
  SCHEDULED_TYPE,
  PERIODIC_TYPE,
} from '../DataAlertConstants'

import './ScheduleBuilder.scss'

export default class ScheduleBuilder extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.SUPPORTED_CONDITION_TYPE =
      getSupportedConditionTypes(props.dataAlert?.expression, props.queryResponse)?.[0] ?? EXISTS_TYPE
    this.DEFAULT_EVALUATION_FREQUENCY = 5
    this.DEFAULT_WEEKDAY_SELECT_VALUE = 'Friday'
    this.DEFAULT_MONTH_DAY_SELECT_VALUE = 'LAST'
    this.DEFAULT_MONTH_OF_YEAR_SELECT_VALUE = 'December'
    this.DEFAULT_FREQUENCY_TYPE = SCHEDULED_TYPE
    this.DEFAULT_RESET_PERIOD_SELECT_VALUE = 'MONTH'
    this.DEFAULT_TIME_SELECT_VALUE = {
      ampm: 'pm',
      minute: 0,
      hour: 5,
      hour24: 17,
      value: '5:00pm',
      value24hr: '17:00',
    }

    this.timeRange = getTimeRangeFromRT(props.queryResponse)

    if (props.dataAlert?.reset_period !== undefined) {
      this.timeRange = props.dataAlert.reset_period
    }

    const state = {
      evaluationFrequencySelectValue: this.DEFAULT_EVALUATION_FREQUENCY,
      frequencyType: this.DEFAULT_FREQUENCY_TYPE,
      intervalTimeSelectValue: this.DEFAULT_TIME_SELECT_VALUE,
      weekDaySelectValue: this.DEFAULT_WEEKDAY_SELECT_VALUE,
      monthOfYearSelectValue: this.DEFAULT_MONTH_OF_YEAR_SELECT_VALUE,
      resetPeriodSelectValue: this.timeRange ?? this.DEFAULT_RESET_PERIOD_SELECT_VALUE,
      monthDaySelectValue: this.DEFAULT_MONTH_DAY_SELECT_VALUE,
      timezone: undefined,
    }

    if (props.dataAlert) {
      this.getInitialStateFromDataAlert(props, state)
    }

    this.state = state
  }

  static propTypes = {
    conditionType: PropTypes.string,
    showTypeSelector: PropTypes.bool,
    dataAlert: PropTypes.shape({}),
    onChange: PropTypes.func,
    onCompleteChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    conditionType: EXISTS_TYPE,
    showTypeSelector: true,
    dataAlert: undefined,
    onChange: () => {},
    onCompleteChange: () => {},
    onErrorCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.isCompleteChanged()) {
      this.props.onCompleteChange(this.isFormComplete)
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.isCompleteChanged()) {
      this.props.onCompleteChange(this.isFormComplete)
    }

    if (this.props.queryResponse?.data?.data?.text !== prevProps.queryResponse?.data?.data?.text) {
      this.timeRange = getTimeRangeFromRT(props.queryResponse)
    }

    if (this.props.frequencyType !== prevProps.frequencyType) {
      const newState = {}
      this.getInitialStateFromDataAlert(this.props, state)
      this.setState(newState)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  isComplete = () => {
    if (!this._isMounted) {
      return false
    }

    if (this.shouldRenderResetPeriodSelector() && !this.state.resetPeriodSelectValue) {
      return false
    } else if (this.shouldRenderEvaluationFrequencySelector() && !this.state.evaluationFrequencySelectValue) {
      return false
    } else if (this.timePickerRef?._isMounted && !this.timePickerRef.isValid()) {
      return false
    }

    return true
  }

  isCompleteChanged = () => {
    const isFormComplete = this.isComplete()
    if (isFormComplete !== this.isFormComplete) {
      this.isFormComplete = isFormComplete
      return true
    }

    return false
  }

  getInitialStateFromDataAlert = (props, state) => {
    const { dataAlert } = props

    try {
      state.frequencyType = props.frequencyType ?? dataAlert?.notification_type ?? this.DEFAULT_FREQUENCY_TYPE
      state.evaluationFrequencySelectValue = dataAlert?.evaluation_frequency
      state.timezone = dataAlert?.time_zone
      state.resetPeriodSelectValue = dataAlert?.reset_period

      if (
        !state.resetPeriodSelectValue &&
        state.frequencyType !== SCHEDULED_TYPE &&
        this.SUPPORTED_CONDITION_TYPE === COMPARE_TYPE
      ) {
        // We don't want to support null reset_periods for compare type data alerts
        // To avoid continuous triggering of the alert. Use default value in this case
        state.resetPeriodSelectValue = this.timeRange ?? this.DEFAULT_RESET_PERIOD_SELECT_VALUE
      }

      if (state.resetPeriodSelectValue === null) {
        state.resetPeriodSelectValue = 'NONE'
      }

      if (state.frequencyType === SCHEDULED_TYPE) {
        const schedules = dataAlert?.schedules
        const schedulePeriod = schedules?.[0]?.notification_period ?? this.DEFAULT_RESET_PERIOD_SELECT_VALUE

        state.resetPeriodSelectValue = schedulePeriod
        state.intervalTimeSelectValue =
          getTimeObjFromTimeStamp(schedules?.[0]?.start_date, dataAlert?.time_zone) ?? this.DEFAULT_TIME_SELECT_VALUE

        if (schedulePeriod === 'MONTH_LAST_DAY') {
          state.resetPeriodSelectValue = 'MONTH'
          state.monthDaySelectValue = 'LAST'
        } else if (schedulePeriod === 'MONTH') {
          state.monthDaySelectValue = 'FIRST' // For now. Later we want to add month day numbers
        } else if (schedulePeriod === 'WEEK' && dataAlert.schedules.length === 7) {
          state.resetPeriodSelectValue = 'DAY'
        } else if (schedulePeriod === 'WEEK') {
          state.weekDaySelectValue = getWeekdayFromTimeStamp(schedules[0]?.start_date, dataAlert?.time_zone)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  getData = () => {
    const notificationType = this.getNotificationType()
    const resetPeriod = this.state.frequencyType !== SCHEDULED_TYPE ? this.getResetPeriod() : undefined
    const schedules = this.getSchedules()
    const timezone = this.state.timezone
    const evaluationFrequency = this.state.evaluationFrequencySelectValue

    return {
      notificationType,
      evaluationFrequency,
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

  shouldRenderResetPeriodSelector = () => {
    return this.state.frequencyType !== SCHEDULED_TYPE && this.SUPPORTED_CONDITION_TYPE === COMPARE_TYPE
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
      return this.timeRange
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
            ref={(r) => (this.timePickerRef = r)}
            value={this.state.intervalTimeSelectValue?.value}
            onChange={(timeObj) => {
              this.setState({ intervalTimeSelectValue: timeObj })
            }}
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

  shouldRenderEvaluationFrequencySelector = () => {
    return showEvaluationFrequencySetting(this.state?.frequencyType)
  }

  evaluationFrequencySelector = () => {
    if (this.shouldRenderEvaluationFrequencySelector()) {
      let tooltip =
        'How often should we run the query to check for new data? (You will only be notified if there is new data)'
      if (this.SUPPORTED_CONDITION_TYPE === COMPARE_TYPE) {
        tooltip = `How often should we run the query to check if the conditions are met?`
      }

      const options = Object.keys(EVALUATION_FREQUENCY_OPTIONS).map((value) => {
        const freqObj = EVALUATION_FREQUENCY_OPTIONS[value]
        return {
          value: freqObj?.value,
          label: freqObj?.label,
          listLabel: freqObj?.listLabel,
        }
      })

      return (
        <div className='react-autoql-data-alert-frequency-option check-frequency'>
          <Select
            options={options}
            value={this.state.evaluationFrequencySelectValue}
            label={
              <span>
                Check conditions every{' '}
                <Icon
                  className='react-autoql-info-tooltip'
                  type='info'
                  data-for={this.props.tooltipID}
                  data-tip={tooltip}
                />
              </span>
            }
            onChange={(value) => this.setState({ evaluationFrequencySelectValue: value })}
          />
        </div>
      )
    }

    return null
  }

  resetPeriodSelector = () => {
    if (!this.shouldRenderResetPeriodSelector()) {
      return null
    }

    return (
      <div className='react-autoql-data-alert-frequency-option'>
        <Select
          options={Object.keys(RESET_PERIOD_OPTIONS)
            .map((value) => ({
              value,
              label: RESET_PERIOD_OPTIONS[value].displayName,
            }))
            .filter((option) => (option?.value === 'NONE' ? this.SUPPORTED_CONDITION_TYPE === EXISTS_TYPE : true))}
          label='Send a notification'
          value={this.state.resetPeriodSelectValue}
          onChange={(option) => this.setState({ resetPeriodSelectValue: option })}
        />
      </div>
    )
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
        {this.evaluationFrequencySelector()}
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
          <span>If {this.getConditionStatement()},&nbsp;&nbsp;you'll be notified</span>
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
