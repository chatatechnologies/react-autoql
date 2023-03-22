import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEmpty from 'lodash.isempty'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import { Button } from '../../Button'
import { VizToolbar } from '../../VizToolbar'
import { hideTooltips } from '../../Tooltip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConditionBuilder } from '../ConditionBuilder'

import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  fetchRule,
  fetchNotificationData,
} from '../../../js/notificationService'
import dayjs from '../../../js/dayjsWithPlugins'
import { isNumber } from '../../../js/Util'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'

import './NotificationItem.scss'
import { Popover } from 'react-tiny-popover'

export default class NotificationItem extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      expanded: false,
      ruleStatus: undefined,
      ruleDetails: undefined,
      queryResponse: undefined,
      isMoreOptionsMenuOpen: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    notification: PropTypes.shape({}).isRequired,
    activeNotificationData: PropTypes.shape({}),
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

  componentDidMount = () => {
    // Wait for animation to finish, then set card height
    // this.initialCollapseTimer = setTimeout(() => {
    //   this.saveCurrentExpandedHeight()
    // }, 400)
  }

  // shouldComponentUpdate = (prevProps, prevState) => {
  //   if (!this.state.expanded && !prevState.expanded) {
  //     return false
  //   }

  //   return true
  // }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.expanded && !prevState.expanded) {
      if (!this.state.queryResponse) {
        this.fetchQueryResponse()
      }

      if (!this.state.ruleDetails) {
        this.fetchRuleDetails()
      }
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.initialCollapseTimer)
  }

  getIsTriggered = () => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(this.props.notification?.state)
  }

  fetchQueryResponse = () => {
    const { notification } = this.props
    fetchNotificationData({ id: notification.id, ...getAuthentication(this.props.authentication) })
      .then((response) => {
        this.setState({ queryResponse: response })
      })
      .catch((error) => {
        this.setState({ queryResponse: error })
      })
  }

  fetchRuleDetails = () => {
    const { notification } = this.props
    fetchRule({
      dataAlertId: notification.data_alert_id,
      ...getAuthentication(this.props.authentication),
    })
      .then((response) => {
        this.props.onRuleFetchCallback(response)
        this.setState({
          ruleDetails: response,
          ruleStatus: response?.status,
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  expand = () => {
    this.setState({ expanded: true })
  }

  collapse = () => {
    this.setState({ expanded: false, isMoreOptionsMenuOpen: false })
  }

  onClick = (notification) => {
    if (this.state.expanded) {
      this.collapse()
    } else {
      this.expand()
      this.props.onExpandCallback(notification)
    }
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

  renderNotificationHeader = () => {
    const { notification } = this.props

    return (
      <div className='react-autoql-notification-list-item-header' onClick={() => this.onClick(notification)}>
        <div className='react-autoql-notification-display-name-container'>
          <div className='react-autoql-notification-display-name'>{notification.title}</div>
          <div className='react-autoql-notification-description'>{notification.message}</div>
          <div className='react-autoql-notification-timestamp-container'>
            <span className='react-autoql-notification-timestamp'>
              <Icon type='calendar' /> {this.formatTimestamp(notification.created_at)}
            </span>
          </div>
        </div>
        {this.getIsTriggered() ? (
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
      <Button onClick={() => this.changeRuleStatus(notification, 'ACTIVE')} type='default' icon='notification'>
        Turn Data Alert On
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
      <Button onClick={() => this.props.onEditClick(this.state.ruleDetails)} type='default' icon='edit'>
        Edit Data Alert
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

  renderToolbar = () => {
    if (!this.state.expanded) {
      return null
    }

    return (
      <div className='react-autoql-notification-toolbar-container'>
        <VizToolbar ref={(r) => (this.vizToolbarRef = r)} responseRef={this.OUTPUT_REF} vertical />
        <Popover
          align='end'
          positions={['top', 'left', 'bottom', 'right']}
          content={<div>content</div>}
          isOpen={this.state.isMoreOptionsMenuOpen}
          onClickOutside={() => this.setState({ isMoreOptionsMenuOpen: false })}
        >
          <div
            className='react-autoql-notification-toolbar-more-options'
            onClick={() => this.setState({ isMoreOptionsMenuOpen: !this.state.isMoreOptionsMenuOpen })}
          >
            <Icon className='notification-toolbar-more-options-btn' type='more-vertical' />
          </div>
        </Popover>
      </div>
    )
  }

  renderQueryResponse = () => {
    const { queryResponse } = this.state
    // const queryTitle = this.props.notification?.data_return_query
    // const queryTitleCapitalized = capitalizeFirstChar(queryTitle)

    return (
      <div className='react-autoql-notificaton-chart-container'>
        {/* <div className='react-autoql-notification-query-title'>{queryTitleCapitalized}</div> */}
        <div ref={(r) => (this.dataContainer = r)} className='react-autoql-notification-query-data-container'>
          {queryResponse ? (
            <QueryOutput
              // key={queryResponse?.data?.data?.query_id}
              ref={(r) => (this.OUTPUT_REF = r)}
              vizToolbarRef={this.vizToolbarRef}
              authentication={this.props.authentication}
              queryResponse={queryResponse}
              autoQLConfig={{ enableDrilldowns: false }}
              autoChartAggregations={this.props.autoChartAggregations}
              enableAjaxTableData={this.props.enableAjaxTableData}
              isResizing={this.props.isResizing || !this.state.expanded}
            />
          ) : (
            <div style={{ position: 'absolute', top: 0 }} className='loading-container-centered'>
              <LoadingDots />
            </div>
          )}
        </div>
      </div>
    )
  }

  renderLoader = () => {
    return (
      <div style={{ position: 'absolute', top: 0 }} className='loading-container-centered'>
        <LoadingDots />
      </div>
    )
  }

  renderNotificationContent = () => {
    const { notification } = this.props

    return (
      <div
        ref={(r) => (this.contentRef = r)}
        className={`react-autoql-notification-expanded-content
        ${this.state.expanded ? 'expanded' : 'collapsed'}
        ${!this.state.queryResponse ? 'loading' : ''}`}
      >
        <>
          {!this.state.queryResponse && this.renderLoader()}
          <div className='react-autoql-notification-content-container'>
            <div className='react-autoql-notification-condition-statement'>
              {/* <div className='react-autoql-notification-query-title'>Conditions:</div> */}
              <ConditionBuilder
                key={`expression-builder-${this.COMPONENT_KEY}`}
                expression={notification?.expression}
                conditionStatementOnly
                conditionTense='past'
              />
            </div>
            <div className='react-autoql-notification-data-container' onClick={(e) => e.stopPropagation()}>
              {this.renderQueryResponse()}
              {this.renderToolbar()}
            </div>
          </div>
          {this.renderNotificationFooter(notification)}
        </>
      </div>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-notification-item-${this.COMPONENT_KEY}`}
          key={`react-autoql-notification-item-${this.COMPONENT_KEY}`}
          className={`react-autoql-notification-list-item
          ${this.state.expanded ? 'expanded' : 'collapsed'}
          ${this.getIsTriggered() ? ' triggered' : ''}`}
        >
          {this.renderNotificationHeader()}
          {this.renderNotificationContent()}
          {this.renderAlertColorStrip()}
        </div>
      </ErrorBoundary>
    )
  }
}
