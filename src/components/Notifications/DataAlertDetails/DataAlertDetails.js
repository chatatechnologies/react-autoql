import React from 'react'
import PropTypes from 'prop-types'
import {
  CONTINUOUS_TYPE,
  PERIODIC_TYPE,
  SCHEDULED_TYPE,
  EXISTS_TYPE,
  QUERY_TERM_TYPE,
  DATA_ALERT_OPERATORS,
  DATA_ALERT_ENABLED_STATUSES,
  DATA_ALERT_STATUSES,
  RESET_PERIOD_OPTIONS,
  SCHEDULE_FREQUENCY_OPTIONS,
  formatNextScheduleDate,
  formatResetDate,
  resetDateIsFuture,
  DEFAULT_EVALUATION_FREQUENCY,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import './DataAlertDetails.scss'

const Section = ({ title, children }) => (
  <div className='react-autoql-data-alert-details-section'>
    <div className='react-autoql-data-alert-details-section-title'>{title}</div>
    {children}
  </div>
)

const Field = ({ label, value, note }) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return (
    <div className='react-autoql-data-alert-details-field'>
      <div className='react-autoql-data-alert-details-field-label'>{label}</div>
      <div className='react-autoql-data-alert-details-field-value'>
        {value}
        {!!note && <span className='react-autoql-data-alert-details-field-note'>{note}</span>}
      </div>
    </div>
  )
}

const ERROR_STATUSES = [
  DATA_ALERT_STATUSES.GENERAL_ERROR,
  DATA_ALERT_STATUSES.EVALUATION_ERROR,
  DATA_ALERT_STATUSES.UNRECOVERABLE,
]

const Pill = ({ children, type }) => (
  <span className={`react-autoql-data-alert-details-pill react-autoql-data-alert-details-pill-${type}`}>
    {children}
  </span>
)

export default class DataAlertDetails extends React.Component {
  static propTypes = {
    currentDataAlert: PropTypes.shape({}),
    categories: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    currentDataAlert: undefined,
    categories: [],
  }

  /**
   * The saved alert stores the raw `compare_column` (eg.
   * `sum(public.all_sales_fact.sales_dollar_amount)`), but the edit view shows the column's
   * `display_name` from the query response. We can't fetch that without running the query, so
   * derive a readable label from the stored name instead. Anything that isn't a plain identifier
   * or a single aggregation of one is left exactly as it was saved.
   */
  formatColumnName = (name) => {
    if (!name || typeof name !== 'string') {
      return name
    }

    const titlelize = (str) =>
      str
        .split(/[_\s]+/)
        .filter((word) => !!word)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    const lastSegment = (str) => str.split('.').pop()

    const aggregation = name.match(/^(sum|avg|median|min|max|count|distinct|stddev)\(([A-Za-z0-9_.]+)\)$/i)
    if (aggregation) {
      return `${titlelize(aggregation[1])} of ${titlelize(lastSegment(aggregation[2]))}`
    }

    if (/^[A-Za-z0-9_.]+$/.test(name)) {
      return titlelize(lastSegment(name))
    }

    return name
  }

  getFirstTerm = () => this.props.currentDataAlert?.expression?.[0]

  getSecondTerm = () => this.props.currentDataAlert?.expression?.[1]

  isScheduled = () => this.props.currentDataAlert?.notification_type === SCHEDULED_TYPE

  /**
   * Mirrors the state column in the Data Alert list so the two never disagree:
   * an errored alert, one that has already fired this cycle, then on/off.
   */
  getStatus = () => {
    const { currentDataAlert } = this.props
    const status = currentDataAlert?.status

    if (ERROR_STATUSES.includes(status)) {
      return { label: 'Error', type: 'error' }
    }

    if (currentDataAlert?.reset_date && resetDateIsFuture(currentDataAlert)) {
      return { label: 'Triggered', type: 'triggered' }
    }

    if (DATA_ALERT_ENABLED_STATUSES.includes(status)) {
      return { label: 'Active', type: 'active' }
    }

    return { label: 'Inactive', type: 'inactive' }
  }

  renderStatusStrip = () => {
    const status = this.getStatus()
    const category = this.getCategoryName()

    return (
      <div className='react-autoql-data-alert-details-status-strip'>
        <Pill type={status.type}>
          <span className='react-autoql-data-alert-details-bead' />
          {status.label}
        </Pill>
        <Pill type='type'>
          <Icon type={this.isScheduled() ? 'calendar' : 'live'} />
          {this.isScheduled() ? 'Scheduled' : 'Live'}
        </Pill>
        {!!category && <Pill type='category'>{category}</Pill>}
      </div>
    )
  }

  renderQueryText = () => {
    const queryText = this.getFirstTerm()?.term_value

    if (!queryText) {
      return (
        <div className='react-autoql-data-alert-details-query react-autoql-data-alert-details-query-empty'>
          <Icon type='warning' warning />
          <span>Unable to display this query. This Data Alert may be part of an older system.</span>
        </div>
      )
    }

    return (
      <div className='react-autoql-data-alert-details-query'>
        <Icon type='search' />
        <span>"{queryText}"</span>
      </div>
    )
  }

