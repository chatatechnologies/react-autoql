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
  getScheduleFrequencyObject,
  resetDateIsFuture,
  authenticationDefault,
  getAuthentication,
  DATA_ALERT_STATUSES,
} from 'autoql-fe-utils'
import { Tooltip } from '../../../Tooltip'
import { Icon } from '../../../Icon'
import { Switch } from '../../../Switch'

import { authenticationType } from '../../../../props/types'

import './DataAlertListItem.scss'
import { isMobile } from 'react-device-detect'

export default class DataAlertListItem extends React.Component {
  constructor(props) {
    super(props)

    this.ACTION_HIDDEN_CLASS = 'react-autoql-notification-action-hidden'

    this.state = {
      isLandscape: window.matchMedia('(orientation: landscape)').matches,
      status: props.dataAlert?.status,
      title: props.dataAlert?.title,

      message: props.dataAlert?.message,
      description: props.dataAlert?.description,
      isInitializing: false,
    }
  }
  handleOrientationChange = (e) => {
    this.setState({ isLandscape: e.matches })
  }
  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onDataAlertStatusChange: PropTypes.func,
    shouldRenderNotificationFrequency: PropTypes.bool,
    shouldRenderDescription: PropTypes.bool,
    shouldRenderNextCheck: PropTypes.bool,
    shouldRenderStateDescription: PropTypes.bool,
    shouldRenderDataAlertState: PropTypes.bool,
    shouldRenderStateHeaderTitle: PropTypes.bool,
    shouldRenderStatusHeaderTitle: PropTypes.bool,
    shouldDisplaySwitchText: PropTypes.bool,
    shouldRenderCreateCustomFilteredAlert: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onDeleteClick: () => {},
    onDataAlertStatusChange: () => {},
    shouldRenderNotificationFrequency: true,
    shouldRenderDescription: false,
    shouldRenderNextCheck: true,
    shouldRenderStateDescription: false,
    shouldRenderDataAlertState: true,
    shouldRenderStateHeaderTitle: true,
    shouldRenderStatusHeaderTitle: true,
    shouldDisplaySwitchText: true,
    shouldRenderCreateCustomFilteredAlert: false,
  }
  componentDidMount() {
    this.mediaQueryList = window.matchMedia('(orientation: landscape)')
    this.mediaQueryList.addEventListener('change', this.handleOrientationChange)
  }
  componentDidUpdate = (prevProps) => {
    if (this.props.dataAlert?.status && this.props.dataAlert.status !== prevProps.dataAlert?.status) {
      this.setState({ status: this.props.dataAlert.status })
    }
    if (this.props.dataAlert?.title && this.props.dataAlert.title !== prevProps.dataAlert?.title) {
      this.setState({ title: this.props.dataAlert.title })
    }
    if (this.props.dataAlert?.message && this.props.dataAlert.message !== prevProps.dataAlert?.message) {
      this.setState({ message: this.props.dataAlert.message })
    }
    if (this.props.dataAlert?.description && this.props.dataAlert.description !== prevProps.dataAlert?.description) {
      this.setState({ message: this.props.dataAlert.description })
    }
  }
  componentWillUnmount() {
    this.mediaQueryList.removeEventListener('change', this.handleOrientationChange)
  }
  getDataAlertObj = () => {
    return {
      ...this.props.dataAlert,
      status: this.state.status,
      title: this.state.title,
      message: this.state.message,
      description: this.state.description,
    }
  }

  hasError = () => {
    return (
      this.state.status === 'GENERAL_ERROR' ||
      this.state.status === 'EVALUATION_ERROR' ||
      this.state.status === 'UNRECOVERABLE'
    )
  }

  isEnabled = () => DATA_ALERT_ENABLED_STATUSES.includes(this.state.status)
  isDisabled = () => DATA_ALERT_STATUSES.UNRECOVERABLE.includes(this.state.status)

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
      if (this.props.dataAlert?.project?.id === 'composite') {
        this.openCustomFilteredAlertModal()
        return
      }
      this.openEditModal(step)
    }
  }
  onCustomFilteredAlertClick = (e) => {
    e.stopPropagation()
    this.openCustomFilteredAlertModal()
  }
  openEditModal = (step) => {
    const dataAlert = this.getDataAlertObj()
    this.props.openEditModal(dataAlert, step)
  }
  openCustomFilteredAlertModal = () => {
    const dataAlert = this.getDataAlertObj()
    this.props.openCustomFilteredAlertModal(dataAlert)
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

  getCycleFromResetPeriod = (resetPeriod) => {
    if (!resetPeriod) {
      return 'Continuous'
    }

    return RESET_PERIOD_OPTIONS[resetPeriod]?.displayText ?? '-'
  }

  getFrequencyTooltip = () => {
    return null
    return getScheduleFrequencyObject(this.props.dataAlert)?.displayText
  }

  renderDataAlertCycle = () => {
    const frequencyType = this.props.dataAlert?.notification_type

    let cycle = '-'

    if (frequencyType === SCHEDULED_TYPE) {
      const schedules = this.props.dataAlert?.schedules
      if (schedules?.length === 7) {
        cycle = SCHEDULE_FREQUENCY_OPTIONS['DAY']?.displayText
      } else {
        cycle = SCHEDULE_FREQUENCY_OPTIONS[schedules?.[0]?.notification_period]?.displayText ?? '-'
      }
    } else if (frequencyType === CONTINUOUS_TYPE || frequencyType === PERIODIC_TYPE) {
      cycle = this.getCycleFromResetPeriod(this.props.dataAlert.reset_period)
    }

    return cycle
  }

  renderDataAlertState = () => {
    const { dataAlert, shouldRenderStateDescription, shouldRenderDataAlertState } = this.props
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
          className={`data-alert-state data-alert-warning ${status}`}
          data-tooltip-id={this.props.tooltipID}
          data-tooltip-html={
            isCustom
              ? 'There was a problem with this Data Alert. Try restarting the Alert by clicking the <em>refresh</em> button. If the problem persists, please contact your system administrator.'
              : 'There was a problem with this Data Alert. For more information, please contact your system administrator.'
          }
        >
          <Icon type='warning-triangle' />
          {shouldRenderStateDescription && <span>Error</span>}
          {isCustom && shouldRenderDataAlertState && (
            <Icon
              type='refresh'
              className='react-autoql-notification-state-action-btn'
              data-tooltip-id={this.props.tooltipID}
              onClick={this.onInitializeClick}
              spinning={this.state.isInitializing}
              disabled={this.state.isInitializing}
            />
          )}
        </div>
      )
    }
    if (!shouldRenderDataAlertState) {
      return null
    }
    if (dataAlert.reset_date && resetDateIsFuture(dataAlert)) {
      return (
        <div className={`data-alert-state data-alert-triggered ${status}`}>
          <span
            data-tooltip-html={`This Alert has been triggered for this cycle. You will not receive notifications until the start of the next cycle, ${resetDateFormatted}.<br/>You can edit this in the <em>Data Alert Settings</em>`}
            data-tooltip-id={this.props.tooltipID}
          >
            <Icon type='lightning' />
            <span>Triggered</span>
          </span>
          {isCustom && (
            <Icon
              type='refresh'
              className='react-autoql-notification-state-action-btn'
              data-tooltip-id={this.props.tooltipID}
              data-tooltip-content={
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

    if (this.state.status === 'ACTIVE' && dataAlert.notification_type === SCHEDULED_TYPE) {
      let tooltip = 'This Alert runs on a schedule'
      if (nextScheduledDate) {
        tooltip = `${tooltip} - a notification is scheduled for ${nextScheduledDate}. If your data hasn't changed by then, you will not receive a notification.`
      }

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
      const evaluationFrequency = dataAlert.evaluation_frequency ?? DEFAULT_EVALUATION_FREQUENCY
      return `< ${evaluationFrequency}m`
    }

    return <span>{formatResetDate(dataAlert, true)}</span>
  }

  render = () => {
    const { dataAlert, shouldRenderStateHeaderTitle, shouldRenderStatusHeaderTitle } = this.props

    const isEnabled = this.isEnabled()
    const isDisabled = this.isDisabled()
    const isCustom = dataAlert.type === CUSTOM_TYPE
    const isIDLECustomCompositeAlert = dataAlert.status === 'IDLE' && dataAlert.evaluation_mode === 'COMPOSITE'
    return (
      <div
        className={`react-autoql-notification-setting-item
          ${this.props.showHeader ? 'react-autoql-dataalert-show-header' : ''}
          ${isEnabled ? 'data-alert-enabled' : 'data-alert-disabled'}
          ${dataAlert.type}`}
      >
        <div className='react-autoql-notification-setting-item-header'>
          <div className='react-autoql-data-alert-list-item-section react-autoql-notification-setting-display-name'>
            <div className='data-alert-header-item'>
              <span>Data Alert</span>
            </div>
            <div className='data-alert-section-content'>
              <span className='react-autoql-notification-setting-display-name-title'>
                <span>{this.state.title}</span>
              </span>
            </div>
          </div>
          {this.props.shouldRenderNotificationFrequency && (
            <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-frequency'>
              <div className='data-alert-header-item'>
                <span>Notification Frequency</span>
              </div>
              <div
                className='data-alert-section-content data-alert-section-cycle'
                data-tooltip-id={this.props.tooltipID}
                data-tooltip-html={this.getFrequencyTooltip()}
              >
                {this.renderDataAlertCycle()}
              </div>
            </div>
          )}
          {this.props.shouldRenderDescription && (
            <div
              className={`react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-description ${
                this.state.isLandscape ? 'landscape' : ''
              } ${isMobile ? 'mobile' : ''}`}
            >
              <div className='data-alert-header-item'>
                <span> Description</span>
              </div>
              <div
                className='data-alert-section-content data-alert-section-description'
                data-tooltip-id={this.props.tooltipID}
              >
                {this.state.description}
              </div>
            </div>
          )}

          <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-state'>
            {shouldRenderStateHeaderTitle && (
              <div className='data-alert-header-item'>
                <span>State</span>
              </div>
            )}

            <div className='data-alert-section-content'>{this.renderDataAlertState()}</div>
          </div>
          {this.props.shouldRenderNextCheck && (
            <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-next-check'>
              <div className='data-alert-header-item'>
                <span>Next Check</span>
              </div>
              <div className='data-alert-section-content data-alert-section-cycle-start'>
                {this.renderDataAlertCycleStart()}
              </div>
            </div>
          )}

          <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-status'>
            {shouldRenderStatusHeaderTitle && (
              <div className='data-alert-header-item'>
                <span>Status</span>
              </div>
            )}

            <div
              className='data-alert-section-content notification-status'
              data-tooltip-content={
                isEnabled
                  ? 'Active'
                  : isIDLECustomCompositeAlert
                  ? 'To disable this alert, please disable its base alert.'
                  : 'Inactive'
              }
              data-tooltip-id={this.props.tooltipID}
            >
              <Switch
                disabled={isDisabled || isIDLECustomCompositeAlert}
                checked={isEnabled || isIDLECustomCompositeAlert}
                className='react-autoql-notification-enable-checkbox'
                onClick={(e) => e.stopPropagation()}
                onChange={this.onEnableSwitchChange}
                onText='Active'
                offText='Inactive'
                displaySwitchText={this.props.shouldDisplaySwitchText}
              />
            </div>
          </div>

          {/* Actions */}
          {isCustom && !isMobile && (
            <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-actions isCustom'>
              <div className='data-alert-header-item'>
                <span>Actions</span>
              </div>

              <div className='data-alert-section-content'>
                <div
                  className='react-autoql-notification-action-btn'
                  data-tooltip-id={this.props.tooltipID}
                  data-tooltip-content='Open Data Alert settings'
                >
                  <Icon type='settings' onClick={this.onEditClick} />
                </div>
                <div
                  className='react-autoql-notification-action-btn react-autoql-notification-action-btn-delete'
                  data-tooltip-id={this.props.tooltipID}
                  data-tooltip-content='Delete Data Alert'
                >
                  <Icon type='trash' onClick={this.onDeleteClick} />
                </div>
                {this.props.shouldRenderCreateCustomFilteredAlert && (
                  <div
                    className='react-autoql-notification-action-btn react-autoql-notification-action-btn-create-custom-filtered-alert'
                    data-tooltip-id={this.props.tooltipID}
                    data-tooltip-content='Create Custom Filtered Alert'
                  >
                    <Icon type='layers-plus' onClick={this.onCustomFilteredAlertClick} />
                  </div>
                )}
              </div>
            </div>
          )}
          {!isCustom && !isMobile && this.props.shouldRenderCreateCustomFilteredAlert && (
            <div className='react-autoql-data-alert-list-item-section react-autoql-data-alert-list-item-section-actions'>
              <div className='data-alert-header-item'>
                <span>Actions</span>
              </div>
              <div className='data-alert-section-content'>
                <div
                  className='react-autoql-notification-action-btn react-autoql-notification-action-btn-create-custom-filtered-alert'
                  data-tooltip-id={this.props.tooltipID}
                  data-tooltip-content='Create Custom Filtered Alert'
                >
                  <Icon type='layers-plus' onClick={this.onCustomFilteredAlertClick} />
                </div>
              </div>
            </div>
          )}
        </div>
        <Tooltip tooltipId={this.props.tooltipID} delayShow={300} />
      </div>
    )
  }
}
