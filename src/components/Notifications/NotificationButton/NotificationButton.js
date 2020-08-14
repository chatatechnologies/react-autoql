import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import { Icon } from '../../Icon'

import {
  fetchNotificationCount,
  resetNotificationCount,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationButton.scss'

export default class NotificationButton extends React.Component {
  NUMBER_OF_NOTIFICATIONS_TO_FETCH = 10

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
    clearCountOnClick: true,
    onNewNotification: () => {},
    onErrorCallback: () => {},
  }

  state = {
    count: 0,
  }

  componentDidMount = async () => {
    this._isMounted = true
    this.subscribeToNotificationCount()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    this.unsubscribeFromNotificationCount()
  }

  getNotificationCount = (currentCount) => {
    const count = currentCount || this.state.count
    return fetchNotificationCount({
      ...this.props.authentication,
      unacknowledged: count,
    })
      .then((response) => {
        const newCount = _get(response, 'data.data.unacknowledged')
        if (newCount && newCount !== this.state.count) {
          this.setState({ count: newCount })
          this.props.onNewNotification()
        }
        return Promise.resolve(newCount)
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  }

  subscribeToNotificationCount = (count) => {
    if (this._isMounted) {
      this.getNotificationCount(count)
        .then((newCount) => {
          // Got a new count, now we want to reconnect
          this.subscribeToNotificationCount(newCount)
        })
        .catch((error) => {
          if (error.response.status == 504) {
            // Timed out because there were no changes
            // Let's connect again
            this.subscribeToNotificationCount()
          } else {
            // Something else went wrong, wait one second and reconnect
            new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
              this.subscribeToNotificationCount()
            })
          }
        })
    }
  }

  unsubscribeFromNotificationCount = () => {}

  resetCount = () => {
    resetNotificationCount({ ...this.props.authentication })
      .catch((error) => {
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
        <Icon type="notification" className="chata-notifications-button" />
        {this.renderBadge()}
      </div>
    )
  }
}
