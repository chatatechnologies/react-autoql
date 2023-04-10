import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'
import { Switch } from '../../Switch'
import { hideTooltips } from '../../Tooltip'

import { CONTINUOUS_FREQUENCY, CUSTOM_TYPE, PERIODIC_FREQUENCY, SCHEDULE_FREQUENCY } from '../DataAlertConstants'

import { initializeAlert, updateDataAlertStatus } from '../../../js/notificationService'
import { formatResetDate } from '../helpers'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './DataAlerts.scss'
import { Button } from '../../Button'

export default class DataAlertListItem extends React.Component {
  constructor(props) {
    super(props)

    this.ACTION_HIDDEN_CLASS = 'react-autoql-notification-action-hidden'

    this.state = {
      status: props.dataAlert?.status,
      title: props.dataAlert?.title,
      message: props.dataAlert?.title,
      isDeleteDialogOpen: false,
      isInitializing: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDeleteClick: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
    onAlertInitializationCallback: () => {},
    onSuccessAlert: () => {},
    onDeleteClick: () => {},
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

  onDeleteClick = (e, step) => {
    e.stopPropagation()
    this.props.onDeleteClick(this.props.dataAlert?.id)
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
    }).catch((error) => {
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

    if (frequencyType === PERIODIC_FREQUENCY || frequencyType === SCHEDULE_FREQUENCY) {
      return this.getCycleFromResetPeriod(this.props.dataAlert?.reset_period)
    }

    return '-'
  }

  renderDataAlertState = () => {
    const { dataAlert } = this.props
    const hasError = true // this.hasError()
    const isEnabled = this.isEnabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const status = isEnabled ? 'data-alert-on' : 'data-alert-off'
    const resetDateFormatted = `${formatResetDate(dataAlert)} (${dataAlert.time_zone})`

    // Check error status first. We always want to show the user if the Data Alert is in an error state
    if (hasError) {
      return (
        <div
          className={`data-alert-state data-alert-error ${status}`}
          data-for={this.props.tooltipID}
          data-tip={
            isCustom
              ? 'There was a problem with this Data Alert. If the problem persists after clicking the "repair" button, please contact your system administrator.'
              : 'There was a problem with this Data Alert. For more information, please contact your system administrator.'
          }
        >
          <Icon type='warning-triangle' />
          <span>Error</span>
          {isCustom && (
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
          )}
        </div>
      )
    }

    if (dataAlert.reset_date) {
      return (
        <div
          className={`data-alert-state data-alert-triggered ${status}`}
          data-tip={`This Alert is paused because it has already been triggered [THIS CYCLE]. We will start checking the data again [NEXT CYCLE]. You can change the Alert cycle in the <em>Data Alert Settings</em>`}
          data-for={this.props.tooltipID}
        >
          <Icon onClick={(e) => this.onEditClick(e, 'schedule')} type='lightning' />
          <span>Triggered</span>
        </div>
      )
    }

    if (dataAlert.status === 'ACTIVE' && dataAlert.notification_type === SCHEDULE_FREQUENCY) {
      return (
        <div
          className={`data-alert-state data-alert-scheduled ${status}`}
          data-tip={`This Alert runs on a schedule - a notification is scheduled for ${resetDateFormatted}. If your data hasn't changed by then, you will not receive a notification.`}
          data-for={this.props.tooltipID}
        >
          <Icon type='calendar' />
          <span>Scheduled</span>
        </div>
      )
    }

    // if (dataAlert.notification_type !== SCHEDULE_FREQUENCY) {
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
          data-tip='This Alert is live - you will receive notifications whenever the conditions are met.'
          data-for={this.props.tooltipID}
        >
          <Icon type='live' />
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

  render = () => {
    const { dataAlert } = this.props

    const isEnabled = this.isEnabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE

    return (
      <div
        className={`react-autoql-notification-setting-item
          ${this.props.showHeader ? 'react-autoql-dataalert-show-header' : ''}
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
          {/* <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Type</span>
            </div>
            <div className='data-alert-section-content'>{dataAlert.notification_type}</div>
          </div> */}
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>Cycle</span>
            </div>
            <div className='data-alert-section-content'>{this.renderDataAlertCycle()}</div>
          </div>
          <div className='react-autoql-data-alert-list-item-section'>
            <div className='data-alert-header-item'>
              <span>State</span>
            </div>
            <div className='data-alert-section-content'>{this.renderDataAlertState()}</div>
          </div>
          <div className='react-autoql-data-alert-list-item-section notification-status'>
            <div className='data-alert-header-item'>
              <span>Notification Status</span>
            </div>
            <div className='data-alert-section-content'>
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
          {this.props.dataAlert.type === CUSTOM_TYPE && (
            <div className='react-autoql-data-alert-list-item-section'>
              <div className='data-alert-header-item'>
                <span>Actions</span>
              </div>
              <div className='data-alert-section-content'>
                <div className={`react-autoql-notification-action-btn${isCustom ? '' : this.ACTION_HIDDEN_CLASS}`}>
                  <Icon
                    type='settings'
                    data-for={this.props.tooltipID}
                    data-tip='Data Alert settings'
                    onClick={this.onEditClick}
                  />
                </div>
                <div
                  className={`react-autoql-notification-action-btn react-autoql-notification-action-btn-delete${
                    isCustom ? '' : this.ACTION_HIDDEN_CLASS
                  }`}
                >
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
