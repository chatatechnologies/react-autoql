import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import InfiniteScroll from 'react-infinite-scroller'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import { DataAlertModalV2 } from '../DataAlertModalV2'
import { Button } from '../../Button'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Spinner } from '../../Spinner'
import { Tooltip } from '../../Tooltip'
import { ErrorBoundary } from '../../../containers/ErrorHOC'

import { fetchNotificationFeed, dismissAllNotifications } from '../../../js/notificationService'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication } from '../../../props/defaults'
import { withTheme } from '../../../theme'

import emptyStateImg from '../../../images/notifications_empty_state_blue.png'

import './NotificationFeed.scss'

class NotificationFeed extends React.Component {
  constructor(props) {
    super(props)

    this.MODAL_COMPONENT_KEY = uuid()
    this.NOTIFICATION_FETCH_LIMIT = 10
    // Open event source http connection here to receive SSE
    // notificationEventSource = new EventSource(
    //   'https://backend.chata.io/notifications'
    // )

    this.notificationRefs = {}

    this.state = {
      isFetchingFirstNotifications: true,
      notificationList: [],
      pagination: {},
      nextOffset: 0,
      hasMore: true,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    activeNotificationData: PropTypes.shape({}),
    showNotificationDetails: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    onChange: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    showCreateAlertBtn: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,
    onDataAlertModalOpen: PropTypes.func,
    shouldRender: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    activeNotificationData: undefined,
    showNotificationDetails: true,
    autoChartAggregations: false,
    showCreateAlertBtn: false,
    enableAjaxTableData: false,
    shouldRender: true,
    onCollapseCallback: () => {},
    onExpandCallback: () => {},
    onErrorCallback: () => {},
    onSuccessCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onDataAlertModalOpen: () => {},
    onChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.getNotifications()
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  closeDataAlertModal = () => {
    this.setState({ isEditModalVisible: false })
  }

  getNotifications = () => {
    fetchNotificationFeed({
      ...this.props.authentication,
      offset: this.state.nextOffset,
      limit: this.NOTIFICATION_FETCH_LIMIT,
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

        const hasMore = !data?.items?.length || notificationList?.length === data?.pagination?.total_items

        if (this._isMounted) {
          this.setState({
            notificationList,
            pagination,
            nextOffset,
            hasMore,
            isFetchingFirstNotifications: false,
            fetchNotificationsError: null,
          })
        }
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        if (this._isMounted) {
          this.setState({
            isFetchingFirstNotifications: false,
            fetchNotificationsError: error,
          })
        }
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

      if (_isEqual(response.items, this.state.notificationList)) {
        return
      }

      if (!newNotifications?.length || newNotifications?.length === 10) {
        // Reset list and pagination to new list
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
    let expandedNotificationID = undefined
    const newList = this.state.notificationList.map((n) => {
      if (notification.id === n.id) {
        if (!n.expanded) {
          expandedNotificationID = notification.id
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
    this.setState({ notificationList: newList, expandedNotificationID })
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
    })
      .then(() => {
        this.props.onDismissCallback(newList)
        this.props.onChange(newList)
      })
      .catch((error) => {
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
    this.setState({ notificationList: newList }, () => {
      this.props.onDismissCallback(newList)
    })
  }

  onDeleteClick = (notification) => {
    const newList = this.state.notificationList.filter((n) => n.id !== notification.id)
    this.setState(
      {
        notificationList: newList,
        nextOffset: this.state.nextOffset > 0 ? this.state.nextOffset - 1 : 0,
      },
      () => {
        this.props.onDeleteCallback(newList)
      },
    )
  }

  onDataAlertSave = () => {
    // todo: show success alert
    this.setState({ isEditModalVisible: false })
    this.props.onSuccessCallback('Notification successfully updated.')
  }

  renderDismissAllButton = () => (
    <div key='dismiss-all-btn' className='react-autoql-notification-dismiss-all'>
      <span onClick={this.onDismissAllClick}>
        <Icon type='notification-off' style={{ verticalAlign: 'middle' }} /> Dismiss All
      </span>
    </div>
  )

  showEditDataAlertModal = (id) => {
    this.setState({ isEditModalVisible: true, expandedNotificationID: id })
  }

  renderEditDataAlertModal = () => {
    return (
      <DataAlertModalV2
        key={this.MODAL_COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={this.closeDataAlertModal}
        onOpened={this.props.onDataAlertModalOpen}
        onClosed={this.props.onDataAlertModalClose}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        allowDelete={this.state.activeDataAlert?.type === 'CUSTOM'}
        title={this.state.activeDataAlert ? 'Edit Data Alert' : 'Create Data Alert'}
        titleIcon={this.state.activeDataAlert ? <Icon type='edit' /> : <span />}
        tooltipID={this.props.tooltipID}
      />
    )
  }

  onNotificationExpand = (notification) => {
    const expandedID = this.state.expandedNotificationID
    if (expandedID && expandedID !== notification.id) {
      this.notificationRefs[expandedID]?.collapse()
    }

    this.setState({
      expandedNotificationID: notification.id,
    })
  }

  render = () => {
    let style = {}
    if (!this.props.shouldRender) {
      style.visibility = 'hidden'
      style.opacity = '0'
    }

    if (this.state.isFetchingFirstNotifications) {
      return (
        <div style={style} className='notification-list-loading-container' data-test='notification-list'>
          Loading...
        </div>
      )
    } else if (this.state.fetchNotificationsError) {
      return (
        <div style={style} className='notification-list-loading-container' data-test='notification-list'>
          Oh no! Something went wrong while accessing your notifications.
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <Button onClick={this.getInitialNotifications}>Try Again</Button>
          </div>
        </div>
      )
    }

    return (
      <ErrorBoundary>
        <div style={style} className='react-autoql-notification-list-container' data-test='notification-list'>
          {!this.props.tooltipID && (
            <Tooltip
              className='react-autoql-tooltip'
              id='react-autoql-notification-tooltip'
              effect='solid'
              delayShow={500}
              html
            />
          )}
          {_get(this.state.notificationList, 'length') ? (
            <Fragment>
              {this.renderDismissAllButton()}
              <CustomScrollbars>
                <InfiniteScroll
                  initialLoad={false}
                  pageStart={0}
                  loadMore={this.getNotifications}
                  hasMore={this.state.pagination.total_items > this.state.notificationList.length}
                  loader={
                    <div className='react-autoql-spinner-centered' key={0}>
                      <Spinner />
                    </div>
                  }
                  useWindow={false}
                >
                  <div className='notification-feed-list'>
                    {this.state.notificationList.map((notification, i) => {
                      return (
                        <NotificationItem
                          ref={(ref) => (this.notificationRefs[notification.id] = ref)}
                          key={`notification-item-${i}`}
                          authentication={this.props.authentication}
                          notification={notification}
                          expanded={!!notification.expanded}
                          onClick={this.onItemClick}
                          onDismissCallback={this.onDismissClick}
                          onDismissSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          onDeleteCallback={this.onDeleteClick}
                          onDeleteSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                            this.getNotifications()
                          }}
                          onExpandCallback={this.onNotificationExpand}
                          // onCollapseCallback={this.props.onCollapseCallback}
                          activeNotificationData={this.props.activeNotificationData}
                          autoChartAggregations={this.props.autoChartAggregations}
                          onErrorCallback={this.props.onErrorCallback}
                          onEditClick={(dataAlert) => {
                            this.setState({ activeDataAlert: dataAlert })
                            this.showEditDataAlertModal()
                          }}
                          enableAjaxTableData={this.props.enableAjaxTableData}
                        />
                      )
                    })}
                  </div>
                </InfiniteScroll>
              </CustomScrollbars>
            </Fragment>
          ) : (
            <div className='empty-notifications-message'>
              <img className='empty-notifications-img' src={emptyStateImg} />
              <div className='empty-notifications-title'>No notifications yet.</div>
              <div>Stay tuned!</div>
              <br />
              {this.props.showCreateAlertBtn && (
                <Button style={{ marginTop: '10px' }} type='primary' onClick={this.showEditDataAlertModal}>
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

export default withTheme(NotificationFeed)
