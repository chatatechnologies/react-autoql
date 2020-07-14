import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import uuid from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { NotificationModal } from '../NotificationModal'

import {
  fetchNotificationSettings,
  updateNotificationRuleStatus,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationSettings.scss'

export default class NotificationSettings extends React.Component {
  COMPONENT_KEY = uuid.v4()

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
    isEditModalVisible: false,
    activeRule: undefined,

    userRuleList: undefined,
    projectRuleList: undefined,
  }

  componentDidMount = () => {
    this.getNotificationSettings('user')
    this.getNotificationSettings('project')
  }

  getNotificationSettings = (type) => {
    fetchNotificationSettings({
      ...this.props.authentication,
      type,
    })
      .then((list) => {
        this.setState({
          [`${type}RuleList`]: list,
        })
      })
      .catch((error) => {
        console.error(error)
        // this.setState({
        //   isFetchingList: false,
        // })
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

  onRuleSave = (ruleResponse) => {
    let newRuleList = [...this.state.userRuleList]
    if (this.state.activeRule) {
      // Update existing rule data
      newRuleList = this.state.userRuleList.map((r) => {
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

    this.setState({ isEditModalVisible: false, userRuleList: newRuleList })
  }

  onRuleDelete = (ruleId) => {
    const newList = this.state.userRuleList.filter((rule) => rule.id !== ruleId)
    this.setState({
      userRuleList: newList,
      isEditModalVisible: false,
    })
  }

  onEnableSwitchChange = (e, rule) => {
    const type = _get(rule, 'type', '').toLowerCase()

    const newStatus = e.target.checked ? 'ACTIVE' : 'INACTIVE'
    const newList = this.state[`${type}RuleList`].map((n) => {
      if (rule.id === n.id) {
        return {
          ...n,
          status: newStatus,
        }
      }
      return n
    })

    this.setState({ [`${type}RuleList`]: newList })

    updateNotificationRuleStatus({
      ruleId: rule.id,
      type: rule.type,
      status: newStatus,
      ...this.props.authentication,
    }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  renderNotificationEditModal = () => {
    return (
      <NotificationModal
        key={this.COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentNotification={this.state.activeRule}
        onSave={this.onRuleSave}
        onErrorCallback={this.props.onErrorCallback}
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
    if (type === 'user' && !_get(list, 'length')) {
      return this.renderEmptyListMessage()
    } else if (type === 'project' && !_get(list, 'length')) {
      return null
    }

    return (
      <div className="notification-rules-list-container">
        {type === 'user' &&
          this.renderNotificationGroupTitle(
            'Custom Notifications',
            'Create your own customized notifications tailored to your needs',
            true
          )}
        {type === 'project' &&
          this.renderNotificationGroupTitle(
            'Default Notifications',
            'Choose from a predefined set of notifications'
          )}
        <div className="chata-notification-settings-container">
          {list.map((notification, i) => {
            return (
              <div
                key={`chata-notification-setting-item-${i}`}
                className={`chata-notification-setting-item ${notification.type}`}
                onClick={(e) => {
                  if (notification.type === 'USER') {
                    this.onEditClick(e, notification)
                  }
                }}
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
                      onClick={(e) => e.stopPropagation()}
                      data-tip={
                        notification.status === 'ACTIVE' ||
                        notification.status === 'WAITING'
                          ? 'Turn off notification'
                          : 'Turn on notification'
                      }
                      data-for="chata-notification-settings-tooltip"
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
      <span style={{ opacity: 0.6 }}>
        You don't have any notifications yet.
      </span>
      <br />
      <Button
        type="primary"
        onClick={this.onAddClick}
        style={{ marginTop: '10px' }}
      >
        Create a New Notification
      </Button>
    </div>
  )

  render = () => {
    if (!this.state.userRuleList) {
      return (
        <div
          data-test="notification-settings"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    }

    const projectList = _get(this.state, 'projectRuleList', [])
    const userList = _get(this.state, 'userRuleList', [])

    return (
      <div
        className="chata-notification-settings"
        data-test="notification-settings"
      >
        {this.renderNotificationlist('project', projectList)}
        {this.renderNotificationlist('user', userList)}
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
