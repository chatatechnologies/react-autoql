import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import {
  fetchNotificationCount,
  resetNotificationCount,
  authenticationDefault,
  getAuthentication,
} from 'autoql-fe-utils'

import { Icon } from '../../Icon'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { withTheme } from '../../../theme'
import { authenticationType } from '../../../props/types'

import './NotificationIcon.scss'

class NotificationIcon extends React.Component {
  constructor(props) {
    super(props)

    this.NUMBER_OF_NOTIFICATIONS_TO_FETCH = 10
    this.INTERVAL_LENGTH = 90 * 1000
    this.FAILED_POLL_ATTEMPTS = 0
    this.COMPONENT_KEY = uuid()
    this.HAS_FETCHED_COUNT = false
    this.pollInterval = undefined

    this.state = {
      count: 0,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    overflowCount: PropTypes.number,
    style: PropTypes.shape({}),
    size: PropTypes.number,
    useDot: PropTypes.bool,
    clearCountOnClick: PropTypes.bool,
    onNewNotification: PropTypes.func,
    onErrorCallback: PropTypes.func,
    pausePolling: PropTypes.bool,
    count: PropTypes.number,
    onCount: PropTypes.func,
    enableFetchNotificationCountAcrossProjects: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    overflowCount: 99,
    useDot: false,
    style: {},
    clearCountOnClick: true,
    onNewNotification: () => {},
    onErrorCallback: () => {},
    pausePolling: false,
    count: undefined,
    onCount: () => {},
    enableFetchNotificationCountAcrossProjects: false,
  }

  componentDidMount = async () => {
    this._isMounted = true
    this.getNotificationCount()
    this.clearPollingComponent()
    this.subscribeToNotificationCount()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.count !== prevState.count) {
      this.props.onCount(this.state.count)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    this.clearPollingComponent()
    clearInterval(this.pollInterval)
  }

  getNotificationCount = (currentCount) => {
    const count = currentCount || this.state.count

    if (this.props.pausePolling) {
      return Promise.resolve(count)
    }

    return fetchNotificationCount({
      ...getAuthentication(this.props.authentication),
      unacknowledged: count,
      enableFetchNotificationCountAcrossProjects: this.props.enableFetchNotificationCountAcrossProjects,
    })
      .then((response) => {
        const newCount = response?.data?.data?.unacknowledged
        if (newCount && newCount !== this.state.count) {
          this.setState({ count: newCount })
          if (this.HAS_FETCHED_COUNT) {
            this.props.onNewNotification(newCount)
          }
        }
        this.HAS_FETCHED_COUNT = true
        return Promise.resolve(newCount)
      })
      .catch((error) => {
        console.error(error)
        return this.props.onErrorCallback(error)
      })
  }

  clearPollingComponent = () => {
    sessionStorage.setItem('pollingComponent', '')
  }

  setPollingComponent = () => {
    sessionStorage.setItem('pollingComponent', this.COMPONENT_KEY)
  }

  getPollingComponent = () => {
    return sessionStorage.getItem('pollingComponent')
  }

  subscribeToNotificationCount = (count) => {
    const pollingComponent = this.getPollingComponent()
    const shouldPoll = !pollingComponent || pollingComponent === this.COMPONENT_KEY

    if (this._isMounted && shouldPoll) {
      /**
       * For short polling notifications, we needed to set the interval on FE side.
       * Interval set to trigger every 90 seconds.
       */
      clearInterval(this.pollInterval)
      this.setPollingComponent()
      this.pollInterval = setInterval(() => {
        this.getNotificationCount(count)
          .then((newCount) => {
            // Got a new count, now we want to reconnect
            this.subscribeToNotificationCount(newCount)
            this.FAILED_POLL_ATTEMPTS = 0
          })
          .catch((error) => {
            if (this.FAILED_POLL_ATTEMPTS === 5) {
              const error = new Error(
                'There were 5 failed attempts to poll for notifications. Unsubscribing from notification count.',
              )
              console.error(error)
              this.props.onErrorCallback(error)

              clearInterval(this.pollInterval)
              return
            } else if (error?.response?.status == 504) {
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
      }, this.INTERVAL_LENGTH)
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

  getCurrentCount = () => {
    if (typeof this.props.count === 'number') {
      return this.props.count
    }

    return this.state.count
  }

  renderBadge = () => {
    const { overflowCount } = this.props
    const count = this.getCurrentCount()

    if (!count) {
      return null
    }

    if (this.props.useDot) {
      return <div className='react-autoql-notifications-badge-dot' />
    }

    let finalCount = count
    if (count > overflowCount) {
      finalCount = `${overflowCount}+`
    }

    return <div className='react-autoql-notifications-badge'>{finalCount}</div>
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-notifications-button-container ${this.props.useDot ? 'dot' : ''}
          ${this.props.className || ''}
        ${!this.state.count && !this.props.count ? 'no-badge' : ''}`}
          data-test='notification-button'
          style={{ ...this.props.style }}
          onClick={() => {
            if (this.props.clearCountOnClick) {
              this.resetCount()
            }
          }}
        >
          <Icon type='notification' className='react-autoql-notifications-button' />
          {this.renderBadge()}
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(NotificationIcon)
