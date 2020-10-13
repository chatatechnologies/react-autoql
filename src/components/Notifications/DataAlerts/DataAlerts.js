import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import uuid from 'uuid'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { NotificationModal } from '../NotificationModal'

import {
  fetchDataAlerts,
  updateNotificationRuleStatus,
} from '../../../js/notificationService'
import { setCSSVars } from '../../../js/Util'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
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
    activeRule: undefined,

    userRuleList: undefined,
    projectRuleList: undefined,
  }

  componentDidMount = () => {
    this.getDataAlerts('user')
    this.getDataAlerts('project')
    setCSSVars(this.props.themeConfig)
  }

  componentDidUpdate = (prevProps) => {
    if (!_isEqual(this.props.themeConfig, prevProps.themeConfig)) {
      setCSSVars(this.props.themeConfig)
    }
  }

  getDataAlerts = (type) => {
    fetchDataAlerts({
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
        themeConfig={this.props.themeConfig}
        key={this.COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentRule={this.state.activeRule}
        onSave={this.onRuleSave}
        onErrorCallback={this.props.onErrorCallback}
        onDelete={this.onRuleDelete}
        title={
          this.state.activeRule ? 'Edit Data Alert' : 'Create New Data Alert'
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
      <div className="notification-rules-list-container">
        {type === 'user' &&
          this.renderNotificationGroupTitle(
            'Set up a custom Data Alert',
            'Create customized Alerts tailored to your unique data needs',
            true
          )}
        {type === 'user' &&
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
                  if (notification.type === 'USER') {
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
                    {notification.type === 'USER' && (
                      <Icon
                        className="react-autoql-notification-action-btn"
                        type="edit"
                      />
                    )}
                    <Checkbox
                      themeConfig={this.props.themeConfig}
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
                          ? 'Turn off notification'
                          : 'Turn on notification'
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
        className="react-autoql-notification-settings"
        data-test="notification-settings"
      >
        {this.renderNotificationlist('project', projectList)}
        {this.renderNotificationlist('user', userList)}
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
