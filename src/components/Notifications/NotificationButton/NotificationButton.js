import React from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'

import {
  fetchNotificationCount,
  resetNotificationCount,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationButton.scss'

export default class NotificationButton extends React.Component {
  NOTIFICATION_POLLING_INTERVAL = 10000
  NUMBER_OF_NOTIFICATIONS_TO_FETCH = 10

  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    authentication: authenticationType,
    overflowCount: PropTypes.number,
    style: PropTypes.shape({}),
    size: PropTypes.number,
    useDot: PropTypes.bool,
    clearCountOnClick: PropTypes.bool,
    onNewNotification: PropTypes.func,
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    overflowCount: 99,
    useDot: false,
    style: {},
    // size: 17,
    clearCountOnClick: true,
    onNewNotification: () => {},
    onErrorCallback: () => {},
  }

  state = {
    count: 0,
  }

  componentDidMount = async () => {
    this.startPollingForNotifications()

    // Listen for new notification SSE's and update real-time
    // this.notificationEventSource.onmessage = e =>
    //   this.updateNotificationsCountAndList(JSON.parse(e.data))
  }

  componentWillUnmount = () => {
    if (this.pollForNotificationsInterval) {
      clearInterval(this.pollForNotificationsInterval)
    }
  }

  startPollingForNotifications = () => {
    // Fetch initial existing notifications from the BE
    this.getNotificationCount()

    // Continue fetching every minute
    this.pollForNotificationsInterval = setInterval(() => {
      this.getNotificationCount()
    }, this.NOTIFICATION_POLLING_INTERVAL)
  }

  getNotificationCount = () => {
    fetchNotificationCount({ ...this.props.authentication })
      .then(count => {
        this.setState({ count })
        if (count > 0) {
          this.props.onNewNotification()
        }
      })
      .catch(error => {
        console.error(error)
      })
  }

  resetCount = () => {
    resetNotificationCount({ ...this.props.authentication })
      .catch(error => {
        console.error(error)
      })
      .finally(() => {
        this.setState({ count: 0 })
      })
  }

  renderBadge = () => {
    const { overflowCount } = this.props
    const { count } = this.state

    if (!count) {
      return null
    }

    if (this.props.useDot) {
      return <div className="chata-notifications-badge-dot" />
    }

    let finalCount = count
    if (count > overflowCount) {
      finalCount = `${overflowCount}+`
    }

    return <div className="chata-notifications-badge">{finalCount}</div>
  }

  render = () => {
    return (
      <div
        className={`chata-notifications-button-container ${
          this.props.useDot ? 'dot' : ''
        }
        ${!this.state.count ? 'no-badge' : ''}`}
        data-test="notification-button"
        style={{ ...this.props.style }}
        onClick={() => {
          if (this.props.clearCountOnClick) {
            this.resetCount()
          }
        }}
      >
        <Icon
          type="notification"
          className="chata-notifications-button"
          // style={{ fontSize: '1em' }}
        />
        {this.renderBadge()}
      </div>
    )
  }
}
