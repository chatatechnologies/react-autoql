import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { NewNotificationModal } from '../NewNotificationModal'

import {
  fetchNotificationSettings,
  updateNotificationRuleStatus,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationSettings.scss'

export default class NotificationSettings extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onErrorCallback: () => {},
  }

  state = {
    isFetchingList: true,
    ruleList: [],
    isEditModalVisible: false,
    activeRule: undefined,
  }

  componentDidMount = () => {
    this.getNotificationSettings()
  }

  getNotificationSettings = () => {
    fetchNotificationSettings({
      ...this.props.authentication,
    })
      .then(list => {
        this.setState({
          ruleList: list,
          isFetchingList: false,
        })
      })
      .catch(error => {
        console.error(error)
        this.setState({
          isFetchingList: false,
        })
      })
  }

  onEditClick = (e, notification) => {
    e.stopPropagation()
    this.setState({
      isEditModalVisible: true,
      activeRule: notification,
    })
  }

  onAddClick = () => {
    this.setState({
      isEditModalVisible: true,
      activeRule: undefined,
    })
  }

  onRuleSave = ruleResponse => {
    let newRuleList = [...this.state.ruleList]
    if (this.state.activeRule) {
      // Update existing rule data
      newRuleList = this.state.ruleList.map(r => {
        if (r.id === this.state.activeRule.id) {
          return _get(ruleResponse, 'data.data', this.state.activeRule)
        }
        return r
      })
    } else {
      // Add new rule to top of list
      if (_get(ruleResponse, 'data.data')) {
        newRuleList.unshift(_get(ruleResponse, 'data.data'))
      }
    }

    this.setState({ isEditModalVisible: false, ruleList: newRuleList })
  }

  onRuleError = () => {
    this.props.onErrorCallback()
  }

  onRuleDelete = ruleId => {
    const newList = this.state.ruleList.filter(rule => rule.id !== ruleId)
    this.setState({
      ruleList: newList,
      isEditModalVisible: false,
    })
  }

  onEnableSwitchChange = (e, rule) => {
    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'
    const newList = this.state.ruleList.map(n => {
      if (rule.id === n.id) {
        return {
          ...n,
          status: newStatus,
        }
      }
      return n
    })

    this.setState({ ruleList: newList })

    updateNotificationRuleStatus({
      ruleId: rule.id,
      status: newStatus,
      ...this.props.authentication,
    }).catch(error => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  renderNotificationEditModal = () => {
    return (
      <NewNotificationModal
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentNotification={this.state.activeRule}
        onSave={this.onRuleSave}
        onError={this.onRuleError}
        onDelete={this.onRuleDelete}
      />
    )
  }

  renderNotificationGroupTitle = (title, description, includeAddBtn) => (
    <div className="chata-notification-title-container">
      <div style={{ paddingLeft: '10px', opacity: 0.8 }}>
        <div style={{ fontSize: '17px' }}>{title}</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>{description}</div>
      </div>
      {includeAddBtn && (
        <div className="chata-notification-add-btn" onClick={this.onAddClick}>
          <Icon type="plus" className="chata-notification-add-icon" />
        </div>
      )}
    </div>
  )

  renderNotificationlist = (type, list) => {
    if (type === 'custom' && !_get(list, 'length')) {
      return this.renderEmptyListMessage()
    } else if (type === 'default' && !_get(list, 'length')) {
      return null
    }

    return (
      <div className="notification-rules-list-container">
        {type === 'custom' &&
          this.renderNotificationGroupTitle(
            'Custom Notifications',
            'Description for custom notifications will go here',
            true
          )}
        {type === 'default' &&
          this.renderNotificationGroupTitle(
            'Default Notifications',
            'Description for default notifications will go here'
          )}
        <div className="chata-notification-settings-container">
          {list.map((notification, i) => {
            return (
              <div
                key={`chata-notification-setting-item-${i}`}
                className="chata-notification-setting-item"
                onClick={e => this.onEditClick(e, notification)}
              >
                <div className="chata-notification-setting-item-header">
                  <div className="chata-notification-setting-display-name">
                    <span className="chata-notification-setting-display-name-title">
                      {notification.title}
                    </span>
                    <span className="chata-notification-setting-display-name-message">
                      {notification.message && (
                        <span> - {notification.message}</span>
                      )}
                    </span>
                  </div>
                  <div className="chata-notification-setting-actions">
                    <Checkbox
                      type="switch"
                      checked={
                        notification.status === 'ACTIVE' ||
                        notification.status === 'WAITING'
                      }
                      className="chata-notification-enable-checkbox"
                      onClick={e => e.stopPropagation()}
                      data-tip={
                        notification.status === 'ACTIVE' ||
                        notification.status === 'WAITING'
                          ? 'Turn off notification'
                          : 'Turn on notification'
                      }
                      data-for="chata-notification-settings-tooltip"
                      onChange={e => {
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
      You don't have any notifications yet.
      <br />
      <Button type="primary" onClick={this.onAddClick}>
        Create a New Notification
      </Button>
    </div>
  )

  render = () => {
    if (this.state.isFetchingList) {
      return (
        <div
          data-test="notification-settings"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    }

    const customList = this.state.ruleList.filter(
      rule => rule.type !== 'default'
    )
    const defaultList = this.state.ruleList.filter(
      rule => rule.type === 'default'
    )

    return (
      <div
        className="chata-notification-settings"
        data-test="notification-settings"
      >
        {this.renderNotificationlist('default', defaultList)}
        {this.renderNotificationlist('custom', customList)}
        {this.renderNotificationEditModal()}
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-notification-settings-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
      </div>
    )
  }
}
