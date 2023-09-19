import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Popover } from '../../Popover'
import dayjs from '../../../js/dayjsWithPlugins'
import { isMobile } from 'react-device-detect'
import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
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
  initializeAlert,
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
import { Button } from '../../Button'
import { ConfirmPopover } from '../../ConfirmPopover'

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
    onCollapseCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onDeleteEnd: PropTypes.func,
    onDeleteSuccessCallback: PropTypes.func,
    onDismissSuccessCallback: PropTypes.func,
    onErrorCallback: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,
    onClick: PropTypes.func,
    onDataAlertChange: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    onQueryClick: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    autoChartAggregations: false,
    onQueryClick: undefined,
    onRuleFetchCallback: () => {},
    updateScrollbars: () => {},
    onExpandCallback: () => {},
    onCollapseCallback: () => {},
    onDismissCallback: () => {},
    onDeleteClick: () => {},
    onDeleteEnd: () => {},
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
      this.props.updateScrollbars(500)
      if (!this.state.queryResponse) {
        this.fetchNotification()
      }
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.initialCollapseTimer)
  }

  isError = () => {
    return this.props.notification?.outcome === 'ERROR'
  }

  isUnread = () => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(this.props.notification?.state)
  }

  fetchNotification = () => {
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

    if (this.isUnread()) {
      this.markAsRead()
    }
  }

  collapse = () => {
    this.setState({ expanded: false, isMoreOptionsMenuOpen: false })
  }

  onClick = (notification) => {
    if (this.state.expanded) {
      this.collapse()
      this.props.onCollapseCallback(notification)
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
    this.props.onDeleteClick(this.props.notification)

    deleteNotification({
      ...getAuthentication(this.props.authentication),
      notificationId: this.props.notification.id,
    })
      .then(this.props.onDeleteSuccessCallback)
      .catch(this.props.onErrorCallback)
      .finally(this.props.onDeleteEnd)
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

  getFormattedTimestamp = () => {
    const timestamp = this.props.notification.created_at

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

  isDataAlertInErrorState = () => {
    const { dataAlert } = this.props
    return (
      dataAlert?.status === 'GENERAL_ERROR' ||
      dataAlert?.status === 'EVALUATION_ERROR' ||
      dataAlert?.status === 'DATA_RETURN_ERROR'
    )
  }

  renderNotificationTitle = () => {
    if (this.isError()) {
      return (
        <span>
          <Icon type='warning-triangle' /> Data Alert Error
        </span>
      )
    }

    return <span>{this.props.notification.title}</span>
  }

  renderNotificationMessage = () => {
    if (this.isError()) {
      return `Your Data Alert "${this.props.notification.title}" encountered a problem. Click for more information.`
    }

    return this.props.notification.message
  }

  renderNotificationHeader = () => {
    return (
      <div className='react-autoql-notification-list-item-header' onClick={() => this.onClick(this.props.notification)}>
        <div className='react-autoql-notification-display-name-container'>
          <div className='react-autoql-notification-display-name'>{this.renderNotificationTitle()}</div>
          <div className='react-autoql-notification-description'>{this.renderNotificationMessage()}</div>
          <div className='react-autoql-notification-timestamp-container'>
            <span className='react-autoql-notification-timestamp'>
              <Icon type='calendar' /> {this.getFormattedTimestamp()}
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
          containerClassName='react-autoql-notification-options-popover'
          content={this.moreOptionsMenu()}
          isOpen={this.state.isMoreOptionsMenuOpen}
          onClickOutside={() => this.setState({ isMoreOptionsMenuOpen: false })}
        >
          <div>
            <Icon
              type='more-vertical'
              className='react-autoql-notification-options-btn'
              data-tooltip-content='Options'
              data-tooltip-id={this.props.tooltipID ?? 'react-autoql-notification-tooltip'}
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
    this.setState({ isMoreOptionsMenuOpen: false })
    callback()
  }

  moreOptionsMenu = () => {
    const isUnread = this.isUnread()
    const status = this.state.dataAlertStatus ?? this.props.dataAlert?.status
    const isActive = status === 'ACTIVE' || status === 'WAITING'

    return (
      <Menu>
        {!!this.props.dataAlert && !isMobile && (
          <MenuItem
            data-test='react-autoql-toolbar-more-options-notification'
            title='Settings'
            subtitle='View and edit this Data Alert'
            icon='settings'
            onClick={(e) => this.onOptionClick(() => this.props.onEditClick(this.props.dataAlert))}
          />
        )}
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

    if (!notification?.expression) {
      return null
    }

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
          sentenceCase
          useRT
        />
      </div>
    )
  }

  restartAlert = () => {
    this.setState({ isInitializing: true })
    initializeAlert({
      id: this.props.dataAlert?.id,
      ...getAuthentication(this.props.authentication),
    })
      .then(() => {
        this.setState({ initializeSuccess: true })
        this.props.onSuccessCallback('Restart successful! Your Data Alert is now active.')
      })
      .catch((error) => {
        console.error(error)
        this.setState({ initializeError: true })
        this.props.onErrorCallback('Data Alert restart unsuccessful. Please try again in a few minutes.')
      })
      .finally(() => {
        this.setState({ isInitializing: false })
        this.props.onDataAlertChange()
      })
  }

  renderErrorDetails = () => {
    if (this.props.dataAlert?.id && !this.isDataAlertInErrorState()) {
      const query = this.props.notification?.data_return_query
      return (
        <>
          <br />
          <span>To resolve this issue, try restarting the Alert by clicking the button below.</span>
          <br />
          <Button
            type='primary'
            icon={this.state.initializeSuccess ? 'check' : 'refresh'}
            loading={this.state.isInitializing}
            className={`notification-error-reinitialize-btn ${this.state.initializeSuccess ? 'restart-success' : ''}`}
            onClick={this.restartAlert}
          >
            {this.state.initializeSuccess ? 'Restarted' : 'Restart Alert'}
          </Button>
          <br />
          <span>
            If the problem persists, you may need to create a new Data Alert
            {query ? (
              <span>
                {' '}
                from the query{' '}
                {!!this.props.onQueryClick ? (
                  <a
                    onClick={() => this.props.onQueryClick(query)}
                    data-tooltip-content='Click to run this query in Data Messenger'
                    data-tooltip-id={this.props.tooltipID}
                  >
                    "{query}"
                  </a>
                ) : (
                  <span>
                    <em>"{query}"</em>
                  </span>
                )}
              </span>
            ) : (
              <span>.</span>
            )}
          </span>
        </>
      )
    }

    return (
      <span>
        It has since been{' '}
        {this.props.dataAlert?.id
          ? 'restarted and is no longer in an error state. '
          : 'deleted and no longer triggering notifications.'}{' '}
        Feel free to{' '}
        <ConfirmPopover
          className='notification-delete-confirm-popover'
          popoverParentElement={this.props.popoverParentElement ?? this.notificationItemRef}
          title='Delete this Notification?'
          onConfirm={this.delete}
          confirmText='Delete'
          backText='Cancel'
          positions={['top', 'bottom', 'left', 'right']}
          align='end'
        >
          <a>delete</a>
        </ConfirmPopover>{' '}
        this notification.
      </span>
    )
  }

  renderErrorMessage = () => {
    let timestamp = this.getFormattedTimestamp()
    if (!timestamp.includes('today')) {
      timestamp = `on ${timestamp}`
    }

    return (
      <div className='notification-error-message-container'>
        <div>
          This Data Alert encountered an error {timestamp}. {this.renderErrorDetails()}
        </div>
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
            {this.isError() ? (
              this.renderErrorMessage()
            ) : (
              <>
                {this.renderSummarySection()}
                <NotificationQueryResponse
                  key={this.state.queryResponse?.data?.data?.query_id}
                  authentication={this.props.authentication}
                  autoQLConfig={this.props.autoQLConfig}
                  dataFormatting={this.props.dataFormatting}
                  queryResponse={this.state.queryResponse}
                  autoChartAggregations={this.props.autoChartAggregations}
                  enableAjaxTableData={this.props.enableAjaxTableData}
                  onSuccessCallback={this.props.onSuccessCallback}
                  onErrorCallback={this.props.onErrorCallback}
                  popoverParentElement={this.props.popoverParentElement ?? this.notificationItemRef}
                  isResizing={this.props.isResizing}
                  shouldRender={this.state.expanded}
                />
              </>
            )}
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
          ref={(r) => (this.notificationItemRef = r)}
          className={`react-autoql-notification-list-item
          ${this.state.expanded ? 'expanded' : 'collapsed'}
          ${this.isUnread() ? 'unread' : ''}
          ${this.isError() ? 'is-error' : ''}
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
