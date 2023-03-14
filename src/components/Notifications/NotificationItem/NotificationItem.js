import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEmpty from 'lodash.isempty'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import { Button } from '../../Button'
import { ExpressionBuilderSimple } from '../ExpressionBuilderSimple'
import { VizToolbar } from '../../VizToolbar'
import { hideTooltips } from '../../Tooltip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  fetchRule,
} from '../../../js/notificationService'
import dayjs from '../../../js/dayjsWithPlugins'
import { capitalizeFirstChar, isNumber } from '../../../js/Util'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './NotificationItem.scss'

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    authentication: authenticationType,
    notification: PropTypes.shape({}).isRequired,
    activeNotificationData: PropTypes.shape({}),
    showNotificationDetails: PropTypes.bool,
    onRuleFetchCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    onDeleteSuccessCallback: PropTypes.func,
    onDismissSuccessCallback: PropTypes.func,
    onErrorCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,
    onClick: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    autoChartAggregations: false,
    onRuleFetchCallback: () => {},
    onExpandCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onDeleteSuccessCallback: () => {},
    onDismissSuccessCallback: () => {},
    onErrorCallback: () => {},
    onClick: () => {},
  }

  state = {
    ruleStatus: undefined,
    ruleDetails: undefined,
    fullyExpanded: false,
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
    })
      .then(() => {
        this.props.onDismissSuccessCallback()
      })
      .catch((error) => {
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
    let dateDayJS
    if (isNumber(timestamp)) {
      dateDayJS = dayjs.unix(timestamp)
    } else {
      dateDayJS = dayjs(timestamp)
    }

    const time = dateDayJS.format('h:mma')
    const day = dateDayJS.format('MM-DD-YY')

    const today = dayjs().format('MM-DD-YY')
    const yesterday = dayjs().subtract(1, 'd').format('MM-DD-YY')

    if (day === today) {
      return `Today at ${time}`
    } else if (day === yesterday) {
      return `Yesterday at ${time}`
    } else if (dayjs().isSame(dateDayJS, 'year')) {
      return `${dateDayJS.format('MMMM Do')} at ${time}`
    }
    return `${dateDayJS.format('MMMM Do, YYYY')} at ${time}`
  }

  renderAlertColorStrip = () => <div className='react-autoql-notification-alert-strip' />

  renderNotificationHeader = (notification) => {
    return (
      <div
        className='react-autoql-notification-list-item-header'
        onClick={() => {
          this.onClick(notification)
        }}
      >
        <div className='react-autoql-notification-display-name-container'>
          <div className='react-autoql-notification-display-name'>{notification.title}</div>
          <div className='react-autoql-notification-description'>{notification.message}</div>
          <div className='react-autoql-notification-timestamp-container'>
            <span className='react-autoql-notification-timestamp'>
              <Icon type='calendar' /> {this.formatTimestamp(notification.created_at)}
            </span>
          </div>
        </div>
        {this.getIsTriggered(notification.state) ? (
          <div className='react-autoql-notification-dismiss-btn'>
            <Icon
              type='notification-off'
              className='react-autoql-notification-dismiss-icon'
              data-tip='Dismiss'
              data-for={this.props.tooltipID ?? 'react-autoql-notification-tooltip'}
              onClick={(e) => {
                this.onDismissClick(e, notification)
                hideTooltips()
              }}
            />
          </div>
        ) : (
          <div className='react-autoql-notification-dismiss-btn'>
            <Icon
              type='close'
              className='react-autoql-notification-delete-icon'
              data-tip='Delete'
              data-for={this.props.tooltipID ?? 'react-autoql-notification-tooltip'}
              onClick={(e) => {
                this.onDeleteClick(e, notification)
                hideTooltips()
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
        <Button onClick={() => this.changeRuleStatus(notification, 'INACTIVE')} type='default'>
          <Icon type='notification-off' /> Turn Data Alert Off
        </Button>
      )
    }

    return (
      <Button onClick={() => this.changeRuleStatus(notification, 'ACTIVE')} type='default'>
        <Icon type='notification' /> Turn Data Alert On
      </Button>
    )
  }

  renderEditNotificationIcon = () => {
    if (!this.state.ruleDetails || this.state.ruleDetails.type === 'PROJECT') {
      return <div />
    } else if (_isEmpty(this.state.ruleDetails)) {
      return <div className='notification-deleted-text'>This Data Alert no longer exists.</div>
    }

    return (
      <Button onClick={() => this.props.onEditClick(this.state.ruleDetails)} type='default'>
        <Icon type='edit' /> Edit Data Alert
      </Button>
    )
  }

  renderNotificationFooter = (notification) => {
    return (
      <div
        className='react-autoql-notification-extra-content'
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
      <div className={`react-autoql-notification-expanded-content ${notification.expanded ? ' visible' : ''}`}>
        <div className='react-autoql-notification-details-container'>
          <div className='react-autoql-notification-data-container' onClick={(e) => e.stopPropagation()}>
            <div className='react-autoql-notificaton-chart-container'>
              {this.props.activeNotificationData && notification.expanded ? (
                <Fragment>
                  <div className='react-autoql-notification-query-title'>{queryTitleCapitalized}</div>
                  <QueryOutput
                    style={{ flex: '1' }}
                    authentication={this.props.authentication}
                    ref={(r) => (this.OUTPUT_REF = r)}
                    key={queryResponse?.data?.data?.query_id}
                    queryResponse={queryResponse}
                    autoQLConfig={{ enableDrilldowns: false }}
                    autoChartAggregations={this.props.autoChartAggregations}
                    enableAjaxTableData={this.props.enableAjaxTableData}
                  />
                </Fragment>
              ) : (
                <div className='loading-container-centered'>
                  <LoadingDots />
                </div>
              )}
            </div>
            {this.OUTPUT_REF?.supportedDisplayTypes?.length > 1 && (
              <div className='react-autoql-notification-viz-switcher'>
                <VizToolbar ref={(r) => (this.vizToolbarRef = r)} responseRef={this.OUTPUT_REF} vertical />
              </div>
            )}
          </div>
          {this.props.showNotificationDetails && notification.expanded && (
            <div className='react-autoql-notification-details'>
              <div className='react-autoql-notification-details-title'>Conditions:</div>
              <ExpressionBuilderSimple
                authentication={this.props.authentication}
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

    console.log({ activeNotificationData: this.props.activeNotificationData, notification })

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
