import React, { Fragment } from 'react'
import ReactTooltip from 'react-tooltip'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import InfiniteScroll from 'react-infinite-scroller'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import { DataAlertModal } from '../DataAlertModal'
import { Button } from '../../Button'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import emptyStateImg from '../../../images/notifications_empty_state_blue.png'

import {
  fetchNotificationFeed,
  dismissAllNotifications,
} from '../../../js/notificationService'

import { authenticationType, themeConfigType } from '../../../props/types'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../../props/defaults'
import { setCSSVars } from '../../../js/Util'

import './NotificationFeed.scss'

export default class NotificationFeed extends React.Component {
  MODAL_COMPONENT_KEY = uuid()
  NOTIFICATION_LIST_KEY = uuid()
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
    autoChartAggregations: PropTypes.bool,
    showCreateAlertBtn: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    autoChartAggregations: false,
    showCreateAlertBtn: false,
    onCollapseCallback: () => {},
    onExpandCallback: () => {},
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
  }

  state = {
    isFetchingFirstNotifications: true,
    notificationList: [],
    pagination: {},
    nextOffset: 0,
  }

  componentDidMount = () => {
    this.getNotifications()
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  componentDidUpdate = (prevProps) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  getNotifications = (limit) => {
    fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: this.state.nextOffset,
      limit: limit || this.NOTIFICATION_FETCH_LIMIT,
    })
      .then((data) => {
        let notificationList = _cloneDeep(this.state.notificationList)
        let nextOffset = this.state.nextOffset
        let pagination = this.state.pagination

        if (_get(data, 'items.length')) {
          notificationList = [...notificationList, ...data.items]
          nextOffset = this.state.nextOffset + this.NOTIFICATION_FETCH_LIMIT
          pagination = data.pagination
        }

        this.setState({
          notificationList,
          pagination,
          nextOffset,
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
    fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: 0,
      limit: 10, // Likely wont have more than 10 notifications. If so, we will just reset the whole list
    }).then((response) => {
      const newNotifications = this.detectNewNotifications(response.items)

      if (!newNotifications.length) {
        return
      }

      if (newNotifications.length === 10) {
        // Reset list and pagination to new list
        // This will probably never happen
        this.setState({
          notificationList: response.items,
          pagination: response.pagination,
        })
      } else {
        const newList = [...newNotifications, ...this.state.notificationList]

        this.setState({
          notificationList: newList,
          pagination: {
            ...response.pagination,
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

    dismissAllNotifications({
      ...getAuthentication(this.props.authentication),
    }).catch((error) => {
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

  onDataAlertSave = () => {
    // todo: show success alert
    this.setState({ isEditModalVisible: false })
    this.props.onSuccessCallback('Notification successfully updated.')
  }

  renderDismissAllButton = () => (
    <div
      key="dismiss-all-btn"
      className="react-autoql-notification-dismiss-all"
    >
      <span onClick={this.onDismissAllClick}>
        <Icon type="notification-off" style={{ verticalAlign: 'middle' }} />{' '}
        Dismiss All
      </span>
    </div>
  )

  showEditDataAlertModal = (id) => {
    this.setState({ isEditModalVisible: true, activeNotificationId: id })
  }

  renderEditDataAlertModal = () => {
    return (
      <DataAlertModal
        key={this.MODAL_COMPONENT_KEY}
        authentication={getAuthentication(this.props.authentication)}
        themeConfig={getThemeConfig(this.props.themeConfig)}
        isVisible={this.state.isEditModalVisible}
        onClose={() => this.setState({ isEditModalVisible: false })}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        allowDelete={false}
        themeConfig={getThemeConfig(this.props.themeConfig)}
        title={
          this.state.activeDataAlert ? 'Edit Data Alert' : 'Create Data Alert'
        }
        titleIcon={this.state.activeDataAlert ? <Icon type="edit" /> : <span />}
      />
    )
  }

  render = () => {
    if (this.state.isFetchingFirstNotifications) {
      return (
        <div
          className="notification-list-loading-container"
          data-test="notification-list"
        >
          Loading...
        </div>
      )
    } else if (this.state.fetchNotificationsError) {
      return (
        <div
          className="notification-list-loading-container"
          data-test="notification-list"
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
          className="react-autoql-notification-list-container"
          data-test="notification-list"
        >
          <ReactTooltip
            className="react-autoql-drawer-tooltip"
            id="react-autoql-notification-tooltip"
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
                loadMore={this.getNotifications}
                hasMore={
                  this.state.pagination.total_items >
                  this.state.notificationList.length
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
                      key={`notification-item-${i}`}
                      authentication={getAuthentication(
                        this.props.authentication
                      )}
                      themeConfig={getThemeConfig(this.props.themeConfig)}
                      notification={notification}
                      onClick={this.onItemClick}
                      onDismissCallback={this.onDismissClick}
                      onDeleteCallback={this.onDeleteClick}
                      onDeleteSuccessCallback={() => {
                        this.getNotifications(1)
                      }}
                      onExpandCallback={(notification) => {
                        this.props.onExpandCallback(notification)
                        this.setState({
                          activeNotificationId: notification.id,
                        })
                      }}
                      onCollapseCallback={this.props.onCollapseCallback}
                      activeNotificationData={this.props.activeNotificationData}
                      autoChartAggregations={this.props.autoChartAggregations}
                      showNotificationDetails={
                        this.props.showNotificationDetails
                      }
                      onErrorCallback={this.props.onErrorCallback}
                      onEditClick={(dataAlert) => {
                        this.setState({ activeDataAlert: dataAlert })
                        this.showEditDataAlertModal()
                      }}
                    />
                  )
                })}
              </InfiniteScroll>
            </Fragment>
          ) : (
            <div className="empty-notifications-message">
              <img className="empty-notifications-img" src={emptyStateImg} />
              <div className="empty-notifications-title">
                No notifications yet.
              </div>
              <div>Stay tuned!</div>
              <br />
              {this.props.showCreateAlertBtn && (
                <Button
                  style={{ marginTop: '10px' }}
                  type="primary"
                  onClick={this.showEditDataAlertModal}
                >
                  Create Data Alert
                </Button>
              )}
            </div>
          )}
          {this.renderEditDataAlertModal()}
        </div>
      </ErrorBoundary>
    )
  }
}
