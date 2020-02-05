import React from 'react'
import ReactTooltip from 'react-tooltip'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import { fetchNotificationList } from '../../../js/notificationService'

import './NotificationList.scss'

export default class NotificationList extends React.Component {
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    apiKey: PropTypes.string,
    userId: PropTypes.string,
    username: PropTypes.string,
    customerId: PropTypes.string,
    token: PropTypes.string,
    domain: PropTypes.string,
    // notifications: PropTypes.arrayOf(PropTypes.shape({})),
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    expandedContent: PropTypes.element
  }

  static defaultProps = {
    apiKey: undefined,
    userId: undefined,
    username: undefined,
    customerId: undefined,
    token: undefined,
    domain: undefined,
    expandedContent: undefined,
    // notifications: [],
    onCollapseCallback: () => {},
    onExpandCallback: () => {}
  }

  state = {
    isFetchingFirstNotifications: true,
    notificationList: []
  }

  componentDidMount = () => {
    this.getNotifications()
  }

  getNotifications = () => {
    const { userId, username, apiKey, customerId, token } = this.props
    fetchNotificationList({ userId, username, apiKey, customerId, token })
      .then(response => {
        this.setState({
          notificationList: response.notifications,
          isFetchingFirstNotifications: false
        })
      })
      .catch(() => {
        this.setState({
          isFetchingFirstNotifications: false
        })
      })
  }

  refreshNotifications = () => {
    this.getNotifications()
  }

  onItemClick = notification => {
    // fetch data stored in integrators DB and display
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          expanded: !n.expanded
        }
      }
      return {
        ...n,
        expanded: false
      }
    })
    this.setState({ notificationList: newList })
  }

  onDismissAllclick = () => {
    const newList = this.state.notificationList.map(n => {
      return {
        ...n,
        triggered: false
      }
    })

    this.setState({ notificationList: newList })
  }

  onDismissClick = (e, notification) => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          triggered: false
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  renderDismissAllButton = () => (
    <div className="chata-notification-dismiss-all">
      <span onClick={this.onDismissAllclick}>
        <Icon type="notification-off" style={{ verticalAlign: 'middle' }} />{' '}
        Dismiss All
      </span>
    </div>
  )

  render = () => {
    if (this.state.isFetchingFirstNotifications) {
      return (
        <div
          data-test="notification-list"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    } else if (!_get(this.state.notificationList, 'length')) {
      return (
        <div
          data-test="notification-list"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          No notifications to display
        </div>
      )
    }

    return (
      <div
        className="chata-notification-list-container"
        data-test="notification-list"
      >
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-notification-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
        {this.renderDismissAllButton()}
        {this.state.notificationList.map((notification, i) => {
          return (
            <NotificationItem
              notification={notification}
              onClick={this.onItemClick}
              onDismissClick={this.onDismissClick}
              onExpandCallback={this.props.onExpandCallback}
              onCollapseCallback={this.props.onCollapseCallback}
              expandedContent={this.props.expandedContent}
            />
          )
        })}
      </div>
    )
  }
}
