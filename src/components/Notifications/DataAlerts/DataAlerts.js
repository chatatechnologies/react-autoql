import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { DataAlertModal } from '../DataAlertModal'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import LoadingDots from '../../LoadingDots/LoadingDots'
import { fetchDataAlerts, updateDataAlertStatus } from '../../../js/notificationService'
import { formatResetDate } from '../helpers'

import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './DataAlerts.scss'
import { withTheme } from '../../../theme'

class DataAlerts extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
    showCreateAlertBtn: PropTypes.bool,
    onSuccessAlert: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    showCreateAlertBtn: false,
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

  onAddClick = () => {
    this.setState({
      isEditModalVisible: true,
      activeDataAlert: undefined,
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
      <DataAlertModal
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
      />
    )
  }

  renderNotificationGroupTitle = (title, description, includeAddBtn) => (
    <div className='react-autoql-notification-title-container'>
      <div style={{ paddingLeft: '10px' }}>
        <div style={{ fontSize: '17px' }}>{title}</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>{description}</div>
      </div>
      {includeAddBtn && this.props.showCreateAlertBtn && (
        <div
          className='react-autoql-notification-add-btn'
          onClick={this.onAddClick}
          data-tip='Create Data Alert'
          data-for='react-autoql-notification-settings-tooltip'
        >
          <Icon type='plus' className='react-autoql-notification-add-icon' />
        </div>
      )}
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
    if (type === 'project' && !_get(list, 'length')) {
      return null
    }

    return (
      <div className='data-alerts-list-container'>
        {type === 'custom' &&
          this.renderNotificationGroupTitle('Custom Data Alerts', 'View and manage your custom Data Alerts', true)}
        {type === 'custom' && !_get(list, 'length') && this.renderEmptyListMessage()}
        {type === 'project' &&
          this.renderNotificationGroupTitle(
            'Subscribe to a Data Alert',
            'Choose from a range of ready-to-use Alerts that have been set up for you',
          )}
        <div className='react-autoql-notification-settings-container'>
          {list &&
            list.map((notification, i) => {
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
                          checked={notification.status === 'ACTIVE' || notification.status === 'WAITING'}
                          className='react-autoql-notification-enable-checkbox'
                          onClick={(e) => e.stopPropagation()}
                          data-tip={notification.status === 'ACTIVE' || notification.status === 'WAITING'}
                          data-for='react-autoql-notification-settings-tooltip'
                          onChange={(e) => {
                            this.onEnableSwitchChange(e, notification)
                            ReactTooltip.hide()
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
      <span style={{ opacity: 0.6 }}>No Alerts are set up yet.</span>
      <br />
      {this.props.showCreateAlertBtn && (
        <Button type='primary' onClick={this.onAddClick} style={{ marginTop: '10px' }}>
          Create Data Alert
        </Button>
      )}
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
          <ReactTooltip
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
