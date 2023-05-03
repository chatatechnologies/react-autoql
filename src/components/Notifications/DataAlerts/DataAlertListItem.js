import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'
import { Switch } from '../../Switch'
import { hideTooltips } from '../../Tooltip'

import { CUSTOM_TYPE, DEFAULT_CHECK_FREQUENCY, PERIODIC_TYPE, SCHEDULED_TYPE } from '../DataAlertConstants'

import { initializeAlert, updateDataAlertStatus } from '../../../js/notificationService'
import { formatNextScheduleDate, formatResetDate, resetDateIsFuture } from '../helpers'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './DataAlerts.scss'

export default class DataAlertListItem extends React.Component {
  constructor(props) {
    super(props)

    this.ACTION_HIDDEN_CLASS = 'react-autoql-notification-action-hidden'

    this.state = {
      status: props.dataAlert?.status,
      title: props.dataAlert?.title,
      message: props.dataAlert?.message,
      isInitializing: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onDataAlertStatusChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onDeleteClick: () => {},
    onDataAlertStatusChange: () => {},
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.dataAlert?.status && this.props.dataAlert.status !== prevProps.dataAlert?.status) {
      this.setState({ status: this.props.dataAlert.status })
    }
  }

  getDataAlertObj = () => {
    return {
      ...this.props.dataAlert,
      status: this.state.status,
      title: this.state.title,
      message: this.state.message,
    }
  }

  hasError = () => {
    return (
      this.state.status === 'GENERAL_ERROR' ||
      this.state.status === 'EVALUATION_ERROR' ||
      this.state.status === 'DATA_RETURN_ERROR'
    )
  }

  isEnabled = () => {
    return this.state.status === 'ACTIVE' || this.state.status === 'WAITING'
  }

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

