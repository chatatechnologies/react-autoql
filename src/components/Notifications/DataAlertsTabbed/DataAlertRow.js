import React from 'react'
import PropTypes from 'prop-types'

import {
  CONTINUOUS_TYPE,
  CUSTOM_TYPE,
  DEFAULT_EVALUATION_FREQUENCY,
  PERIODIC_TYPE,
  RESET_PERIOD_OPTIONS,
  SCHEDULED_TYPE,
  SCHEDULE_FREQUENCY_OPTIONS,
  DATA_ALERT_ENABLED_STATUSES,
  initializeAlert,
  updateDataAlertStatus,
  formatNextScheduleDate,
  formatResetDate,
  getAuthentication,
  DATA_ALERT_STATUSES,
  resetDateIsFuture,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Switch } from '../../Switch'
import { authenticationType } from '../../../props/types'

export default class DataAlertRow extends React.Component {
  static propTypes = {
    dataAlert: PropTypes.shape({}).isRequired,
    authentication: authenticationType,
    tooltipID: PropTypes.string,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onDataAlertStatusChange: PropTypes.func,
    openEditModal: PropTypes.func,
    openCustomFilteredAlertModal: PropTypes.func,
    onInitialize: PropTypes.func,
    shouldRenderCreateCustomFilteredAlert: PropTypes.bool,
    showActionsColumn: PropTypes.bool,
  }

  static defaultProps = {
    tooltipID: undefined,
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onDeleteClick: () => {},
    onDataAlertStatusChange: () => {},
    openEditModal: () => {},
    openCustomFilteredAlertModal: () => {},
    onInitialize: () => {},
    shouldRenderCreateCustomFilteredAlert: false,
    showActionsColumn: true,
  }

