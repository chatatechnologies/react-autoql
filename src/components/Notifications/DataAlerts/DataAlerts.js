import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { hideTooltips, Tooltip } from '../../Tooltip'
import { LoadingDots } from '../../LoadingDots'
import { DataAlertModalV2 } from '../DataAlertModalV2'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import emptyStateImg from '../../../images/notifications_empty_state_blue.png'
import { fetchDataAlerts, updateDataAlertStatus } from '../../../js/notificationService'
import { formatResetDate } from '../helpers'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { withTheme } from '../../../theme'

import './DataAlerts.scss'

class DataAlerts extends React.Component {
  COMPONENT_KEY = uuid()

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

  state = {
    isFetchingList: true,
    isEditModalVisible: false,
    activeDataAlert: undefined,

    customAlertsList: undefined,
    projectAlertsList: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
    this._isMounted && this.getDataAlerts()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!_isEqual(getAuthentication(this.props.authentication), getAuthentication(prevProps.authentication))) {
      this.getDataAlerts()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  getDataAlerts = (type) => {
    fetchDataAlerts({
      ...getAuthentication(this.props.authentication),
      type,
    })
      .then((response) => {
        this._isMounted &&
          this.setState({
            customAlertsList: _get(response, 'data.custom_alerts'),
            projectAlertsList: _get(response, 'data.project_alerts'),
          })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  onEditClick = (e, notification) => {
    e.stopPropagation()
    this.setState({
      isEditModalVisible: true,
      activeDataAlert: notification,
    })
  }

  onDataAlertSave = () => {
    this.getDataAlerts()
    this.props.onSuccessAlert('Notification created!')
    this.setState({
      isEditModalVisible: false,
    })
  }

  onDataAlertDelete = (dataAlertId) => {
    const newList = this.state.customAlertsList.filter((dataAlert) => dataAlert.id !== dataAlertId)
    this.setState({
      customAlertsList: newList,
      isEditModalVisible: false,
    })
  }

  onEnableSwitchChange = (e, dataAlert) => {
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'

    const listType = dataAlert.type === 'CUSTOM' ? 'customAlertsList' : 'projectAlertsList'

    const newList = this.state[listType].map((n) => {
      if (dataAlert.id === n.id) {
        return {
          ...n,
          status: newStatus,
        }
      }
      return n
    })

    this.setState({ [`${listType}`]: newList })

    updateDataAlertStatus({
      dataAlertId: dataAlert.id,
      type: dataAlert.type,
      status: newStatus,
      ...getAuthentication(this.props.authentication),
    }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(new Error('Something went wrong. Please try again.'))

      // Get original state
      this.getDataAlerts()
    })
  }
  renderNotificationEditModal = () => {
    return (
      <DataAlertModalV2
        ref={(r) => (this.editModalRef = r)}
        key={this.COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        onDelete={this.onDataAlertDelete}
        title={this.state.activeDataAlert ? 'Edit Data Alert' : 'Create Data Alert'}
        titleIcon={this.state.activeDataAlert ? <Icon type='edit' /> : <span />}
        selectedDemoProjectId={this.props.selectedDemoProjectId}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  renderNotificationGroupTitle = (title, description) => (
    <div className='react-autoql-notification-title-container'>
      <div style={{ paddingLeft: '10px' }}>
        <div style={{ fontSize: '17px' }}>{title}</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>{description}</div>
      </div>
    </div>
  )

  goToScheduleStep = (notification) => {
    this.setState({ isEditModalVisible: true, activeDataAlert: notification })
    setTimeout(() => {
      if (this.editModalRef) {
        this.editModalRef.setStep(1)
      }
    }, 0)
  }

  goToErrorFeedback = (notification) => {
    this.setState({
      activeDataAlert: notification,
      isEditModalVisible: true,
    })
  }

  /**
   * This function needs to be updated
   * @param {*} dataAlert
   * @returns
   */
  hasError = (dataAlert) => {
    return (
      dataAlert.status === 'GENERAL_ERROR' ||
      dataAlert.status === 'EVALUATION_ERROR' ||
      dataAlert.status === 'DATA_RETURN_ERROR'
    )
  }

  renderNotificationlist = (type, list) => {
    if (type === 'project' && !list?.length) {
      return null
    }

    return (
      <div className='data-alerts-list-container'>
        {type === 'custom' && list?.length
          ? this.renderNotificationGroupTitle('Custom Data Alerts', 'View and manage your custom Data Alerts')
          : null}
        {type === 'custom' && !list?.length && this.renderEmptyListMessage()}
        {type === 'project' &&
          this.renderNotificationGroupTitle(
            'Subscribe to a Data Alert',
            'Choose from a range of ready-to-use Alerts that have been set up for you',
          )}
        <div className='react-autoql-notification-settings-container'>
          {list &&
            list.map((notification, i) => {
              const isEnabled = notification.status === 'ACTIVE' || notification.status === 'WAITING'
              return (
                <div
                  key={`react-autoql-notification-setting-item-${i}`}
                  className={`react-autoql-notification-setting-item ${notification.type}`}
                >
                  <div className='react-autoql-notification-setting-item-header'>
                    <div className='react-autoql-notification-setting-display-name'>
                      <span className='react-autoql-notification-setting-display-name-title'>
                        <span>
                          {this.hasError(notification) &&
                            (notification.type === 'CUSTOM' ? (
                              <Icon
                                type='warning-triangle'
                                className='react-autoql-notification-error-status-icon'
                                onClick={() => this.goToErrorFeedback(notification)}
                                data-for='react-autoql-notification-settings-tooltip'
                                data-tip='There was a problem with this Data Alert. Click for more information.'
                                warning
                              />
                            ) : (
                              <Icon
                                type='warning-triangle'
                                id='react-autoql-notification-error-status-icon-PROJECT'
                                data-for='react-autoql-notification-settings-tooltip'
                                data-tip='There was a problem with this Data Alert. For more information, please contact your system administrator.'
                                warning
                              />
                            ))}
                          {notification.title}
                        </span>
                      </span>
                      <span className='react-autoql-notification-setting-display-name-message'>
                        {notification.message && <span> - {notification.message}</span>}
                      </span>
                    </div>
                    <div className='react-autoql-notification-setting-actions'>
                      {notification.type === 'CUSTOM' && (
                        <Icon
                          className='react-autoql-notification-action-btn'
                          type='edit'
                          data-for='react-autoql-notification-settings-tooltip'
                          data-tip='Edit Data Alert'
                          onClick={(e) => {
                            if (notification.type === 'CUSTOM') {
                              this.onEditClick(e, notification)
                            }
                          }}
                        />
                      )}
                      {notification.reset_date && (
                        <Icon
                          className='reset-period-info-icon'
                          data-tip={`This Alert has been triggered. Scanning will resume on ${formatResetDate(
                            notification,
                          )} (${notification.time_zone})`}
                          data-for='react-autoql-notification-settings-tooltip'
                          onClick={() => this.goToScheduleStep(notification)}
                          type='hour-glass'
                        />
                      )}
                      {this.hasError(notification) ? (
                        <React.Fragment>
                          {notification.type === 'CUSTOM' && (
                            <Button
                              type='primary'
                              tooltip='This Alert is no longer active. <br /> Click to re-initialze it.'
                              multiline
                              className='react-autoql-re-initialize-btn'
                              onClick={() => {
                                this.props.onAlertInitializationCallback(
                                  notification,
                                  this.props.selectedDemoProjectId,
                                  this.props.authentication,
                                )
                                this.getDataAlerts()
                              }}
                            >
                              <span className='react-autoql-re-initialize-btn-text'>
                                <Icon type='warning-triangle' /> Resend
                              </span>
                            </Button>
                          )}

                          <Checkbox type='switch' className='react-autoql-notification-disable-checkbox' />
                        </React.Fragment>
                      ) : (
                        <Checkbox
                          type='switch'
                          checked={isEnabled}
                          className='react-autoql-notification-enable-checkbox'
                          onClick={(e) => e.stopPropagation()}
                          data-tip={isEnabled ? 'Active' : 'Inactive'}
                          data-for='react-autoql-notification-settings-tooltip'
                          onChange={(e) => {
                            this.onEnableSwitchChange(e, notification)
                            hideTooltips()
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  renderEmptyListMessage = () => (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <div className='empty-list-message'>
        <img className='empty-list-img' src={emptyStateImg} />
      </div>
      <span style={{ opacity: 0.6 }}>No Alerts are set up yet.</span>
      <br />
      <span style={{ opacity: 0.6, width: '350px', display: 'inline-block' }}>
        To create one, select the “Create a Data Alert” option from a data response in Data Messenger.
      </span>
      <br />
    </div>
  )

  render = () => {
    if (!this.state.customAlertsList) {
      return (
        <div data-test='notification-settings' style={{ textAlign: 'center', marginTop: '100px' }}>
          <LoadingDots />
        </div>
      )
    }

    const projectAlertsList = _get(this.state, 'projectAlertsList', [])
    const customAlertsList = _get(this.state, 'customAlertsList', [])

    return (
      <ErrorBoundary>
        <div className='react-autoql-notification-settings' data-test='notification-settings'>
          {this.renderNotificationlist('project', projectAlertsList)}
          {this.renderNotificationlist('custom', customAlertsList)}
          {this.renderNotificationEditModal()}
          <Tooltip
            className='react-autoql-tooltip'
            id='react-autoql-notification-settings-tooltip'
            effect='solid'
            delayShow={500}
            html
          />
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataAlerts)
