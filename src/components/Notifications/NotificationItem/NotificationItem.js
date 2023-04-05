import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEmpty from 'lodash.isempty'
import { Popover } from 'react-tiny-popover'
import dayjs from '../../../js/dayjsWithPlugins'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import { VizToolbar } from '../../VizToolbar'
import { hideTooltips } from '../../Tooltip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConditionBuilder } from '../ConditionBuilder'
import { OptionsToolbar } from '../../OptionsToolbar'

import {
  dismissNotification,
  deleteNotification,
  updateDataAlertStatus,
  fetchRule,
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
      ruleStatus: undefined,
      ruleDetails: undefined,
      queryResponse: undefined,
      isMoreOptionsMenuOpen: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
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
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    activeNotificationData: undefined,
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

  changeRuleStatus = (status) => {
    updateDataAlertStatus({
      dataAlertId: this.props.notification.data_alert_id,
      type: this.props.notification.data_alert_type,
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
      </div>
    )
  }

  dataAlertToggleListItem = () => {
    const status = this.state.ruleStatus

    if (!status) {
      return null
    }

    const isActive = status === 'ACTIVE' || status === 'WAITING'

    return (
      <li
        onClick={(e) =>
          this.onOptionClick(e, () => {
            const newStatus = isActive ? 'INACTIVE' : 'ACTIVE'
            this.changeRuleStatus(newStatus)
          })
        }
      >
        <Icon type={isActive ? 'notification-off' : 'notification'} /> <span>Turn {isActive ? 'off' : 'on'}</span>
      </li>
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

  onOptionClick = (e, callback = () => {}) => {
    e.stopPropagation()
    hideTooltips()
    this.setState({ isMoreOptionsMenuOpen: false })
    callback()
  }

  moreOptionsMenu = () => {
    const isUnread = this.getIsUnread()
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className='more-options-menu'
        data-test='react-autoql-toolbar-more-options-notification'
      >
        <ul className='context-menu-list'>
          <li
            onClick={(e) =>
              this.onOptionClick(e, () => {
                this.props.onEditClick(this.state.ruleDetails)
              })
            }
          >
            <Icon type='settings' />
            <span>Data Alert settings</span>
          </li>
          {this.dataAlertToggleListItem()}
          <li onClick={(e) => this.onOptionClick(e, isUnread ? this.markAsRead : this.markAsUnread)}>
            <Icon type={isUnread ? 'mark-read' : 'mark-unread'} />
            <span>Mark as {isUnread ? 'read' : 'unread'}</span>
          </li>
          <li onClick={(e) => this.onOptionClick(e, this.delete)}>
            <Icon type='trash' />
            <span>Delete</span>
          </li>
        </ul>
      </div>
    )
  }

  renderToolbar = () => {
    if (!this.state.expanded) {
      return null
    }

    return (
      <div className='react-autoql-notification-toolbar-container'>
        <div>
          <VizToolbar
            autoQLConfig={this.props.autoQLConfig}
            ref={(r) => (this.vizToolbarRef = r)}
            responseRef={this.OUTPUT_REF}
          />
        </div>
        <div>
          <OptionsToolbar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            ref={(r) => (this.optionsToolbarRef = r)}
            responseRef={this.OUTPUT_REF}
            popoverPositions={['top', 'left', 'bottom', 'right']}
            popoverAlign='end'
          />
        </div>
      </div>
    )
  }

  renderVisualization = () => {
    const { queryResponse } = this.state

    return (
      <div className='react-autoql-notification-chart-container'>
        <div ref={(r) => (this.dataContainer = r)} className='react-autoql-notification-query-data-container'>
          {queryResponse ? (
            <QueryOutput
              // key={queryResponse?.data?.data?.query_id}
              ref={(r) => (this.OUTPUT_REF = r)}
              vizToolbarRef={this.vizToolbarRef}
              optionsToolbarRef={this.optionsToolbarRef}
              authentication={this.props.authentication}
              autoQLConfig={this.props.autoQLConfig}
              dataFormatting={this.props.dataFormatting}
              queryResponse={queryResponse}
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

  renderQueryResponse = () => {
    return (
      <div className='react-autoql-notification-data-container' onClick={(e) => e.stopPropagation()}>
        {this.renderVisualization()}
        {this.renderToolbar()}
      </div>
    )
  }

  renderSummarySection = () => {
    const { notification } = this.props

    return (
      <div className='react-autoql-notification-condition-statement'>
        <ConditionBuilder
          key={`expression-builder-${this.COMPONENT_KEY}`}
          expression={notification?.expression}
          conditionStatementOnly
          conditionTense='past'
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
            {this.renderQueryResponse()}
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
          <div className='react-autoql-notification-item-expand-arrow'>
            <Icon type='caret-down' />
          </div>
          <div className='react-autoql-notification-item-hover-overlay' />
        </div>
      </ErrorBoundary>
    )
  }
}