  renderFilters = () => {
    const term = this.getFirstTerm()
    const lockedFilters = term?.session_filter_locks ?? []
    const tableFilters = term?.filters ?? []

    if (!lockedFilters.length && !tableFilters.length) {
      return null
    }

    return (
      <div className='react-autoql-data-alert-details-filters'>
        {lockedFilters.map((filter, i) => (
          <div className='react-autoql-data-alert-details-filter' key={`locked-filter-${i}`}>
            <Icon type='lock' />
            <span>
              {filter.show_message ?? filter.key}: <strong>{filter.displayValue ?? filter.value}</strong>
            </span>
          </div>
        ))}
        {tableFilters.map((filter, i) => (
          <div className='react-autoql-data-alert-details-filter' key={`table-filter-${i}`}>
            <Icon type='filter' />
            <span>
              {filter.columnName ?? filter.name}: <strong>{filter.displayValue ?? filter.value}</strong>
            </span>
          </div>
        ))}
      </div>
    )
  }

  renderCondition = () => {
    const term = this.getFirstTerm()

    if (!term || term.condition === EXISTS_TYPE) {
      return (
        <div className='react-autoql-data-alert-details-condition'>
          Notify when <strong>new data</strong> is detected for this query.
        </div>
      )
    }

    const operator = DATA_ALERT_OPERATORS[term.condition]
    const secondTerm = this.getSecondTerm()
    const compareValue = secondTerm?.term_value

    if (!operator || compareValue === undefined || compareValue === null) {
      return (
        <div className='react-autoql-data-alert-details-condition'>
          Notify when the conditions for this query are met.
        </div>
      )
    }

    // A second term can be another query rather than a number - quote it so it reads as one
    const compareText = secondTerm?.term_type === QUERY_TERM_TYPE ? `"${compareValue}"` : compareValue

    return (
      <div className='react-autoql-data-alert-details-condition'>
        Notify when <strong>{this.formatColumnName(term.compare_column) ?? 'the result'}</strong>{' '}
        {operator.conditionText} <strong>{compareText}</strong>
      </div>
    )
  }

  renderFrequencyValue = () => {
    const { currentDataAlert } = this.props

    if (this.isScheduled()) {
      const schedules = currentDataAlert?.schedules
      if (schedules?.length === 7) {
        return SCHEDULE_FREQUENCY_OPTIONS['DAY']?.displayText
      }
      return SCHEDULE_FREQUENCY_OPTIONS[schedules?.[0]?.notification_period]?.displayText
    }

    const frequency = currentDataAlert?.evaluation_frequency ?? DEFAULT_EVALUATION_FREQUENCY
    return frequency === 1 ? 'Every minute' : `Every ${frequency} minutes`
  }

  renderResetPeriodValue = () => {
    const { currentDataAlert } = this.props

    if (this.isScheduled()) {
      return null
    }

    if (!currentDataAlert?.reset_period) {
      return 'Continuous'
    }

    return RESET_PERIOD_OPTIONS[currentDataAlert.reset_period]?.displayText
  }

  renderResetPeriodNote = () => {
    if (this.isScheduled() || this.props.currentDataAlert?.reset_period) {
      return null
    }

    return 'Notifies every time'
  }

  renderNextCheckValue = () => {
    const { currentDataAlert } = this.props

    if (this.isScheduled()) {
      return formatNextScheduleDate(currentDataAlert?.schedules, true)
    }

    // Mirrors DataAlertRow.renderNextCheck: a past reset date means the next check is simply the
    // next evaluation, not the date that has already gone by.
    if (!currentDataAlert?.reset_date || !resetDateIsFuture(currentDataAlert)) {
      const frequency = currentDataAlert?.evaluation_frequency ?? DEFAULT_EVALUATION_FREQUENCY
      return `< ${frequency}m`
    }

    return formatResetDate(currentDataAlert)
  }

  renderNextCheckNote = () => {
    const { currentDataAlert } = this.props

    if (this.isScheduled() || !currentDataAlert?.reset_date || !resetDateIsFuture(currentDataAlert)) {
      return null
    }

    return 'Already triggered this cycle - paused until then'
  }

  getCategoryName = () => {
    const { label } = this.props.currentDataAlert ?? {}

    if (!label?.id) {
      return label?.name
    }

    return this.props.categories?.find((c) => c.id === label.id)?.name ?? label.name
  }

  renderAppearanceSection = () => {
    const { message, description } = this.props.currentDataAlert

    if (!message && !description) {
      return null
    }

    return (
      <Section title='Notification'>
        <div className='react-autoql-data-alert-details-fields'>
          <Field label='Message' value={message} />
          <Field label='Description' value={description} />
        </div>
      </Section>
    )
  }

  render = () => {
    const { currentDataAlert } = this.props

    if (!currentDataAlert) {
      return null
    }

    const notificationType = currentDataAlert.notification_type
    const isLive = notificationType === CONTINUOUS_TYPE || notificationType === PERIODIC_TYPE

    return (
      <ErrorBoundary>
        <div className='react-autoql-data-alert-details'>
          {this.renderStatusStrip()}

          <Section title='Rule'>
            <div className='react-autoql-data-alert-details-rule'>
              {this.renderQueryText()}
              {this.renderFilters()}
              {this.renderCondition()}
            </div>
          </Section>

          <Section title='Timing'>
            <div className='react-autoql-data-alert-details-fields'>
              <Field label={isLive ? 'Evaluation' : 'Schedule'} value={this.renderFrequencyValue()} />
              {isLive && (
                <Field label='Reset Period' value={this.renderResetPeriodValue()} note={this.renderResetPeriodNote()} />
              )}
              <Field label='Next Check' value={this.renderNextCheckValue()} note={this.renderNextCheckNote()} />
            </div>
          </Section>

          {this.renderAppearanceSection()}
        </div>
      </ErrorBoundary>
    )
  }
}
