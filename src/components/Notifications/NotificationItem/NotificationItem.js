import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'
import _get from 'lodash.get'
import _isEmpty from 'lodash.isempty'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import { Button } from '../../Button'
import { ExpressionBuilder } from '../ExpressionBuilder'
import { VizToolbar } from '../../VizToolbar'
import {
  dismissNotification,
  deleteNotification,
  updateNotificationRuleStatus,
  fetchRule,
} from '../../../js/notificationService'
import dayjs from '../../../js/dayjsWithPlugins'
import {
  getSupportedDisplayTypes,
  getDefaultDisplayType,
  capitalizeFirstChar,
} from '../../../js/Util'
import { getScheduleDescription } from '../helpers'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
} from '../../../props/defaults'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import './NotificationItem.scss'

dayjs.extend(advancedFormat)

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid.v4()
  supportedDisplayTypes = []

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
    notification: PropTypes.shape({}).isRequired,
    activeNotificationData: PropTypes.shape({}),
    showNotificationDetails: PropTypes.bool,
    onRuleFetchCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    onRuleFetchCallback: () => {},
    onExpandCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onErrorCallback: () => {},
  }

  state = {
    ruleStatus: undefined,
    ruleDetails: undefined,
    fullyExpanded: false,
  }

  componentDidUpdate = (prevProps) => {
    if (
      !prevProps.activeNotificationData &&
      this.props.activeNotificationData
    ) {
      const queryResponse = {
        data: this.props.activeNotificationData,
      }
      this.supportedDisplayTypes = getSupportedDisplayTypes(queryResponse)
      const displayType = this.supportedDisplayTypes.includes('column')
        ? 'column'
        : getDefaultDisplayType(queryResponse)
      this.setState({ displayType })
    }
  }

  getIsTriggered = (state) => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(state)
  }

  fetchRuleDetails = (notification) => {
    this.setState({ ruleDetails: undefined, ruleStatus: undefined })
    fetchRule({ ruleId: notification.rule_id, ...this.props.authentication })
      .then((response) => {
        this.props.onRuleFetchCallback(response)
        this.setState({
          ruleDetails: response,
          ruleStatus: _get(response, 'status'),
        })
      })
      .catch((error) => {
        this.setState({
          ruleDetails: {},
        })
      })
  }

  onClick = (notification) => {
    if (notification.expanded) {
      this.setState({ fullyExpanded: false })
      this.props.onCollapseCallback(notification)
    } else {
      this.fetchRuleDetails(notification)
      this.props.onExpandCallback(notification)
      // wait for animation to complete before showing any scrollbars
      setTimeout(() => {
        this.setState({ fullyExpanded: true })
      }, 500)
    }

    this.props.onClick(notification)
  }

  onDismissClick = (e, notification) => {
    e.stopPropagation()
    this.props.onDismissCallback(notification)

    dismissNotification({
      ...this.props.authentication,
      notificationId: notification.id,
    }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  onDeleteClick = (e, notification) => {
    e.stopPropagation()
    this.props.onDeleteCallback(notification)

    deleteNotification({
      ...this.props.authentication,
      notificationId: notification.id,
    }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  changeRuleStatus = (notification, status) => {
    updateNotificationRuleStatus({
      ruleId: notification.rule_id,
      type: notification.rule_type,
      status,
      ...this.props.authentication,
    })
      .then(() => {
        this.setState({ ruleStatus: status })
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
  }

  formatTimestamp = (timestamp) => {
    const time = dayjs.unix(timestamp).format('h:mma')
    const day = dayjs.unix(timestamp).format('MM-DD-YY')
    const today = dayjs().format('MM-DD-YY')
    const yesterday = dayjs()
      .subtract(1, 'd')
      .format('MM-DD-YY')

    if (day === today) {
      return `Today at ${time}`
    } else if (day === yesterday) {
      return `Yesterday at ${time}`
    } else if (dayjs().isSame(timestamp, 'year')) {
      return `${dayjs.unix(timestamp).format('MMMM Do')} at ${time}`
    }
    return `${dayjs.unix(timestamp).format('MMMM Do, YYYY')} at ${time}`
  }

  getFrequencyDescription = () => {
    const { notification } = this.props
    // category, "SINGLE_EVENT" or "REPEAT_EVENT"
    // frequency, "DAY" "WEEK" "MONTH" or "YEAR"
    // repeat, TRUE or FALSE
    // selection, "LIST OF MONTH NUMBERS OR WEEK NUMBERS"

    const category = notification.notification_type
    const frequency = notification.reset_period
    const repeat = !!notification.reset_period
    const selection =
      category === 'REPEAT_EVENT'
        ? [1, 2, 3, 4, 5, 6, 7] // Hardcoded for MVP, we will probably get rid of this
        : null

    const description = getScheduleDescription(
      category,
      frequency,
      repeat,
      selection
    )
    return description
  }

  renderAlertColorStrip = () => (
    <div className="chata-notification-alert-strip" />
  )

  renderNotificationHeader = (notification) => {
    return (
      <div
        className="chata-notification-list-item-header"
        onClick={() => {
          this.onClick(notification)
        }}
      >
        <div className="chata-notification-display-name-container">
          <div className="chata-notification-display-name">
            {notification.rule_title}
          </div>
          <div className="chata-notification-description">
            {notification.rule_message}
          </div>
          <div className="chata-notification-timestamp">
            <Icon type="calendar" />{' '}
            {this.formatTimestamp(notification.created_at)}
          </div>
        </div>
        {this.getIsTriggered(notification.state) ? (
          <div className="chata-notification-dismiss-btn">
            <Icon
              type="notification-off"
              className="chata-notification-dismiss-icon"
              data-tip="Dismiss"
              data-for="chata-notification-tooltip"
              onClick={(e) => {
                this.onDismissClick(e, notification)
                ReactTooltip.hide()
              }}
            />
          </div>
        ) : (
          <div className="chata-notification-dismiss-btn">
            <Icon
              type="close"
              className="chata-notification-delete-icon"
              data-tip="Delete"
              data-for="chata-notification-tooltip"
              onClick={(e) => {
                this.onDeleteClick(e, notification)
                ReactTooltip.hide()
              }}
            />
          </div>
        )}
      </div>
    )
  }

  renderTurnOnNotificationButton = (notification) => {
    const status = this.state.ruleStatus
    if (!status) {
      return <div />
    }

    if (status === 'ACTIVE' || status === 'WAITING') {
      return (
        <Button
          onClick={() => this.changeRuleStatus(notification, 'INACTIVE')}
          type="default"
        >
          <Icon type="notification-off" /> Turn off these notifications
        </Button>
      )
    }

    return (
      <Button
        onClick={() => this.changeRuleStatus(notification, 'ACTIVE')}
        type="default"
      >
        <Icon type="notification" /> Turn these notifications back on
      </Button>
    )
  }

  renderEditNotificationButton = () => {
    if (!this.state.ruleDetails) {
      return null
    } else if (_isEmpty(this.state.ruleDetails)) {
      return (
        <div className="notification-deleted-text">
          This notification has been deleted.
          {/* <Button onClick={() => this.props.onEditClick()} type="default">
            <Icon type="plus" />
            Create another one
          </Button> */}
        </div>
      )
    }

    return (
      <Button
        onClick={() => this.props.onEditClick(this.state.ruleDetails)}
        type="default"
      >
        <Icon type="edit" /> Edit notification
      </Button>
    )
  }

  renderNotificationFooter = (notification) => {
    return (
      <div
        className="chata-notification-extra-content"
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        {this.renderTurnOnNotificationButton(notification)}
        {this.renderEditNotificationButton()}
      </div>
    )
  }

  renderNotificationContent = (notification) => {
    const queryTitle = notification.rule_query
    const queryTitleCapitalized = capitalizeFirstChar(queryTitle)

    const queryResponse = {
      data: this.props.activeNotificationData,
    }

    return (
      <div
        className={`chata-notification-expanded-content ${
          notification.expanded ? ' visible' : ''
        }`}
      >
        <div className="chata-notification-details-container">
          <div
            className="chata-notification-data-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chata-notificaton-chart-container">
              {this.props.activeNotificationData && notification.expanded ? (
                <Fragment>
                  <div className="chata-notification-query-title">
                    {queryTitleCapitalized}
                  </div>
                  <QueryOutput
                    ref={(r) => (this.OUTPUT_REF = r)}
                    queryResponse={queryResponse}
                    autoQLConfig={{ enableDrilldowns: false }}
                    themeConfig={this.props.themeConfig}
                    displayType={this.state.displayType}
                    style={{ flex: '1' }}
                  />
                </Fragment>
              ) : (
                <div className="loading-container-centered">
                  <LoadingDots />
                </div>
              )}
            </div>
            {_get(this.supportedDisplayTypes, 'length') > 1 && (
              <div className="chata-notification-viz-switcher">
                <VizToolbar
                  themeConfig={this.props.themeConfig}
                  supportedDisplayTypes={this.supportedDisplayTypes}
                  displayType={this.state.displayType}
                  onDisplayTypeChange={(displayType) =>
                    this.setState({ displayType })
                  }
                  vertical
                />
              </div>
            )}
          </div>
          {this.props.showNotificationDetails && notification.expanded && (
            <div className="chata-notification-details">
              <div className="chata-notification-details-title">
                Conditions:
              </div>
              <ExpressionBuilder
                key={`expression-builder-${this.COMPONENT_KEY}`}
                expression={_get(notification, 'rule_expression')}
                readOnly
              />
              <div className="chata-notification-details-title">
                Description:
              </div>
              <div>{this.getFrequencyDescription()}</div>
            </div>
          )}
        </div>
        {this.renderNotificationFooter(notification)}
      </div>
    )
  }

  render = () => {
    const { notification } = this.props

    return (
      <div
        id={`chata-notification-item-${this.COMPONENT_KEY}`}
        key={`chata-notification-item-${this.COMPONENT_KEY}`}
        className={`chata-notification-list-item
          ${this.getIsTriggered(notification.state) ? ' triggered' : ''}
          ${notification.expanded ? ' expanded' : ''}
          ${this.state.fullyExpanded ? ' animation-complete' : ''}`}
      >
        {this.renderNotificationHeader(notification)}
        {this.renderNotificationContent(notification)}
        {this.renderAlertColorStrip()}
      </div>
    )
  }
}
