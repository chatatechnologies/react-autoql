import React, { Fragment } from 'react'
import ReactTooltip from 'react-tooltip'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import InfiniteScroll from 'react-infinite-scroller'
import uuid from 'uuid'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import { NotificationModal } from '../NotificationModal'
import {
  fetchNotificationList,
  dismissAllNotifications,
} from '../../../js/notificationService'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
} from '../../../props/defaults'

import './NotificationList.scss'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { Button } from '../../Button'

export default class NotificationList extends React.Component {
  MODAL_COMPONENT_KEY = uuid.v4()
  NOTIFICATION_FETCH_LIMIT = 10
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    activeNotificationData: PropTypes.shape({}),
    showNotificationDetails: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    onCollapseCallback: () => {},
    onExpandCallback: () => {},
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
  }

  state = {
    isFetchingFirstNotifications: true,
    notificationList: [],
    pagination: {},
    nextOffset: this.NOTIFICATION_FETCH_LIMIT,
  }

  componentDidMount = () => {
    this.getInitialNotifications()
  }

  getInitialNotifications = () => {
    fetchNotificationList({
      ...this.props.authentication,
      offset: 0,
      limit: this.NOTIFICATION_FETCH_LIMIT,
    })
      .then((response) => {
        this.setState({
          notificationList: response.notifications,
          pagination: response.pagination,
          isFetchingFirstNotifications: false,
          fetchNotificationsError: null,
        })
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({
          isFetchingFirstNotifications: false,
          fetchNotificationsError: error,
        })
      })
  }

  refreshNotifications = () => {
    // Regardless of how many notifications are loaded, we only want to add the new ones to the top
    fetchNotificationList({
      ...this.props.authentication,
      offset: 0,
      limit: 10, // Likely wont have more than 10 notifications. If so, we will just reset the whole list
    }).then((response) => {
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
          pagination: response.pagination,
        })
      } else {
        const newList = [...newNotifications, ...this.state.notificationList]
        const newPageNumber =
          Math.ceil(newList.length / this.NOTIFICATION_FETCH_LIMIT) - 1

        this.setState({
          notificationList: newList,
          pagination: {
            ...response.pagination,
            page_number: newPageNumber,
          },
          nextOffset: newList.length - 1,
        })
      }
    })
  }

  detectNewNotifications = (notificationList) => {
    const newNotifications = []
    notificationList.every((notification) => {
      // If we have reached a notification that is already loaded, stop looping
      if (this.state.notificationList.find((n) => n.id === notification.id)) {
        return false
      }

      newNotifications.push(notification)
      return true
    })
    return newNotifications
  }

  onItemClick = (notification) => {
    // fetch data stored in integrators DB and display
    let activeNotificationId = undefined
    const newList = this.state.notificationList.map((n) => {
      if (notification.id === n.id) {
        if (!n.expanded) {
          activeNotificationId = notification.id
        }
        return {
          ...n,
          expanded: !n.expanded,
        }
      }
      return {
        ...n,
        expanded: false,
      }
    })
    this.setState({ notificationList: newList, activeNotificationId })
  }

  onDismissAllClick = () => {
    const newList = this.state.notificationList.map((n) => {
      return {
        ...n,
        state: 'DISMISSED',
      }
    })

    this.setState({ notificationList: newList })

    dismissAllNotifications({ ...this.props.authentication }).catch((error) => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  onDismissClick = (notification) => {
    const newList = this.state.notificationList.map((n) => {
      if (notification.id === n.id) {
        return {
          ...n,
          state: 'DISMISSED',
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  onDeleteClick = (notification) => {
    const newList = this.state.notificationList.filter(
      (n) => n.id !== notification.id
    )
    this.setState({
      notificationList: newList,
      nextOffset: this.state.nextOffset > 0 ? this.state.nextOffset - 1 : 0,
    })
  }

  getActiveRuleData = () => {
    if (!this.state.activeNotificationId) {
      return undefined
    }

    const activeNotification = this.state.notificationList.find(
      (n) => n.expanded
    )
    if (activeNotification) {
      const ruleData = {
        expression: activeNotification.rule_expression,
        id: activeNotification.rule_id,
        message: activeNotification.rule_message,
        notification_type: activeNotification.notification_type,
        query: activeNotification.rule_query,
        status: activeNotification.rule_status,
        title: activeNotification.rule_title,
      }
      return ruleData
    }
    return undefined
  }

  onRuleSave = () => {
    // todo: show success alert
    this.setState({ isEditModalVisible: false })
    this.props.onSuccessCallback('Notification successfully updated.')
  }

  onRuleError = () => {
    this.props.onErrorCallback()
  }

  renderDismissAllButton = () => (
    <div className="chata-notification-dismiss-all">
      <span onClick={this.onDismissAllClick}>
        <Icon type="notification-off" style={{ verticalAlign: 'middle' }} />{' '}
        Dismiss All
      </span>
    </div>
  )

  showEditRuleModal = (id) => {
    this.setState({ isEditModalVisible: true, activeNotificationId: id })
  }

  renderEditRuleModal = () => {
    return (
      <NotificationModal
        key={this.MODAL_COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentNotification={this.getActiveRuleData()}
        onSave={this.onRuleSave}
        onErrorCallback={this.onRuleError}
        hideDeleteBtn
        themeConfig={this.props.themeConfig}
      />
    )
  }

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
          Oh no! Something went wrong while accessing your notifications.
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <Button onClick={this.getInitialNotifications}>Try Again</Button>
          </div>
        </div>
      )
    }

    return (
      <ErrorBoundary>
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

          {_get(this.state.notificationList, 'length') ? (
            <Fragment>
              {this.renderDismissAllButton()}
              <InfiniteScroll
                initialLoad={false}
                pageStart={0}
                loadMore={() => {
                  fetchNotificationList({
                    ...this.props.authentication,
                    offset: this.state.nextOffset,
                    limit: this.NOTIFICATION_FETCH_LIMIT,
                  }).then((response) => {
                    if (response.notifications.length) {
                      this.setState({
                        fetchNotificationsError: null,
                        notificationList: [
                          ...this.state.notificationList,
                          ...response.notifications,
                        ],
                        pagination: response.pagination,
                        nextOffset:
                          this.state.nextOffset + this.NOTIFICATION_FETCH_LIMIT,
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
                      themeConfig={this.props.themeConfig}
                      notification={notification}
                      onClick={this.onItemClick}
                      onDismissCallback={this.onDismissClick}
                      onDeleteCallback={this.onDeleteClick}
                      onExpandCallback={(notification) => {
                        this.props.onExpandCallback(notification)
                        this.setState({ activeNotificationId: notification.id })
                      }}
                      onCollapseCallback={this.props.onCollapseCallback}
                      activeNotificationData={this.props.activeNotificationData}
                      showNotificationDetails={
                        this.props.showNotificationDetails
                      }
                      onErrorCallback={this.props.onErrorCallback}
                      onEditClick={(id) => this.showEditRuleModal(id)}
                    />
                  )
                })}
              </InfiniteScroll>
            </Fragment>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '100px' }}>
              <span style={{ opacity: 0.6 }}>
                You don't have any notifications yet.
              </span>
              <br />
              <Button
                style={{ marginTop: '10px' }}
                type="primary"
                onClick={this.showEditRuleModal}
              >
                Create a New Notification
              </Button>
            </div>
          )}
          {this.renderEditRuleModal()}
        </div>
      </ErrorBoundary>
    )
  }
}
