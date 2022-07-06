import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import { Icon } from '../../Icon'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import {
  fetchNotificationCount,
  resetNotificationCount,
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import {
  authenticationDefault,
  getAuthentication,
} from '../../../props/defaults'

import './NotificationIcon.scss'

export default class NotificationIcon extends React.Component {
  NUMBER_OF_NOTIFICATIONS_TO_FETCH = 10
  FAILED_POLL_ATTEMPTS = 0

  static propTypes = {
    authentication: authenticationType,
    overflowCount: PropTypes.number,
    style: PropTypes.shape({}),
    size: PropTypes.number,
    useDot: PropTypes.bool,
    clearCountOnClick: PropTypes.bool,
    onNewNotification: PropTypes.func,
    onErrorCallback: PropTypes.func,
    isAlreadyMountedInDOM: PropTypes.bool,
    pausePolling: PropTypes.bool,
    count: PropTypes.number,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    overflowCount: 99,
    useDot: false,
    style: {},
    clearCountOnClick: true,
    onNewNotification: () => {},
    onErrorCallback: () => {},
    isAlreadyMountedInDOM: false,
    pausePolling: false,
    count: undefined,
  }

  state = {
    count: 0,
  }

  timerID
  componentDidMount = async () => {
    this._isMounted = true

    /**
     * If Data Messenger has enableNotificationsTab = true and
     * the NotificationIcon is also present, subscribeToNotificationCount()
     * will occasionally trigger an infinite loop.
     *
     * Data Messenger will first check to see that the NotificationIcon
     * isn't already present before triggering this function inside.
     */

    if (!this.props.isAlreadyMountedInDOM) {
      this.subscribeToNotificationCount()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearInterval(this.timerID)
  }

  getNotificationCount = (currentCount) => {
    const count = currentCount || this.state.count

    if (this.props.pausePolling) {
      return Promise.resolve(count)
    } else if (!Number.isNaN(this.props.count)) {
      return Promise.resolve(count)
    }

    return fetchNotificationCount({
      ...getAuthentication(this.props.authentication),
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
      /**
       * For short polling notifications, we needed to set the interval on FE side.
       * Interval set to trigger every 90 seconds.
       */
      if (this.timerID) {
        clearInterval(this.timerID)
      }

      this.timerID = setInterval(() => {
        this.getNotificationCount(count)
          .then((newCount) => {
            // Got a new count, now we want to reconnect
            this.subscribeToNotificationCount(newCount)
            this.FAILED_POLL_ATTEMPTS = 0
          })
          .catch((error) => {
            if (this.FAILED_POLL_ATTEMPTS === 5) {
              const error = new Error(
                'There were 5 failed attempts to poll for notifications. Unsubscribing from notification count.'
              )
              console.error(error)
              this.props.onErrorCallback(error)

              clearInterval(this.timerID)

              throw new Error(error)
            } else if (_get(error, 'response.status') == 504) {
              // Timed out because there were no changes
              // Let's connect again
              this.subscribeToNotificationCount()
            } else {
              // Something else went wrong, wait one second and reconnect
              new Promise((resolve) => setTimeout(resolve, 1000)).then(() => {
                this.subscribeToNotificationCount()
              })
            }
            this.FAILED_POLL_ATTEMPTS += 1
          })
      }, 3000)
    }
  }

  resetCount = () => {
    resetNotificationCount({ ...getAuthentication(this.props.authentication) })
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
      return <div className="react-autoql-notifications-badge-dot" />
    }

    let finalCount = count
    if (count > overflowCount) {
      finalCount = `${overflowCount}+`
    }

    return <div className="react-autoql-notifications-badge">{finalCount}</div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-notifications-button-container ${
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
            className="react-autoql-notifications-button"
          />
          {this.renderBadge()}
        </div>
      </ErrorBoundary>
    )
  }
}
