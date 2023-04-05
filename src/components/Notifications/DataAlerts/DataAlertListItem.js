import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { hideTooltips } from '../../Tooltip'

import { updateDataAlertStatus } from '../../../js/notificationService'
import { formatResetDate } from '../helpers'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './DataAlerts.scss'

export default class DataAlertListItem extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      status: props.dataAlert?.status,
      title: props.dataAlert?.title,
      message: props.dataAlert?.title,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,

    onSuccessAlert: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
    onAlertInitializationCallback: () => {},
    onSuccessAlert: () => {},
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
    const dataAlert = this.getDataAlertObj()
    this.props.onInitializeClick(dataAlert)
  }

  onDeleteClick = (e, step) => {
    e.stopPropagation()
    // DELETE HERE
  }

  onEditClick = (e, step) => {
    e.stopPropagation()

    if (this.props.dataAlert.type === 'CUSTOM') {
      this.openEditModal(step)
    }
  }

  openEditModal = (step) => {
    const dataAlert = this.getDataAlertObj()
    this.props.openEditModal(dataAlert, step)
  }

  onEnableSwitchChange = (e) => {
    hideTooltips()

    const previousStatus = this.state.status
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'

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

  render = () => {
    const { dataAlert } = this.props

    const isEnabled = this.isEnabled()
    const hasError = this.hasError()

    const isCustom = dataAlert.type === 'CUSTOM'
    const actionHiddenClass = 'react-autoql-notification-action-hidden'

    return (
      <div key={this.props.key} className={`react-autoql-notification-setting-item ${dataAlert.type}`}>
        <div className='react-autoql-notification-setting-item-header'>
          <div className='react-autoql-notification-setting-display-name'>
            <span className='react-autoql-notification-setting-display-name-title'>
              <span>{this.state.title}</span>
            </span>
            {/* <span className='react-autoql-notification-setting-display-name-message'>
              {this.state.message && <span> - {this.state.message}</span>}
            </span> */}
          </div>
          <div className='react-autoql-notification-setting-actions'>
            {/* Reset Period Info */}
            <div
              className={`react-autoql-notification-action reset-period-info-icon ${
                dataAlert.reset_date ? '' : actionHiddenClass
              }`}
            >
              <Icon
                data-tip={`This Alert has been triggered. Scanning will resume on ${formatResetDate(dataAlert)} (${
                  dataAlert.time_zone
                })`}
                data-for='react-autoql-notification-settings-tooltip'
                onClick={(e) => this.onEditClick(e, 'schedule')}
                type='hour-glass'
              />
            </div>

            {/* Error Status */}
            {hasError ? (
              isCustom ? (
                <div className='react-autoql-notification-action react-autoql-notification-action-btn'>
                  <Icon
                    type='warning-triangle'
                    className='react-autoql-notification-error-status-icon'
                    onClick={this.openEditModal}
                    data-for='react-autoql-notification-settings-tooltip'
                    data-tip='There was a problem with this Data Alert. Click for more information.'
                    warning
                  />
                  <Button
                    type='primary'
                    tooltip='This Alert is no longer active. <br /> Click to re-initialze it.'
                    multiline
                    className={`react-autoql-re-initialize-btn ${hasError && isCustom ? '' : actionHiddenClass}`}
                    onClick={this.onInitializeClick}
                  >
                    <span className='react-autoql-re-initialize-btn-text'>
                      <Icon type='warning-triangle' /> Resend
                    </span>
                  </Button>
                </div>
              ) : (
                <div className='react-autoql-notification-action react-autoql-notification-action-btn'>
                  <Icon
                    type='warning-triangle'
                    id='react-autoql-notification-error-status-icon-PROJECT'
                    data-for='react-autoql-notification-settings-tooltip'
                    data-tip='There was a problem with this Data Alert. For more information, please contact your system administrator.'
                    warning
                  />
                </div>
              )
            ) : (
              <div />
            )}

            {/* Active Toggle */}
            <div className='react-autoql-notification-action'>
              <Checkbox
                type='switch'
                checked={isEnabled}
                className='react-autoql-notification-enable-checkbox'
                onClick={(e) => e.stopPropagation()}
                data-tip={isEnabled ? 'Active' : 'Inactive'}
                data-for='react-autoql-notification-settings-tooltip'
                onChange={this.onEnableSwitchChange}
              />
            </div>

            {/* Edit Button */}
            <div
              className={`react-autoql-notification-action react-autoql-notification-action-btn ${
                isCustom ? '' : actionHiddenClass
              }`}
            >
              <Icon
                type='edit'
                data-for='react-autoql-notification-settings-tooltip'
                data-tip='Edit Data Alert'
                onClick={this.onEditClick}
              />
            </div>

            {/* Delete Button */}
            <div
              className={`react-autoql-notification-action react-autoql-notification-action-btn ${
                isCustom ? '' : actionHiddenClass
              }`}
            >
              <Icon
                type='trash'
                data-for='react-autoql-notification-settings-tooltip'
                data-tip='Delete Data Alert'
                onClick={this.onDeleteClick}
                danger
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