  state = {
    status: this.props.dataAlert?.status,
    title: this.props.dataAlert?.title,
    isInitializing: false,
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.dataAlert?.status && this.props.dataAlert.status !== prevProps.dataAlert?.status) {
      this.setState({ status: this.props.dataAlert.status })
    }
    if (this.props.dataAlert?.title && this.props.dataAlert.title !== prevProps.dataAlert?.title) {
      this.setState({ title: this.props.dataAlert.title })
    }
  }

  hasError = () =>
    ['GENERAL_ERROR', 'EVALUATION_ERROR', 'UNRECOVERABLE'].includes(this.state.status)

  isEnabled = () => DATA_ALERT_ENABLED_STATUSES.includes(this.state.status)
  isDisabled = () => this.state.status === DATA_ALERT_STATUSES.UNRECOVERABLE

  getDataAlertObj = () => ({
    ...this.props.dataAlert,
    status: this.state.status,
    title: this.state.title,
  })

  onInitializeClick = (e) => {
    e.stopPropagation()
    this.setState({ isInitializing: true })
    initializeAlert({ id: this.props.dataAlert?.id, ...getAuthentication(this.props.authentication) }).finally(() => {
      this.setState({ isInitializing: false })
      this.props.onInitialize(this.props.dataAlert)
    })
  }

  onDeleteClick = (e) => {
    e.stopPropagation()
    this.props.onDeleteClick()
  }

  onEditClick = (e, step) => {
    e.stopPropagation()
    const { dataAlert } = this.props
    if (dataAlert.type !== CUSTOM_TYPE) return
    if (dataAlert?.project?.id === 'composite') {
      this.props.openCustomFilteredAlertModal(this.getDataAlertObj())
    } else {
      this.props.openEditModal(this.getDataAlertObj(), step)
    }
  }

  onCustomFilteredAlertClick = (e) => {
    e.stopPropagation()
    this.props.openCustomFilteredAlertModal(this.getDataAlertObj())
  }

  onEnableSwitchChange = (checked) => {
    const previousStatus = this.state.status
    const newStatus = checked ? 'ACTIVE' : 'INACTIVE'
    this.setState({ status: newStatus })
    updateDataAlertStatus({
      ...getAuthentication(this.props.authentication),
      dataAlertId: this.props.dataAlert.id,
      type: this.props.dataAlert.type,
      status: newStatus,
    })
      .then(() => {
        this.props.onDataAlertStatusChange()
        this.props.onSuccessAlert()
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({ status: previousStatus })
      })
  }

  renderFrequency = () => {
    const { dataAlert } = this.props
    const frequencyType = dataAlert?.notification_type
    if (frequencyType === SCHEDULED_TYPE) {
      const schedules = dataAlert?.schedules
      if (schedules?.length === 7) return SCHEDULE_FREQUENCY_OPTIONS['DAY']?.displayText
      return SCHEDULE_FREQUENCY_OPTIONS[schedules?.[0]?.notification_period]?.displayText ?? '-'
    }
    if (frequencyType === CONTINUOUS_TYPE || frequencyType === PERIODIC_TYPE) {
      if (!dataAlert.reset_period) return 'Continuous'
      return RESET_PERIOD_OPTIONS[dataAlert.reset_period]?.displayText ?? '-'
    }
    return '-'
  }

  renderNextCheck = () => {
    const { dataAlert } = this.props
    if (!dataAlert || this.hasError()) return '-'
    if (dataAlert.notification_type === SCHEDULED_TYPE) {
      const next = formatNextScheduleDate(dataAlert.schedules, true)
      return next ?? '-'
    }
    if (!dataAlert.reset_date || !resetDateIsFuture(dataAlert)) {
      const freq = dataAlert.evaluation_frequency ?? DEFAULT_EVALUATION_FREQUENCY
      return `< ${freq}m`
    }
    return formatResetDate(dataAlert, true)
  }

  renderState = () => {
    const { dataAlert } = this.props
    const isEnabled = this.isEnabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const status = isEnabled ? 'data-alert-on' : 'data-alert-off'
    const resetDateFormatted = formatResetDate(dataAlert)

    if (this.hasError()) {
      return (
        <div
          className={`data-alert-state data-alert-warning ${status}`}
          data-tooltip-id={this.props.tooltipID}
          data-tooltip-html={
            isCustom
              ? 'There was a problem with this Data Alert. Try restarting the Alert by clicking the <em>refresh</em> button. If the problem persists, please contact your system administrator.'
              : 'There was a problem with this Data Alert. For more information, please contact your system administrator.'
          }
        >
          <Icon type='warning-triangle' />
          <span>Error</span>
          {isCustom && (
            <Icon
              type='refresh'
              className='data-alert-row-state-action-btn'
              data-tooltip-id={this.props.tooltipID}
              onClick={this.onInitializeClick}
              spinning={this.state.isInitializing}
              disabled={this.state.isInitializing}
            />
          )}
        </div>
      )
    }

    if (dataAlert.reset_date && resetDateIsFuture(dataAlert)) {
      return (
        <div
          className={`data-alert-state data-alert-triggered ${status}`}
          data-tooltip-html={`This Alert has been triggered for this cycle. You will not receive notifications until the start of the next cycle, ${resetDateFormatted}.<br/>You can edit this in the <em>Data Alert Settings</em>`}
          data-tooltip-id={this.props.tooltipID}
        >
          <Icon type='lightning' />
          <span>Triggered</span>
          {isCustom && (
            <Icon
              type='refresh'
              className='data-alert-row-state-action-btn'
              data-tooltip-id={this.props.tooltipID}
              data-tooltip-content='Restart Alert cycle'
              onClick={this.onInitializeClick}
              spinning={this.state.isInitializing}
              disabled={this.state.isInitializing}
            />
          )}
        </div>
      )
    }

    if (this.state.status === 'ACTIVE' && dataAlert.notification_type === SCHEDULED_TYPE) {
      const nextScheduledDate = formatNextScheduleDate(dataAlert.schedules)
      const tooltip = nextScheduledDate
        ? `This Alert runs on a schedule - a notification is scheduled for ${nextScheduledDate}.`
        : 'This Alert runs on a schedule'
      return (
        <div
          className={`data-alert-state data-alert-scheduled ${status}`}
          data-tooltip-html={tooltip}
          data-tooltip-id={this.props.tooltipID}
        >
          <Icon type='calendar' />
          <span>Scheduled</span>
        </div>
      )
    }

    if (isEnabled) {
      return (
        <div
          className={`data-alert-state data-alert-active ${status}`}
          data-tooltip-content='This Alert is live - Whenever the conditions are met, you will be notified.'
          data-tooltip-id={this.props.tooltipID}
        >
          <Icon className='react-autoql-icon-filled' type='live' />
          <span>Live</span>
        </div>
      )
    }

    return (
      <div
        className={`data-alert-state data-alert-ready ${status}`}
        data-tooltip-html='This Alert is ready to go live - you will start receiving notifications once you set the Alert Status to <em>Active</em>.'
        data-tooltip-id={this.props.tooltipID}
      >
        <Icon type='check' />
        <span>Ready</span>
      </div>
    )
  }

  renderActions = () => {
    const { dataAlert } = this.props
    const isCustom = dataAlert.type === CUSTOM_TYPE
    return (
      <>
        {isCustom && (
          <span
            className='data-alert-action-btn'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Open Data Alert settings'
          >
            <Icon type='settings' onClick={this.onEditClick} />
          </span>
        )}
        {isCustom && (
          <span
            className='data-alert-action-btn data-alert-action-btn-delete'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Delete Data Alert'
          >
            <Icon type='trash' onClick={this.onDeleteClick} />
          </span>
        )}
        {this.props.shouldRenderCreateCustomFilteredAlert && (
          <span
            className='data-alert-action-btn'
            data-tooltip-id={this.props.tooltipID}
            data-tooltip-content='Create Custom Filtered Alert'
          >
            <Icon type='layers-plus' onClick={this.onCustomFilteredAlertClick} />
          </span>
        )}
      </>
    )
  }

  renderMobileCard = () => {
    const { dataAlert, showActionsColumn } = this.props
    const isEnabled = this.isEnabled()
    const isDisabled = this.isDisabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const isIDLEComposite = dataAlert.status === 'IDLE' && dataAlert.evaluation_mode === 'COMPOSITE'

    return (
      <div
        className={`data-alert-card${isEnabled ? ' data-alert-enabled' : ' data-alert-disabled'}${isCustom ? ' data-alert-row-clickable' : ''}`}
        onClick={isCustom ? this.onEditClick : undefined}
      >
        <div className='data-alert-card-header'>
          <div className='data-alert-card-title-wrap'>
            <span className='data-alert-name-text'>{this.state.title}</span>
            {!!dataAlert.message && (
              <span className='data-alert-description-text'>{dataAlert.message}</span>
            )}
          </div>
          {showActionsColumn && (
            <div className='data-alert-card-actions' onClick={(e) => e.stopPropagation()}>
              {this.renderActions()}
            </div>
          )}
        </div>

        <div className='data-alert-card-meta'>
          <div className='data-alert-card-meta-row'>
            <span className='data-alert-card-meta-label'>State</span>
            {this.renderState()}
          </div>
          <div className='data-alert-card-meta-row'>
            <span className='data-alert-card-meta-label'>Frequency</span>
            <span>{this.renderFrequency()}</span>
          </div>
          <div className='data-alert-card-meta-row'>
            <span className='data-alert-card-meta-label'>Next check</span>
            <span>{this.renderNextCheck()}</span>
          </div>
        </div>

        <div className='data-alert-card-footer' onClick={(e) => e.stopPropagation()}>
          <Switch
            disabled={isDisabled || isIDLEComposite}
            checked={isEnabled || isIDLEComposite}
            className='react-autoql-notification-enable-checkbox'
            onChange={this.onEnableSwitchChange}
            onText='Active'
            offText='Inactive'
            data-tooltip-content={
              isEnabled ? 'Active' : isIDLEComposite ? 'To disable this alert, please disable its base alert.' : 'Inactive'
            }
            data-tooltip-id={this.props.tooltipID}
          />
        </div>
      </div>
    )
  }

  render() {
    const { dataAlert, showActionsColumn } = this.props
    const isEnabled = this.isEnabled()
    const isDisabled = this.isDisabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const isIDLEComposite = dataAlert.status === 'IDLE' && dataAlert.evaluation_mode === 'COMPOSITE'

    return (
      <>
      <div
        className={`data-alert-table-row${isEnabled ? ' data-alert-enabled' : ' data-alert-disabled'}${isCustom ? ' data-alert-row-clickable' : ''}${!showActionsColumn ? ' no-actions-column' : ''}`}
        onClick={isCustom ? this.onEditClick : undefined}
      >
        <div className='data-alert-table-cell data-alert-cell-name'>
          <span className='data-alert-name-text'>{this.state.title}</span>
          {!!dataAlert.message && (
            <span className='data-alert-description-text'>{dataAlert.message}</span>
          )}
        </div>

        <div className='data-alert-table-cell data-alert-cell-frequency'>
          {this.renderFrequency()}
        </div>

        <div className='data-alert-table-cell data-alert-cell-state'>
          {this.renderState()}
        </div>

        <div className='data-alert-table-cell data-alert-cell-next-check'>
          {this.renderNextCheck()}
        </div>

        <div
          className='data-alert-table-cell data-alert-cell-status'
          data-tooltip-content={
            isEnabled ? 'Active' : isIDLEComposite ? 'To disable this alert, please disable its base alert.' : 'Inactive'
          }
          data-tooltip-id={this.props.tooltipID}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            disabled={isDisabled || isIDLEComposite}
            checked={isEnabled || isIDLEComposite}
            className='react-autoql-notification-enable-checkbox'
            onChange={this.onEnableSwitchChange}
            onText='Active'
            offText='Inactive'
          />
        </div>

        {showActionsColumn && (
          <div className='data-alert-table-cell data-alert-cell-actions' onClick={(e) => e.stopPropagation()}>
            {this.renderActions()}
          </div>
        )}
      </div>
      {this.renderMobileCard()}
    </>
  )
  }
}
