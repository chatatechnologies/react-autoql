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

  componentDidUpdate = (prevProps) => {
    if (!this.props.shouldRender && prevProps.shouldRender) {
      this.collapseActive()
    } else if (this.props.shouldRender && !prevProps.shouldRender && !this.hasFetchedNotifications) {
      this.getNotifications()
      this.getDataAlerts()
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
    if (!this.props.shouldRender) {
      return
    }

    this.hasFetchedNotifications = true
    return fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: this.state.nextOffset,
      limit: this.NOTIFICATION_FETCH_LIMIT,
    })
      .then((data) => {
        let notificationList = _cloneDeep(this.state.notificationList)
        let nextOffset = this.state.nextOffset
        let pagination = this.state.pagination

        if (data?.items?.length) {
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
    this.getDataAlerts()

    if (!this.hasFetchedNotifications) {
      return this.getNotifications()
    }

    // Regardless of how many notifications are loaded, we only want to add the new ones to the top
    return fetchNotificationFeed({
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
          // onAlertInitializationCallback={handleInitialize}
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
                    {this.state.notificationList.map((notification) => {
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
                            enableCSVDownload: true,
                            enableDrilldowns: false,
                            enableReportProblem: false,
                          }}
                          notification={notification}
                          dataAlert={dataAlert}
                          expanded={!!notification.expanded}
                          onClick={this.onItemClick}
                          onDismissCallback={this.onDismissClick}
                          onUnreadCallback={this.onUnreadClick}
                          onDismissSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          onDeleteCallback={this.onDeleteClick}
                          onDeleteSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                            this.refreshNotifications()
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
