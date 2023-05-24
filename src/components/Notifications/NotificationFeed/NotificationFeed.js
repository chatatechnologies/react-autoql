import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import InfiniteScroll from 'react-infinite-scroller'
import { v4 as uuid } from 'uuid'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import { DataAlertModal } from '../DataAlertModal'
import { Button } from '../../Button'
import { CustomScrollbars } from '../../CustomScrollbars'
import { Spinner } from '../../Spinner'
import { Tooltip } from '../../Tooltip'
import { Modal } from '../../Modal'
import { DataAlerts } from '../DataAlerts'
import { LoadingDots } from '../../LoadingDots'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ConfirmPopover } from '../../ConfirmPopover'

import { fetchNotificationFeed, dismissAllNotifications, fetchDataAlerts } from '../../../js/notificationService'
import { authenticationType } from '../../../props/types'
import { authenticationDefault, getAuthentication, getAutoQLConfig } from '../../../props/defaults'
import { withTheme } from '../../../theme'

import emptyStateImg from '../../../images/notifications_empty_state_blue.png'

import './NotificationFeed.scss'

class NotificationFeed extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.MODAL_COMPONENT_KEY = uuid()
    this.NOTIFICATION_FETCH_LIMIT = 10
    // Open event source http connection here to receive SSE
    // notificationEventSource = new EventSource(
    //   'https://backend.chata.io/notifications'
    // )

    this.notificationRefs = {}

    this.state = {
      isFetchingFirstNotifications: true,
      isDataAlertsManagerOpen: false,
      unFetchedNotifications: 0,
      notificationList: [],
      isLoading: false,
      pagination: {},
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    showNotificationDetails: PropTypes.bool,
    onErrorCallback: PropTypes.func,
    onSuccessCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    onChange: PropTypes.func,
    autoChartAggregations: PropTypes.bool,
    showCreateAlertBtn: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,
    onModalOpen: PropTypes.func,
    shouldRender: PropTypes.bool,
    onDataAlertChange: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    showDataAlertsManager: false,
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
    onModalOpen: () => {},
    onUnreadCallback: () => {},
    onDataAlertChange: () => {},
    onChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.shouldRender) {
      this.getNotifications()
      this.getDataAlerts()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!this.props.shouldRender && prevProps.shouldRender) {
      this.collapseActive()
    } else if (this.props.shouldRender && !prevProps.shouldRender && !this.hasFetchedNotifications) {
      this.getNotifications()
      this.getDataAlerts()
    }

    if (this.props.shouldRender && this.state.unFetchedNotifications && !prevState.unFetchedNotifications) {
      this.refreshNotifications()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  closeDataAlertModal = () => {
    this.setState({ isEditModalVisible: false })
  }

  getDataAlerts = () => {
    fetchDataAlerts({ ...getAuthentication(this.props.authentication) }).then((response) => {
      const customAlerts = response?.data?.custom_alerts ?? []
      const projectAlerts = response?.data?.project_alerts ?? []
      const dataAlerts = [...customAlerts, ...projectAlerts]
      this.setState({ dataAlerts })
    })
  }

  getNotifications = () => {
    if (!this.props.shouldRender || this.state.isLoading || this.state.unFetchedNotifications) {
      return
    }

    this.hasFetchedNotifications = true
    const offset = this.state.notificationList?.length ?? 0

    if (this.state.pagination && this.state.pagination.total_items <= offset) {
      return
    }

    this.setState({ isLoading: true })
    return fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      limit: this.NOTIFICATION_FETCH_LIMIT,
      offset,
    })
      .then((data) => {
        if (!data?.items?.length) {
          this.setState({
            isFetchingFirstNotifications: false,
            fetchNotificationsError: null,
            isLoading: false,
          })
          return
        }

        // If there are duplicate notifications, that means a new one was triggered since the last fetch
        // Ignore these, then do a refresh to add the new notifications to the beginning of the list
        const newList =
          data.items.filter((notification) => !this.state.notificationList.find((n) => n.id === notification.id)) ?? []

        let unFetchedNotifications = 0
        if (newList.length !== data.items.length) {
          unFetchedNotifications = data.items.length - newList.length
        }

        const newState = {
          isFetchingFirstNotifications: false,
          fetchNotificationsError: null,
          unFetchedNotifications,
          isLoading: false,
        }

        if (newList?.length && this._isMounted) {
          newState.notificationList = [...this.state.notificationList, ...newList]
          newState.pagination = data.pagination
        }

        this.setState(newState)
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        if (this._isMounted) {
          this.setState({
            isFetchingFirstNotifications: false,
            fetchNotificationsError: error,
            isLoading: false,
          })
        }
      })
  }

  getNewNotifications = () => {
    const limit =
      (this.state.notificationList?.length ?? this.NOTIFICATION_FETCH_LIMIT) + (this.state.unFetchedNotifications ?? 0)

    fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: 0,
      limit,
    }).then((response) => {
      const items = response?.items
      const notificationList = this.state.notificationList
      const lastIndex = response.items?.length - 1

      if (
        items?.[0]?.id === notificationList?.[0]?.id &&
        items?.[lastIndex]?.id === notificationList?.[lastIndex]?.id
      ) {
        // There are no new notifications if the first (newest) is the same as what is already there
        this.setState({ unFetchedNotifications: 0 })
        return
      }

      this.setState({
        notificationList: response.items,
        pagination: response.pagination,
        unFetchedNotifications: 0,
      })
    })
  }

  refreshNotifications = () => {
    this.getDataAlerts()

    if (!this.hasFetchedNotifications) {
      return this.getNotifications()
    }

    return this.getNewNotifications()
  }

  getNewNotificationsFromResponse = (items) => {
    const newNotifications = []
    items.every((notification) => {
      // If we have reached a notification that is already loaded, stop looping
      if (this.state.notificationList.find((n) => n.id === notification.id)) {
        return false
      }

      newNotifications.push(notification)
      return true
    })
    return newNotifications
  }

  onDeleteAllClick = () => {}

  onMarkAllAsReadClick = () => {
    const newList = this.state.notificationList.map((n) => {
      return {
        ...n,
        state: 'DISMISSED',
      }
    })

    this.setState({ notificationList: newList })

    return dismissAllNotifications({
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

  onUnreadClick = (notification) => {
    const newList = this.state.notificationList.map((n) => {
      if (notification.id === n.id) {
        return {
          ...n,
          state: 'ACKNOWLEDGED',
        }
      }
      return n
    })
    this.setState({ notificationList: newList }, () => {
      this.props.onUnreadCallback(newList)
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
    let pagination = this.state.pagination
    if (pagination) {
      pagination = {
        ...this.state.pagination,
        total_items: pagination.total_items > 0 ? pagination.total_items - 1 : 0,
      }
    }

    this.setState({
      notificationList: newList, // pagination,
      isLoading: true,
    })
  }

  onDeleteEnd = () => {
    this.setState({ isLoading: false })
  }

  onDataAlertSave = () => {
    this.setState({ isEditModalVisible: false })
  }

  renderTopOptions = () => {
    return (
      <div className='notification-feed-top-options-container'>
        {this.renderDeleteAllButton()}
        {this.renderDataAlertsManagerButton()}
        {this.renderMarkAllAsReadButton()}
      </div>
    )
  }

  renderDataAlertsManagerButton = () => {
    if (!this.props.showDataAlertsManager) {
      return <div />
    }

    return (
      <div
        onClick={() => {
          this.setState({ isDataAlertsManagerOpen: true })
        }}
        className='react-autoql-notification-mark-all'
      >
        <Icon type='list-settings' /> <span>Data Alerts</span>
      </div>
    )
  }

  renderDeleteAllButton = () => {
    return null
    // Enable this once the batch delete endpoint is ready
    return (
      <div onClick={this.onDeleteAllClick} className='react-autoql-notification-delete-all'>
        <Icon type='trash' /> <span>Delete all</span>
      </div>
    )
  }

  renderMarkAllAsReadButton = () => (
    <ConfirmPopover
      onConfirm={this.onMarkAllAsReadClick}
      title='Mark all as read?'
      confirmText='Yes'
      backText='Cancel'
      popoverParentElement={this.feedContainer}
      positions={['bottom', 'left', 'right', 'top']}
      align='end'
    >
      <div className='react-autoql-notification-mark-all'>
        <Icon type='mark-read' /> <span>Mark all as read</span>
      </div>
    </ConfirmPopover>
  )

  showEditDataAlertModal = (alertData) => {
    this.setState({ isEditModalVisible: true, activeDataAlert: alertData })
  }

  renderDataAlertsManagerModal = () => {
    if (!this.props.showDataAlertsManager) {
      return null
    }

    return (
      <Modal
        contentClassName='react-autoql-data-alert-manager-modal'
        overlayStyle={{ zIndex: '9998' }}
        title='Data Alerts'
        titleIcon={<Icon type='list-settings' />}
        isVisible={this.state.isDataAlertsManagerOpen}
        onOpened={this.props.onModalOpen}
        onClosed={this.props.onModalClose}
        onClose={() => {
          this.setState({ isDataAlertsManagerOpen: false })
        }}
        enableBodyScroll
        showFooter={false}
      >
        <DataAlerts
          authentication={this.props.authentication}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessAlert={this.props.onSuccessCallback}
        />
      </Modal>
    )
  }

  renderEditDataAlertModal = () => {
    return (
      <DataAlertModal
        key={this.MODAL_COMPONENT_KEY}
        authentication={this.props.authentication}
        isVisible={this.state.isEditModalVisible}
        onClose={this.closeDataAlertModal}
        onOpened={this.props.onModalOpen}
        onClosed={this.props.onModalClose}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        allowDelete={this.state.activeDataAlert?.type === 'CUSTOM'}
        tooltipID={this.props.tooltipID}
        editView
      />
    )
  }

  collapseActive = () => {
    const expandedID = this.state.expandedNotificationID
    this.notificationRefs[expandedID]?.collapse()
    this.setState({ expandedNotificationID: undefined })
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

  hasMoreNotifications = () => {
    return !this.state.isLoading && this.state.pagination?.total_items > this.state.notificationList?.length
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
          <LoadingDots />
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
        <div
          ref={(r) => (this.feedContainer = r)}
          style={style}
          className='react-autoql-notification-list-container'
          data-test='notification-list'
        >
          {!this.props.tooltipID && (
            <Tooltip
              className='react-autoql-tooltip'
              id='react-autoql-notification-tooltip'
              effect='solid'
              delayShow={500}
              html
            />
          )}
          {this.state.notificationList?.length ? (
            <Fragment>
              {this.renderTopOptions()}
              <CustomScrollbars ref={(r) => (this.scrollRef = r)}>
                <InfiniteScroll
                  pageStart={0}
                  useWindow={false}
                  initialLoad={false}
                  loadMore={this.getNotifications}
                  hasMore={this.hasMoreNotifications()}
                  getScrollParent={() => this.scrollRef?.getContainer()}
                >
                  <div className='notification-feed-list'>
                    {this.state.notificationList.map((notification, i) => {
                      const dataAlert = this.state.dataAlerts?.find((alert) => alert.id === notification.data_alert_id)
                      return (
                        <NotificationItem
                          ref={(ref) => (this.notificationRefs[notification.id] = ref)}
                          key={notification.id}
                          authentication={this.props.authentication}
                          autoQLConfig={{
                            ...getAutoQLConfig(this.props.autoQLConfig),
                            enableColumnVisibilityManager: false,
                            enableNotifications: false,
                            enableCSVDownload: false,
                            enableDrilldowns: false,
                            enableReportProblem: false,
                          }}
                          notification={notification}
                          dataAlert={dataAlert}
                          expanded={!!notification.expanded}
                          onDismissCallback={this.onDismissClick}
                          onUnreadCallback={this.onUnreadClick}
                          onQueryClick={this.props.onQueryClick}
                          onDismissSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          onDeleteClick={this.onDeleteClick}
                          onDeleteEnd={this.onDeleteEnd}
                          onDeleteSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          onExpandCallback={this.onNotificationExpand}
                          autoChartAggregations={this.props.autoChartAggregations}
                          onErrorCallback={this.props.onErrorCallback}
                          onSuccessCallback={this.props.onSuccessCallback}
                          onDataAlertChange={this.props.onDataAlertChange}
                          onEditClick={(dataAlert) => {
                            this.showEditDataAlertModal(dataAlert)
                          }}
                          enableAjaxTableData={this.props.enableAjaxTableData}
                          isResizing={this.props.isResizing}
                        />
                      )
                    })}
                    {this.state.isLoading && (
                      <div className='react-autoql-spinner-centered'>
                        <Spinner />
                      </div>
                    )}
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
          {this.renderDataAlertsManagerModal()}
        </div>
      </ErrorBoundary>
    )
  }
}

export default withTheme(NotificationFeed)
