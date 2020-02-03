import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'
import _get from 'lodash.get'

import { ResponseRenderer } from '../../ResponseRenderer'
import { Icon } from '../../Icon'

import './NotificationItem.scss'

dayjs.extend(advancedFormat)

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    notification: PropTypes.shape({
      triggered: PropTypes.bool
    }).isRequired,
    onExpandCallback: PropTypes.func,
    onDismissCallback: PropTypes.func
  }

  static defaultProps = {
    onExpandCallback: () => {},
    onDismissCallback: () => {}
  }

  state = {
    notification: this.props.notification,
    triggered: _get(this.props.notification, 'triggered')
    // expanded: false
  }

  onClick = notification => {
    if (notification.expanded) {
      this.props.onCollapseCallback(notification)
    } else {
      this.props.onExpandCallback(notification)
    }

    this.props.onClick(notification)
    // this.setState({ expanded: !this.state.expanded })
  }

  onDismissClick = (e, notification) => {
    e.stopPropagation()
    // Make backend call to acknowledge notification
    // this.props.onDismissClick(e, notification)
    this.props.onDismissCallback()
    this.setState({ triggered: false })
  }

  formatTimestamp = timestamp => {
    const time = dayjs(timestamp).format('h:mma')
    const day = dayjs(timestamp).format('MM-DD-YY')
    const today = dayjs().format('MM-DD-YY')
    const yesterday = dayjs()
      .subtract(1, 'd')
      .format('MM-DD-YY')

    if (day === today) {
      return `Today at ${time}`
    } else if (day === yesterday) {
      return `Yesterday at ${time}`
    } else if (dayjs().isSame(timestamp, 'year')) {
      return `${dayjs(timestamp).format('MMMM Do')} at ${time}`
    }
    return `${dayjs(timestamp).format('MMMM Do, YYYY')} at ${time}`
  }

  renderAlertColorStrip = () => (
    <div className="chata-notification-alert-strip" />
  )

  render = () => {
    const { notification } = this.props

    return (
      <div
        key={`chata-notification-item-${this.COMPONENT_KEY}`}
        className={`chata-notification-list-item
          ${this.state.triggered ? ' triggered' : ''}
          ${notification.expanded ? ' expanded' : ''}`}
        onClick={() => this.onClick(notification)}
      >
        <div className="chata-notification-list-item-header">
          {
            //   <div className="chata-notification-img-container">
            //   <div className="chata-notification-img">A</div>
            // </div>
          }
          <div className="chata-notification-display-name-container">
            <div className="chata-notification-display-name">
              {notification.title}
            </div>
            <div className="chata-notification-description">
              {notification.message}
            </div>
            <div className="chata-notification-timestamp">
              <Icon type="calendar" />{' '}
              {this.formatTimestamp(notification.timestamp)}
            </div>
          </div>
          {this.state.triggered && (
            <div className="chata-notification-dismiss-btn">
              <Icon
                type="notification-off"
                className="chata-notification-dismiss-icon"
                data-tip="Dismiss"
                data-for="chata-notification-tooltip"
                onClick={e => {
                  this.onDismissClick(e, notification)
                  ReactTooltip.hide()
                }}
              />
            </div>
          )}
        </div>
        {notification.expanded && (
          <div className="chata-notification-data-container">
            {this.props.expandedContent}
            {
              //   <ResponseRenderer
              //   response={sampleNotificationData}
              //   displayType="column"
              // />
            }
          </div>
        )}
        {this.renderAlertColorStrip()}
      </div>
    )
  }
}
