import React from 'react'
import ReactTooltip from 'react-tooltip'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import InfiniteScroll from 'react-infinite-scroller'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import {
  fetchNotificationList,
  dismissAllNotifications
} from '../../../js/notificationService'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationList.scss'

export default class NotificationList extends React.Component {
  NOTIFICATION_FETCH_LIMIT = 10
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    authentication: authenticationType,
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    expandedContent: PropTypes.element,
    onErrorCallback: PropTypes.func
  }

  static defaultProps = {
    authentication: authenticationDefault,
    expandedContent: undefined,
    onCollapseCallback: () => {},
    onExpandCallback: () => {},
    onErrorCallback: () => {}
  }

  state = {
    isFetchingFirstNotifications: true,
    notificationList: [],
    pagination: {},
    nextOffset: this.NOTIFICATION_FETCH_LIMIT
  }

  componentDidMount = () => {
    this.getInitialNotifications()
  }

  getInitialNotifications = () => {
    fetchNotificationList({
      ...this.props.authentication,
      offset: 0,
      limit: this.NOTIFICATION_FETCH_LIMIT
    })
      .then(response => {
        this.setState({
          notificationList: response.notifications,
          pagination: response.pagination,
          isFetchingFirstNotifications: false,
          fetchNotificationsError: null
        })
      })
      .catch(error => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({
          isFetchingFirstNotifications: false,
          fetchNotificationsError: error
        })
      })
  }

  refreshNotifications = () => {
    // Regardless of how many notifications are loaded, we only want to add the new ones to the top
    fetchNotificationList({
      ...this.props.authentication,
      offset: 0,
      limit: 10 // Likely wont have more than 10 notifications. If so, we will just reset the whole list
    }).then(response => {
      const newNotifications = this.detectNewNotifications(
        response.notifications
      )

      if (!newNotifications.length) {
        return
      }

      if (newNotifications.length === 10) {
        // Reset list and pagination to new list
        // This will probably never happen
        this.setState({
          notificationList: response.notifications,
          pagination: response.pagination
        })
      } else {
        const newList = [...newNotifications, ...this.state.notificationList]
        const newPageNumber =
          Math.ceil(newList.length / this.NOTIFICATION_FETCH_LIMIT) - 1

        this.setState({
          notificationList: newList,
          pagination: {
            ...response.pagination,
            page_number: newPageNumber
          },
          nextOffset: newList.length - 1
        })
      }
    })
  }

  detectNewNotifications = notificationList => {
    const newNotifications = []
    notificationList.every(notification => {
      // If we have reached a notification that is already loaded, stop looping
      if (this.state.notificationList.find(n => n.id === notification.id)) {
        return false
      }

      newNotifications.push(notification)
      return true
    })
    return newNotifications
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

  onDismissAllClick = () => {
    const newList = this.state.notificationList.map(n => {
      return {
        ...n,
        state: 'DISMISSED'
      }
    })

    this.setState({ notificationList: newList })

    dismissAllNotifications({ ...this.props.authentication }).catch(error => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  onDismissClick = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          state: 'DISMISSED'
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  onDeleteClick = notification => {
    const newList = this.state.notificationList.filter(
      n => n.id !== notification.id
    )
    this.setState({
      notificationList: newList,
      nextOffset: this.state.nextOffset > 0 ? this.state.nextOffset - 1 : 0
    })
  }

  renderDismissAllButton = () => (
    <div className="chata-notification-dismiss-all">
      <span onClick={this.onDismissAllClick}>
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
    } else if (this.state.fetchNotificationsError) {
      return (
        <div
          data-test="notification-list"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Something went wrong
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
        {
          // <ReactTooltip
          //   className="chata-drawer-tooltip"
          //   id="chata-notification-tooltip"
          //   effect="solid"
          //   delayShow={500}
          //   html
          // />
        }

        {this.renderDismissAllButton()}
        <InfiniteScroll
          initialLoad={false}
          pageStart={0}
          loadMore={() => {
            fetchNotificationList({
              ...this.props.authentication,
              offset: this.state.nextOffset,
              limit: this.NOTIFICATION_FETCH_LIMIT
            }).then(response => {
              if (response.notifications.length) {
                this.setState({
                  fetchNotificationsError: null,
                  notificationList: [
                    ...this.state.notificationList,
                    ...response.notifications
                  ],
                  pagination: response.pagination,
                  nextOffset:
                    this.state.nextOffset + this.NOTIFICATION_FETCH_LIMIT
                })
              }
            })
          }}
          hasMore={
            this.state.pagination.page_number !==
            this.state.pagination.total_pages - 1
          }
          // loader={
          //   <div className="loader" key={0}>
          //     Loading ...
          //   </div>
          // }
          useWindow={false}
        >
          {this.state.notificationList.map((notification, i) => {
            return (
              <NotificationItem
                authentication={this.props.authentication}
                notification={notification}
                onClick={this.onItemClick}
                onDismissCallback={this.onDismissClick}
                onDeleteCallback={this.onDeleteClick}
                onExpandCallback={this.props.onExpandCallback}
                onCollapseCallback={this.props.onCollapseCallback}
                expandedContent={this.props.expandedContent}
                onErrorCallback={this.props.onErrorCallback}
              />
            )
          })}
        </InfiniteScroll>
      </div>
    )
  }
}
