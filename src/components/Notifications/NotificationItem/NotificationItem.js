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
import { ExpressionBuilderSimple } from '../ExpressionBuilderSimple'
import { VizToolbar } from '../../VizToolbar'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  fetchRule,
} from '../../../js/notificationService'
import dayjs from '../../../js/dayjsWithPlugins'
import {
  getSupportedDisplayTypes,
  getDefaultDisplayType,
  capitalizeFirstChar,
} from '../../../js/Util'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../../props/defaults'

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
    onDeleteSuccessCallback: PropTypes.func,
    onErrorCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    autoChartAggregations: false,
    onRuleFetchCallback: () => {},
    onExpandCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onDeleteSuccessCallback: () => {},
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
      const displayType = this.props.autoChartAggregations && this.supportedDisplayTypes.includes('column')
        ? 'column'
        : getDefaultDisplayType(queryResponse, this.props.autoChartAggregations)
      this.setState({ displayType })
    }
  }

  getIsTriggered = (state) => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(state)
  }

  fetchRuleDetails = (notification) => {
    this.setState({ ruleDetails: undefined, dataAlertStatus: undefined })
    fetchRule({
      dataAlertId: notification.data_alert_id,
      ...getAuthentication(this.props.authentication),
    })
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
      ...getAuthentication(this.props.authentication),
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
      ...getAuthentication(this.props.authentication),
      notificationId: notification.id,
    })
      .then(() => {
        this.props.onDeleteSuccessCallback()
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
  }

  changeRuleStatus = (notification, status) => {
    updateDataAlertStatus({
      dataAlertId: notification.data_alert_id,
      type: notification.data_alert_type,
      status,
      ...getAuthentication(this.props.authentication),
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

  renderAlertColorStrip = () => (
    <div className="react-autoql-notification-alert-strip" />
  )

  renderNotificationHeader = (notification) => {
    return (
      <div
        className="react-autoql-notification-list-item-header"
        onClick={() => {
          this.onClick(notification)
        }}
      >
        <div className="react-autoql-notification-display-name-container">
          <div className="react-autoql-notification-display-name">
            {notification.title}
          </div>
          <div className="react-autoql-notification-description">
            {notification.message}
          </div>
          <div className="react-autoql-notification-timestamp">
            <Icon type="calendar" />{' '}
            {this.formatTimestamp(notification.created_at)}
          </div>
        </div>
        {this.getIsTriggered(notification.state) ? (
          <div className="react-autoql-notification-dismiss-btn">
            <Icon
              type="notification-off"
              className="react-autoql-notification-dismiss-icon"
              data-tip="Dismiss"
              data-for="react-autoql-notification-tooltip"
              onClick={(e) => {
                this.onDismissClick(e, notification)
                ReactTooltip.hide()
              }}
            />
          </div>
        ) : (
          <div className="react-autoql-notification-dismiss-btn">
            <Icon
              type="close"
              className="react-autoql-notification-delete-icon"
              data-tip="Delete"
              data-for="react-autoql-notification-tooltip"
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

  renderTurnOnNotificationIcon = (notification) => {
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
          <Icon type="notification-off" /> Turn Data Alert Off
        </Button>
      )
    }

    return (
      <Button
        onClick={() => this.changeRuleStatus(notification, 'ACTIVE')}
        type="default"
      >
        <Icon type="notification" /> Turn Data Alert On
      </Button>
    )
  }

  renderEditNotificationIcon = () => {
    if (!this.state.ruleDetails || this.state.ruleDetails.type === 'PROJECT') {
      return <div />
    } else if (_isEmpty(this.state.ruleDetails)) {
      return (
        <div className="notification-deleted-text">
          This Data Alert no longer exists.
        </div>
      )
    }

    return (
      <Button
        onClick={() => this.props.onEditClick(this.state.ruleDetails)}
        type="default"
      >
        <Icon type="edit" /> Edit Data Alert
      </Button>
    )
  }

  renderNotificationFooter = (notification) => {
    return (
      <div
        className="react-autoql-notification-extra-content"
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        {this.renderTurnOnNotificationIcon(notification)}
        {this.renderEditNotificationIcon()}
      </div>
    )
  }

  renderNotificationContent = (notification) => {
    const queryTitle = notification.data_return_query
    const queryTitleCapitalized = capitalizeFirstChar(queryTitle)
    let queryResponse
    if (_get(this.props.activeNotificationData, 'error')) {
      queryResponse = this.props.activeNotificationData.error
    } else {
      queryResponse = {
        data: this.props.activeNotificationData,
      }
    }

    return (
      <div
        className={`react-autoql-notification-expanded-content ${
          notification.expanded ? ' visible' : ''
        }`}
      >
        <div className="react-autoql-notification-details-container">
          <div
            className="react-autoql-notification-data-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="react-autoql-notificaton-chart-container">
              {this.props.activeNotificationData && notification.expanded ? (
                <Fragment>
                  <div className="react-autoql-notification-query-title">
                    {queryTitleCapitalized}
                  </div>
                  <QueryOutput
                    authentication={getAuthentication(
                      this.props.authentication
                    )}
                    ref={(r) => (this.OUTPUT_REF = r)}
                    queryResponse={queryResponse}
                    autoQLConfig={{ enableDrilldowns: false }}
                    themeConfig={getThemeConfig(this.props.themeConfig)}
                    displayType={this.state.displayType}
                    autoChartAggregations={this.props.autoChartAggregations}
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
              <div className="react-autoql-notification-viz-switcher">
                <VizToolbar
                  themeConfig={getThemeConfig(this.props.themeConfig)}
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
            <div className="react-autoql-notification-details">
              <div className="react-autoql-notification-details-title">
                Conditions:
              </div>
              <ExpressionBuilderSimple
                authentication={getAuthentication(this.props.authentication)}
                themeConfig={getThemeConfig(this.props.themeConfig)}
                key={`expression-builder-${this.COMPONENT_KEY}`}
                expression={_get(notification, 'expression')}
                readOnly
              />
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
      <ErrorBoundary>
        <div
          id={`react-autoql-notification-item-${this.COMPONENT_KEY}`}
          key={`react-autoql-notification-item-${this.COMPONENT_KEY}`}
          className={`react-autoql-notification-list-item
          ${this.getIsTriggered(notification.state) ? ' triggered' : ''}
          ${notification.expanded ? ' expanded' : ''}
          ${this.state.fullyExpanded ? ' animation-complete' : ''}`}
        >
          {this.renderNotificationHeader(notification)}
          {this.renderNotificationContent(notification)}
          {this.renderAlertColorStrip()}
        </div>
      </ErrorBoundary>
    )
  }
}
