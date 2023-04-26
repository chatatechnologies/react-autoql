import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Popover } from 'react-tiny-popover'
import dayjs from '../../../js/dayjsWithPlugins'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { hideTooltips } from '../../Tooltip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConditionBuilder } from '../ConditionBuilder'
import NotificationQueryResponse from './NotificationQueryResponse'
import { Menu, MenuItem } from '../../Menu'

import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  fetchNotificationData,
  markNotificationAsUnread,
} from '../../../js/notificationService'
import { isNumber } from '../../../js/Util'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
} from '../../../props/defaults'

import './NotificationItem.scss'

export default class NotificationItem extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      expanded: false,
      dataAlertStatus: undefined,
      queryResponse: undefined,
      isMoreOptionsMenuOpen: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    notification: PropTypes.shape({}).isRequired,
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
    onDataAlertChange: PropTypes.func,
    onSuccessCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    autoChartAggregations: false,
    onRuleFetchCallback: () => {},
    onExpandCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onDeleteSuccessCallback: () => {},
    onDismissSuccessCallback: () => {},
    onUnreadCallback: () => {},
    onErrorCallback: () => {},
    onClick: () => {},
    onDataAlertChange: () => {},
    onSuccessCallback: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.expanded && !prevState.expanded) {
      if (!this.state.queryResponse) {
        this.fetchQueryResponse()
      }
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.initialCollapseTimer)
  }

  getIsUnread = () => {
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

  expand = () => {
    this.setState({ expanded: true })

    if (this.getIsUnread()) {
      this.markAsRead()
    }
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

  markAsUnread = () => {
    this.props.onUnreadCallback(this.props.notification)

    markNotificationAsUnread({
      ...getAuthentication(this.props.authentication),
      notificationId: this.props.notification.id,
    })
      .then(this.props.onDismissSuccessCallback)
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
  }

  markAsRead = () => {
    this.props.onDismissCallback(this.props.notification)

    dismissNotification({
      ...getAuthentication(this.props.authentication),
      notificationId: this.props.notification.id,
    })
      .then(this.props.onDismissSuccessCallback)
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
  }

  delete = () => {
    this.props.onDeleteCallback(this.props.notification)

    deleteNotification({
      ...getAuthentication(this.props.authentication),
      notificationId: this.props.notification.id,
    })
      .then(() => {
        this.props.onDeleteSuccessCallback()
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
  }

  changeDataAlertStatus = (status) => {
    updateDataAlertStatus({
      dataAlertId: this.props.notification.data_alert_id,
      type: this.props.notification.data_alert_type,
      status,
      ...getAuthentication(this.props.authentication),
    })
      .then(() => {
        this.setState({ dataAlertStatus: status })
        const successText =
          status === 'ACTIVE'
            ? 'Data Alert reactivated! You will start receiving notifications for this Data Alert again.'
            : 'You will no longer receive notifications like this.'
        this.props.onSuccessCallback(successText)
        this.props.onDataAlertChange()
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
    return (
      <div className='react-autoql-notification-list-item-header' onClick={() => this.onClick(this.props.notification)}>
        <div className='react-autoql-notification-display-name-container'>
          <div className='react-autoql-notification-display-name'>{this.props.notification.title}</div>
          <div className='react-autoql-notification-description'>{this.props.notification.message}</div>
          <div className='react-autoql-notification-timestamp-container'>
            <span className='react-autoql-notification-timestamp'>
              <Icon type='calendar' /> {this.formatTimestamp(this.props.notification.created_at)}
            </span>
          </div>
        </div>
        {this.moreOptionsButton()}
        {this.renderExpandArrow()}
      </div>
    )
  }

  renderExpandArrow = () => {
    return (
      <div className='react-autoql-notification-item-expand-arrow'>
        <Icon type='caret-down' />
      </div>
    )
  }

  moreOptionsButton = () => {
    return (
      <div
        className='react-autoql-notification-options-btn-container'
        onClick={() => this.setState({ isMoreOptionsMenuOpen: !this.state.isMoreOptionsMenuOpen })}
      >
        <Popover
          align='start'
          positions={['left', 'bottom', 'top', 'right']}
          content={this.moreOptionsMenu()}
          isOpen={this.state.isMoreOptionsMenuOpen}
          onClickOutside={() => this.setState({ isMoreOptionsMenuOpen: false })}
        >
          <div>
            <Icon
              type='more-vertical'
              className='react-autoql-notification-options-btn'
              data-tip='Options'
              data-for={this.props.tooltipID ?? 'react-autoql-notification-tooltip'}
              onClick={(e) => {
                e.stopPropagation()
                this.setState({ isMoreOptionsMenuOpen: true })
              }}
            />
          </div>
        </Popover>
      </div>
    )
  }

  onOptionClick = (callback = () => {}) => {
    hideTooltips()
    this.setState({ isMoreOptionsMenuOpen: false })
    callback()
  }

  moreOptionsMenu = () => {
    const isUnread = this.getIsUnread()
    const status = this.state.dataAlertStatus ?? this.props.dataAlert?.status
    const isActive = status === 'ACTIVE' || status === 'WAITING'

    return (
      <Menu>
        <MenuItem
          data-test='react-autoql-toolbar-more-options-notification'
          title='Settings'
          subtitle='View and edit this Data Alert'
          icon='settings'
          onClick={(e) => this.onOptionClick(() => this.props.onEditClick(this.props.dataAlert))}
        />
        {!!status && (
          <MenuItem
            onClick={() => this.onOptionClick(() => this.changeDataAlertStatus(isActive ? 'INACTIVE' : 'ACTIVE'))}
            icon={isActive ? 'notification-off' : 'notification'}
            title={`Turn ${isActive ? 'off' : 'on'}`}
            subtitle={
              isActive
                ? 'Stop receiving notifications for this Data Alert'
                : 'Start receiving notifications for this Data Alert again'
            }
          />
        )}
        <MenuItem
          onClick={() => this.onOptionClick(isUnread ? this.markAsRead : this.markAsUnread)}
          icon={isUnread ? 'mark-read' : 'mark-unread'}
          title={`Mark as ${isUnread ? 'read' : 'unread'}`}
        />
        <MenuItem onClick={() => this.onOptionClick(this.delete)} icon='trash' title='Delete' />
      </Menu>
    )
  }

  renderLoader = () => {
    return (
      <div style={{ position: 'absolute', top: 0 }} className='loading-container-centered'>
        <LoadingDots />
      </div>
    )
  }

  renderSummarySection = () => {
    const { notification } = this.props
    const queryResponse = { data: notification?.query_result }

    return (
      <div className='react-autoql-notification-condition-statement'>
        <span>Summary: </span>
        <ConditionBuilder
          key={`expression-builder-${this.COMPONENT_KEY}`}
          expression={notification?.expression}
          queryResponse={queryResponse}
          conditionStatementOnly
          conditionTense='past'
          useRT
        />
      </div>
    )
  }

  renderNotificationContent = () => {
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
            {this.renderSummarySection()}
            <NotificationQueryResponse
              key={this.state.queryResponse?.data?.data?.query_id}
              authentication={this.props.authentication}
              autoQLConfig={this.props.autoQLConfig}
              dataFormatting={this.props.dataFormatting}
              queryResponse={this.state.queryResponse}
              autoChartAggregations={this.props.autoChartAggregations}
              enableAjaxTableData={this.props.enableAjaxTableData}
              isResizing={this.props.isResizing}
              shouldRender={this.state.expanded}
            />
          </div>
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
          ${this.getIsUnread() ? 'unread' : ''}
          ${this.state.isMoreOptionsMenuOpen ? 'menu-open' : ''}`}
        >
          {this.renderNotificationHeader()}
          {this.renderNotificationContent()}
          {this.renderAlertColorStrip()}
          <div className='react-autoql-notification-item-hover-overlay' />
        </div>
      </ErrorBoundary>
    )
  }
}
