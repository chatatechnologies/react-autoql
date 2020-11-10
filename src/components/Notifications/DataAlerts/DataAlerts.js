import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import uuid from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { NotificationModal } from '../NotificationModal'

import {
  fetchDataAlerts,
  updateDataAlertStatus,
} from '../../../js/notificationService'
import { setCSSVars } from '../../../js/Util'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../../props/defaults'

import './DataAlerts.scss'

export default class DataAlerts extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    onErrorCallback: () => {},
  }

  state = {
    isFetchingList: true,
    isEditModalVisible: false,
    activeDataAlert: undefined,

    customAlertsList: undefined,
    projectAlertsList: undefined,
  }

  componentDidMount = () => {
    this.getDataAlerts()
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  getDataAlerts = (type) => {
    fetchDataAlerts({
      ...getAuthentication(this.props.authentication),
      type,
    })
      .then((response) => {
        this.setState({
          customAlertsList: response.custom_alerts,
          projectAlertsList: response.project_alerts,
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

  onDataAlertSave = (dataAlertResponse) => {
    let newDataAlertList = [...this.state.customAlertsList]
    if (this.state.activeDataAlert) {
      // Update existing data
      newDataAlertList = this.state.customAlertsList.map((r) => {
        if (r.id === this.state.activeDataAlert.id) {
          return _get(
            dataAlertResponse,
            'data.data',
            this.state.activeDataAlert
          )
        }
        return r
      })
    } else {
      // Add new data alert to top of list
      if (_get(dataAlertResponse, 'data.data')) {
        newDataAlertList.unshift(_get(dataAlertResponse, 'data.data'))
      }
    }

    this.setState({
      isEditModalVisible: false,
      customAlertsList: newDataAlertList,
    })
  }

  onDataAlertDelete = (dataAlertId) => {
    const newList = this.state.customAlertsList.filter(
      (dataAlert) => dataAlert.id !== dataAlertId
    )
    this.setState({
      customAlertsList: newList,
      isEditModalVisible: false,
    })
  }

  onEnableSwitchChange = (e, dataAlert) => {
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'

    let listType =
      dataAlert.type === 'CUSTOM' ? 'customAlertsList' : 'projectAlertsList'

    const oldList = _cloneDeep(this.state[listType])
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
      this.props.onErrorCallback(
        new Error('Something went wrong. Please try again.')
      )

      // Switch flip back
      this.setState({ [`${listType}`]: oldList })
    })
  }

  renderNotificationEditModal = () => {
    return (
      <NotificationModal
        themeConfig={getThemeConfig(this.props.themeConfig)}
        key={this.COMPONENT_KEY}
        authentication={getAuthentication(this.props.authentication)}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        onDelete={this.onDataAlertDelete}
        title={
          this.state.activeDataAlert
            ? 'Edit Data Alert'
            : 'Create New Data Alert'
        }
      />
    )
  }

  renderNotificationGroupTitle = (title, description, includeAddBtn) => (
    <div className="react-autoql-notification-title-container">
      <div style={{ paddingLeft: '10px' }}>
        <div style={{ fontSize: '17px' }}>{title}</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>{description}</div>
      </div>
      {includeAddBtn && (
        <div
          className="react-autoql-notification-add-btn"
          onClick={this.onAddClick}
          data-tip="Create Data Alert"
          data-for="react-autoql-notification-settings-tooltip"
        >
          <Icon type="plus" className="react-autoql-notification-add-icon" />
        </div>
      )}
    </div>
  )

  renderNotificationlist = (type, list) => {
    if (type === 'project' && !_get(list, 'length')) {
      return null
    }

    return (
      <div className="data-alerts-list-container">
        {type === 'custom' &&
          this.renderNotificationGroupTitle(
            'Set up a custom Data Alert',
            'Create customized Alerts tailored to your unique data needs',
            true
          )}
        {type === 'custom' &&
          !_get(list, 'length') &&
          this.renderEmptyListMessage()}
        {type === 'project' &&
          this.renderNotificationGroupTitle(
            'Subscribe to a Data Alert',
            'Choose from a range of ready-to-use Alerts that have been set up for you'
          )}
        <div className="react-autoql-notification-settings-container">
          {list.map((notification, i) => {
            return (
              <div
                key={`react-autoql-notification-setting-item-${i}`}
                className={`react-autoql-notification-setting-item ${notification.type}`}
                onClick={(e) => {
                  if (notification.type === 'CUSTOM') {
                    this.onEditClick(e, notification)
                  }
                }}
              >
                <div className="react-autoql-notification-setting-item-header">
                  <div className="react-autoql-notification-setting-display-name">
                    <span className="react-autoql-notification-setting-display-name-title">
                      {notification.title}
                    </span>
                    <span className="react-autoql-notification-setting-display-name-message">
                      {notification.message && (
                        <span> - {notification.message}</span>
                      )}
                    </span>
                  </div>
                  <div className="react-autoql-notification-setting-actions">
                    {notification.type === 'CUSTOM' && (
                      <Icon
                        className="react-autoql-notification-action-btn"
                        type="edit"
                      />
                    )}
                    <Checkbox
                      themeConfig={getThemeConfig(this.props.themeConfig)}
                      type="switch"
                      checked={
                        notification.status === 'ACTIVE' ||
                        notification.status === 'WAITING'
                      }
                      className="react-autoql-notification-enable-checkbox"
                      onClick={(e) => e.stopPropagation()}
                      data-tip={
                        notification.status === 'ACTIVE' ||
                        notification.status === 'WAITING'
                          ? 'Turn Data Alert off'
                          : 'Turn Data Alert on'
                      }
                      data-for="react-autoql-notification-settings-tooltip"
                      onChange={(e) => {
                        this.onEnableSwitchChange(e, notification)
                        ReactTooltip.hide()
                        ReactTooltip.rebuild()
                      }}
                    />
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
      <Button
        type="primary"
        onClick={this.onAddClick}
        style={{ marginTop: '10px' }}
      >
        Create Data Alert
      </Button>
    </div>
  )

  render = () => {
    if (!this.state.customAlertsList) {
      return (
        <div
          data-test="notification-settings"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    }

    const projectAlertsList = _get(this.state, 'projectAlertsList', [])
    const customAlertsList = _get(this.state, 'customAlertsList', [])

    return (
      <div
        className="react-autoql-notification-settings"
        data-test="notification-settings"
      >
        {this.renderNotificationlist('project', projectAlertsList)}
        {this.renderNotificationlist('custom', customAlertsList)}
        {this.renderNotificationEditModal()}
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="react-autoql-notification-settings-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
      </div>
    )
  }
}
