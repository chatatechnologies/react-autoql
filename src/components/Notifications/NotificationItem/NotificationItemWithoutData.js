import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import dayjs from '../../../js/dayjsWithPlugins'
import { isNumber } from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from '../../../props/defaults'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../../props/types'

import './NotificationItem.scss'

export default class NotificationItem extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      expanded: false,
      dataAlertStatus: undefined,
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

  componentWillUnmount = () => {
    clearTimeout(this.initialCollapseTimer)
  }

  isError = () => {
    return this.props.notification?.outcome === 'ERROR'
  }

  isUnread = () => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(this.props.notification?.state)
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
        <div>
          <Icon
            type='more-vertical'
            className='react-autoql-notification-options-btn'
            data-tip='Options'
            data-for={this.props.tooltipID ?? 'react-autoql-notification-tooltip'}
          />
        </div>
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
          {this.renderAlertColorStrip()}
          <div className='react-autoql-notification-item-hover-overlay' />
        </div>
      </ErrorBoundary>
    )
  }
}
