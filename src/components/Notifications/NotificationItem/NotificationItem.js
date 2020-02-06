import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'
import _get from 'lodash.get'

import { ResponseRenderer } from '../../ResponseRenderer'
import { Icon } from '../../Icon'
import { dismissNotification } from '../../../js/notificationService'

import './NotificationItem.scss'

dayjs.extend(advancedFormat)

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    domain: PropTypes.string,
    apiKey: PropTypes.string,
    token: PropTypes.string,
    notification: PropTypes.shape({}).isRequired,
    onExpandCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    expandedContent: PropTypes.element
  }

  static defaultProps = {
    domain: undefined,
    apiKey: undefined,
    token: undefined,
    expandedContent: undefined,
    onExpandCallback: () => {},
    onDismissCallback: () => {}
  }

  state = {
    notification: this.props.notification
    // expanded: false
  }

  getIsTriggered = state => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(state)
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
    this.props.onDismissCallback(notification)

    const { domain, apiKey, token } = this.props
    dismissNotification({
      notificationId: notification.id,
      domain,
      apiKey,
      token
    }).catch(error => console.error(error))
  }

  formatTimestamp = timestamp => {
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
    <div className="chata-notification-alert-strip" />
  )

  render = () => {
    const { notification } = this.props

    return (
      <div
        key={`chata-notification-item-${this.COMPONENT_KEY}`}
        className={`chata-notification-list-item
          ${this.getIsTriggered(notification.state) ? ' triggered' : ''}
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
              {this.formatTimestamp(notification.created_at)}
            </div>
          </div>
          {this.getIsTriggered(notification.state) && (
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
            {this.props.expandedContent || (
              <div style={{ textAlign: 'center', marginTop: '50px' }}>
                No data available
              </div>
            )}
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