    if (this.props.dataAlert.type === CUSTOM_TYPE) {
      this.openEditModal(step)
    }
  }

  openEditModal = (step) => {
    const dataAlert = this.getDataAlertObj()
    this.props.openEditModal(dataAlert, step)
  }

  onEnableSwitchChange = (checked) => {
    hideTooltips()

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
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(new Error('Something went wrong. Please try again.'))
        this.setState({ status: previousStatus })
      })
  }

  getCycleFromResetPeriod = (resetPeriod) => {
    switch (resetPeriod) {
      case 'DAY': {
        return 'Daily'
      }
      case 'WEEK': {
        return 'Weekly'
      }
      case 'MONTH': {
        return 'Monthly'
      }
      case 'YEAR': {
        return 'Yearly'
      }
      default: {
        return '-'
      }
    }
  }

  renderDataAlertCycle = () => {
    const frequencyType = this.props.dataAlert?.notification_type

    let cycle = '-'

    if (frequencyType === SCHEDULED_TYPE) {
      if (this.props.dataAlert?.schedules?.length === 7) {
        cycle = 'Daily'
      } else {
        cycle = this.getCycleFromResetPeriod(this.props.dataAlert?.schedules?.[0]?.notification_period)
      }
    } else if (frequencyType === PERIODIC_TYPE && this.props.dataAlert?.reset_period) {
      cycle = this.getCycleFromResetPeriod(this.props.dataAlert.reset_period)
    }

    return cycle
  }

  renderDataAlertState = () => {
    const { dataAlert } = this.props
    const hasError = this.hasError()
    const isEnabled = this.isEnabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const status = isEnabled ? 'data-alert-on' : 'data-alert-off'
    const isTriggered = !!dataAlert.reset_date
    const resetDateFormatted = formatResetDate(dataAlert)
    const nextScheduledDate = formatNextScheduleDate(dataAlert.schedules)

    // Check error status first. We always want to show the user if the Data Alert is in an error state
    if (hasError) {
      return (
        <div
          className={`data-alert-state data-alert-error ${status}`}
          data-for={this.props.tooltipID}
          data-tip={
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
              className='react-autoql-notification-state-action-btn'
              data-for={this.props.tooltipID}
              onClick={this.onInitializeClick}
              spinning={this.state.isInitializing}
              disabled={this.state.isInitializing}
            />
          )}
          {/* {isCustom && (
            <Button
              type='default'
              className='react-autoql-re-initialize-btn'
              icon='tool'
              onClick={this.onInitializeClick}
              size='small'
              loading={this.state.isInitializing}
            >
              Repair
            </Button>
          )} */}
        </div>
      )
    }

    if (dataAlert.reset_date && resetDateIsFuture(dataAlert)) {
      return (
        <div className={`data-alert-state data-alert-triggered ${status}`}>
          <span
            data-tip={`This Alert has been triggered for this cycle. You will not receive notifications until the start of the next cycle, ${resetDateFormatted}.<br/>You can edit this in the <em>Data Alert Settings</em>`}
            data-for={this.props.tooltipID}
          >
            <Icon type='lightning' />
            <span>Triggered</span>
          </span>
          {isCustom && (
            <Icon
              type='refresh'
              className='react-autoql-notification-state-action-btn'
              data-for={this.props.tooltipID}
              data-tip={
                isTriggered
                  ? 'Restart Alert cycle (This will allow your Alert to be triggered again in the current frequency cycle)'
                  : ''
              }
              onClick={this.onInitializeClick}
              spinning={this.state.isInitializing}
              disabled={this.state.isInitializing}
            />
          )}
        </div>
      )
    }

    if (dataAlert.status === 'ACTIVE' && dataAlert.notification_type === SCHEDULED_TYPE) {
      let tooltip = 'This Alert runs on a schedule'
      if (nextScheduledDate) {
        tooltip = `${tooltip} - a notification is scheduled for ${nextScheduledDate}. If your data hasn't changed by then, you will not receive a notification.`
      }

      return (
        <div
          className={`data-alert-state data-alert-scheduled ${status}`}
          data-tip={tooltip}
          data-for={this.props.tooltipID}
        >
          <Icon type='calendar' />
          <span>Scheduled</span>
        </div>
      )
    }

    // if (dataAlert.notification_type === SCHEDULED_TYPE) {
    //   return (
    //     <div
    //       className={`data-alert-state data-alert-paused ${status}`}
    //       data-tip={`This Data Alert is not scheduled to run right now. To resume the schedule, please set the Data Alert status to <em>Active</em>.`}
    //       data-for={this.props.tooltipID}
    //     >
    //       <Icon type='paused' />
    //       <span>Paused</span>
    //     </div>
    //   )
    // }

    if (isEnabled) {
      return (
        <div
          className={`data-alert-state data-alert-active ${status}`}
          data-tip='This Alert is live - Whenever the conditions are met, you will be notified.'
          data-for={this.props.tooltipID}
        >
          <Icon className='react-autoql-icon-filled' type='live' />
          <span>Live</span>
        </div>
      )
    }

    return (
      <div
        className={`data-alert-state data-alert-ready ${status}`}
        data-tip='This Alert is ready to go live - you will start receiving notifications once you set the Alert Status to <em>Active</em>.'
        data-for={this.props.tooltipID}
      >
        <Icon type='check' />
        <span>Ready</span>
      </div>
    )
  }

  renderDataAlertCycleStart = () => {
    const { dataAlert } = this.props

    if (!dataAlert || this.hasError()) {
      return '-'
    }

    if (dataAlert.notification_type === SCHEDULED_TYPE) {
      const nextScheduledDate = formatNextScheduleDate(dataAlert.schedules, true)
      if (!nextScheduledDate) {
        return '-'
      }
      return <span>{nextScheduledDate}</span>
    }

    if (!dataAlert.reset_date || !resetDateIsFuture(dataAlert)) {
      if (!this.isEnabled()) {
        return '-'
      }

      const checkFrequency = dataAlert.check_frequency ?? DEFAULT_CHECK_FREQUENCY
      return `< ${checkFrequency}m`
    }

    return <span>{formatResetDate(dataAlert, true)}</span>
  }

  render = () => {
    const { dataAlert } = this.props

    const isEnabled = this.isEnabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE

    return (
      <div
        className={`react-autoql-notification-setting-item
          ${this.props.showHeader ? 'react-autoql-dataalert-show-header' : ''}
          ${isEnabled ? 'data-alert-enabled' : 'data-alert-disabled'}
          ${dataAlert.type}`}
      >
        <div className='react-autoql-notification-setting-item-header'>
          <div className='react-autoql-notification-setting-display-name react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Data Alert Name</span>
            </div>
            <div className='data-alert-section-content'>
              <span className='react-autoql-notification-setting-display-name-title'>
                <span>{this.state.title}</span>
              </span>
            </div>
          </div>
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Frequency</span>
            </div>
            <div className='data-alert-section-content data-alert-section-cycle'>{this.renderDataAlertCycle()}</div>
          </div>
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>State</span>
            </div>
            <div className='data-alert-section-content'>{this.renderDataAlertState()}</div>
          </div>
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Next Check</span>
            </div>
            <div className='data-alert-section-content data-alert-section-cycle-start'>
              {this.renderDataAlertCycleStart()}
            </div>
          </div>
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Notification Status</span>
            </div>
            <div className='data-alert-section-content notification-status'>
              <Switch
                checked={isEnabled}
                className='react-autoql-notification-enable-checkbox'
                onClick={(e) => e.stopPropagation()}
                data-tip={isEnabled ? 'Active' : 'Inactive'}
                data-for={this.props.tooltipID}
                onChange={this.onEnableSwitchChange}
                onText='Active'
                offText='Inactive'
              />
            </div>
          </div>

          {/* Actions */}
          {isCustom && (
            <div className='react-autoql-data-alert-list-item-section'>
              <div className='data-alert-header-item'>
                <span>Actions</span>
              </div>
              <div className='data-alert-section-content'>
                <div className='react-autoql-notification-action-btn'>
                  <Icon
                    type='settings'
                    data-for={this.props.tooltipID}
                    data-tip='Open Data Alert settings'
                    onClick={this.onEditClick}
                  />
                </div>
                <div className='react-autoql-notification-action-btn react-autoql-notification-action-btn-delete'>
                  <Icon
                    type='trash'
                    data-for={this.props.tooltipID}
                    data-tip='Delete Data Alert'
                    onClick={this.onDeleteClick}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
}
