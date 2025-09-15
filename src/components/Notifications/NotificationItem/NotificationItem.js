import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import dayjs from '../../../js/dayjsWithPlugins'
import { isMobile } from 'react-device-detect'
import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  markNotificationAsUnread,
  initializeAlert,
  isNumber,
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAuthentication,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { Button } from '../../Button'
import { Popover } from '../../Popover'
import { Tooltip } from '../../Tooltip'
import { Menu, MenuItem } from '../../Menu'
import { LoadingDots } from '../../LoadingDots'
import { ConfirmPopover } from '../../ConfirmPopover'
import { ConditionBuilder } from '../ConditionBuilder'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { NotificationQueryResponse } from '../NotificationQueryResponse'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './NotificationItem.scss'

export default class NotificationItem extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.TOOLTIP_ID = `react-autoql-notification-item-tooltip-${uuid()}`
    this.CHART_TOOLTIP_ID = `react-autoql-notification-item-chart-tooltip-${uuid()}`

    this.state = {
      expanded: props.defaultExpanded,
      dataAlertStatus: undefined,
      queryResponse: undefined,
      isMoreOptionsMenuOpen: false,
      enableMoreOptionsMenu: props.enableMoreOptionsMenu,
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
    onClick: PropTypes.func,
    onDataAlertChange: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    onQueryClick: PropTypes.func,
    enableSettingsMenu: PropTypes.bool,
    enableNotificationsMenu: PropTypes.bool,
    displayProjectName: PropTypes.bool,
    defaultExpanded: PropTypes.bool,
    enableMoreOptionsMenu: PropTypes.bool,
    tooltipID: PropTypes.string,
    chartTooltipID: PropTypes.string,
    shouldRenderSummarySection: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    autoChartAggregations: false,
    onQueryClick: undefined,
    enableSettingsMenu: true,
    enableNotificationsMenu: true,
    displayProjectName: false,
    defaultExpanded: false,
    enableMoreOptionsMenu: true,
    shouldRenderSummarySection: false,
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

  componentDidMount = () => {
    if (this.props.defaultExpanded) {
      this.setState({ queryResponse: { data: this.props.notification.query_result } })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.expanded && !prevState.expanded) {
      this.props.updateScrollbars(500)
      if (!this.state.queryResponse && this.props.notification?.query_result) {
        this.setState({ queryResponse: { data: this.props.notification.query_result } })
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

  displayDeleteAnimation = () => {
    return new Promise((resolve, reject) => {
      this.setState({ deleted: true })
      return setTimeout(() => {
        resolve()
      }, 300)
    })
  }

  delete = async () => {
    // await this.displayDeleteAnimation()
    // comment out above as an workaround of a duplicated animation issue

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
    if (dayjs().isSame(dateDayJS, 'year')) {
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
      dataAlert?.status === 'UNRECOVERABLE'
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

    return (
      <span>
        {this.props.notification?.project?.id === 'composite' && <Icon type='layers' style={{ marginRight: '5px' }} />}
        {this.props.notification.title}
      </span>
    )
  }

  renderNotificationMessage = () => {
    if (this.isError()) {
      return `Your Data Alert "${this.props.notification.title}" encountered a problem. Click for more information.`
    }

    return this.props.notification.message
  }
  renderProjectName = () => {
    return (
      <div className='react-autoql-notification-project-name'>
        <span>{this.props.notification.project?.name}</span>
      </div>
    )
  }
  renderNotificationHeader = () => {
    return (
      <div className='react-autoql-notification-list-item-header' onClick={() => this.onClick(this.props.notification)}>
        <div className='react-autoql-notification-display-name-container'>
          <div className='react-autoql-notification-display-name'>{this.renderNotificationTitle()}</div>
          {this.props.displayProjectName && this.renderProjectName()}
          <div className='react-autoql-notification-description'>{this.renderNotificationMessage()}</div>
          <div className='react-autoql-notification-timestamp-container'>
            <span className='react-autoql-notification-timestamp'>
              <Icon type='calendar' /> {this.getFormattedTimestamp()}
            </span>
          </div>
        </div>
        {this.state.enableMoreOptionsMenu && this.moreOptionsButton()}
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
        {!!this.props.dataAlert && !isMobile && !!this.props.enableSettingsMenu && (
          <MenuItem
            data-test='react-autoql-toolbar-more-options-notification'
            title='Settings'
            subtitle='View and edit this Data Alert'
            icon='settings'
            onClick={(e) => this.onOptionClick(() => this.props.onEditClick(this.props.dataAlert))}
          />
        )}
        {!!status && !!this.props.enableNotificationsMenu && (
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
    const queryResultMetadata = { data: notification?.result_metadata }
    if (queryResultMetadata.data !== null) {
      return (
        <div className='react-autoql-notification-condition-statement'>
          <span>Summary: </span>
          <ConditionBuilder
            key={`expression-builder-${this.COMPONENT_KEY}`}
            expression={notification?.expression}
            queryResponse={queryResponse}
            queryResultMetadata={queryResultMetadata}
            conditionStatementOnly
            conditionTense='past'
            sentenceCase
            useRT
          />
        </div>
      )
    }
    return null
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
    if (this.props.dataAlert?.id && this.isDataAlertInErrorState()) {
      return (
        <>
          <br />
          <span>To resolve this issue, try restarting the Alert by clicking the button below.</span>
          <p>
            <Button
              type='primary'
              icon={this.state.initializeSuccess ? 'check' : 'refresh'}
              loading={this.state.isInitializing}
              className={`notification-error-reinitialize-btn ${this.state.initializeSuccess ? 'restart-success' : ''}`}
              onClick={this.restartAlert}
            >
              {this.state.initializeSuccess ? 'Restarted' : 'Restart Alert'}
            </Button>
          </p>
          <span>If the problem persists, you may need to create a new Data Alert.</span>
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
                {this.props.shouldRenderSummarySection && this.renderSummarySection()}
                {!!this.state.expanded && (
                  <NotificationQueryResponse
                    key={this.state.queryResponse?.data?.data?.query_id}
                    authentication={this.props.authentication}
                    autoQLConfig={this.props.autoQLConfig}
                    dataFormatting={this.props.dataFormatting}
                    queryResponse={this.state.queryResponse}
                    autoChartAggregations={this.props.autoChartAggregations}
                    onSuccessCallback={this.props.onSuccessCallback}
                    onErrorCallback={this.props.onErrorCallback}
                    popoverParentElement={this.props.popoverParentElement ?? this.notificationItemRef}
                    isResizing={this.props.isResizing}
                    shouldRender={this.state.expanded}
                    tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
                    chartTooltipID={this.props.chartTooltipID ?? this.CHART_TOOLTIP_ID}
                    enableFilterBtn={this.props.enableFilterBtn}
                    enableCustomColumns={this.props.enableCustomColumns}
                  />
                )}
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
          ${this.state.isMoreOptionsMenuOpen ? 'menu-open' : ''}
          ${this.state.deleted ? 'react-autoql-notification-item-deleted' : ''}
          ${this.props.notification?.project?.id === 'composite' ? 'composite-project' : ''}`}
        >
          {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} delayShow={500} />}
          {!this.props.chartTooltipID && <Tooltip tooltipId={this.CHART_TOOLTIP_ID} delayShow={0} />}
          {this.renderNotificationHeader()}
          {this.renderNotificationContent()}
          {this.renderAlertColorStrip()}
          <div className='react-autoql-notification-item-hover-overlay' />
        </div>
      </ErrorBoundary>
    )
  }
}
