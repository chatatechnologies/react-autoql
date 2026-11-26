import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import {
  fetchNotificationFeed,
  dismissAllNotifications,
  fetchDataAlerts,
  authenticationDefault,
  getAuthentication,
  getAutoQLConfig,
  deleteMultipleNotifications,
  deleteAllNotifications,
} from 'autoql-fe-utils'
import classNames from 'classnames'
import { Icon } from '../../Icon'
import { Modal } from '../../Modal'
import { Button } from '../../Button'
import { Checkbox } from '../../Checkbox'
import { Spinner } from '../../Spinner'
import { Tooltip } from '../../Tooltip'
import { DataAlerts } from '../DataAlerts'
import { DataAlertModal } from '../DataAlertModal'
import { ConfirmPopover } from '../../ConfirmPopover'
import { InfiniteScroll } from '../../InfiniteScroll'
import { NotificationItem } from '../NotificationItem'
import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { withTheme } from '../../../theme'
import { authenticationType, valueActionCallbacksType } from '../../../props/types'
import emptyStateImg from '../../../images/notifications_empty_state_blue.png'

import './NotificationFeed.scss'

class NotificationFeed extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.MODAL_COMPONENT_KEY = uuid()
    this.NOTIFICATION_FETCH_LIMIT = 10
    this.ALL_IDS_FETCH_LIMIT = 500
    this.MIN_FETCH_LIMIT = 10
    this.MAX_FETCH_LIMIT = 30
    this.CONTAINER_PADDING_OFFSET = 172.5 // Padding offset for container height calculation
    this.NOTIFICATION_ITEM_HEIGHT = 60 // Height of each notification item
    this.TOOLTIP_ID = 'react-autoql-notification-feed-tooltip'
    this.CHART_TOOLTIP_ID = 'react-autoql-notification-feed-chart-tooltip'
    this.ALL_PROJECTS = 'All'
    this.DELETE_NOTIFICATIONS_SUCCESSFULL_MESSAGE = 'The notifications have been deleted successfully.'
    this.notificationRefs = {}

    this.state = {
      isFetchingFirstNotifications: true,
      isDataAlertsManagerOpen: false,
      unFetchedNotifications: 0,
      notificationList: [],
      isFetching: false,
      isDeleting: false,
      pagination: {},
      displayNotificationItemCheckbox: false,
      selectedNotifications: [],
      isAllSelected: false,
      isEverythingSelected: false,
      isMobile: false,
      isLandscape: false,
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
    onModalOpen: PropTypes.func,
    shouldRender: PropTypes.bool,
    onDataAlertChange: PropTypes.func,
    tooltipID: PropTypes.string,
    chartTooltipID: PropTypes.string,
    enableSettingsMenu: PropTypes.bool,
    enableNotificationsMenu: PropTypes.bool,
    displayProjectName: PropTypes.bool,
    displayNotificationItemCheckbox: PropTypes.bool,
    enableFilterBtn: PropTypes.bool,
    enableFetchAllNotificationFeedAcrossProjects: PropTypes.bool,
    selectedProjectId: PropTypes.string,
    selectedProjectName: PropTypes.string,
    notificationTitle: PropTypes.string,
    showSelectNotificationsButton: PropTypes.bool,
    onConfirmCallback: PropTypes.func,
    enableCyclicalDates: PropTypes.bool,
    enableMagicWand: PropTypes.bool,
    showMagicWandQuoteButton: PropTypes.bool,
    enableBillingGate: PropTypes.bool,
    onQuotaExceeded: PropTypes.func,
    valueActionCallbacks: valueActionCallbacksType,
  }

  static defaultProps = {
    isMobile: false,
    isMobileLandscape: false,
    authentication: authenticationDefault,
    showDataAlertsManager: false,
    showNotificationDetails: true,
    autoChartAggregations: false,
    showCreateAlertBtn: false,
    shouldRender: true,
    enableSettingsMenu: true,
    enableNotificationsMenu: true,
    displayProjectName: false,
    displayNotificationItemCheckbox: true,
    enableFilterBtn: true,
    enableFetchAllNotificationFeedAcrossProjects: false,
    selectedProjectId: 'all',
    selectedProjectName: this.ALL_PROJECTS,
    notificationTitle: '',
    showSelectNotificationsButton: true,
    enableCyclicalDates: false,
    showMagicWandQuoteButton: false,
    enableBillingGate: false,
    onQuotaExceeded: undefined,
    valueActionCallbacks: undefined,
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
    onConfirmCallback: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.shouldRender) {
      this.updateFetchLimit()
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

    if (prevState.notificationList?.length !== this.state.notificationList?.length) {
      this.updateScrollbars(1000)
    }
    if (
      (prevProps.selectedProjectId !== this.props.selectedProjectId ||
        prevProps.notificationTitle !== this.props.notificationTitle) &&
      this.props.enableFetchAllNotificationFeedAcrossProjects
    ) {
      this.filterNotificationsByProject()
      this.setState({
        isFetchingFirstNotifications: true,
      })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  estimateFetchLimitFromViewport = () => {
    const viewportHeight = window.innerHeight
    const containerHeight = viewportHeight - this.CONTAINER_PADDING_OFFSET
    const itemHeight = this.NOTIFICATION_ITEM_HEIGHT
    const visibleItemCount = Math.floor(containerHeight / itemHeight)
    const optimalLimit = visibleItemCount < this.MIN_FETCH_LIMIT ? this.MIN_FETCH_LIMIT : visibleItemCount
    return Math.min(optimalLimit, this.MAX_FETCH_LIMIT)
  }

  updateFetchLimit = () => {
    const newLimit = this.estimateFetchLimitFromViewport()
    if (newLimit !== this.NOTIFICATION_FETCH_LIMIT) {
      this.NOTIFICATION_FETCH_LIMIT = newLimit
    }
  }

  handleButtonRelease() {
    clearTimeout(this.buttonPressTimer)
    document.body.style.webkitUserSelect = null
  }

  closeDataAlertModal = () => {
    this.setState({ isEditModalVisible: false })
  }

  getDataAlerts = async () => {
    await fetchDataAlerts({ ...getAuthentication(this.props.authentication) })
      .then((response) => {
        const customAlerts = response?.data?.custom_alerts ?? []
        const projectAlerts = response?.data?.project_alerts ?? []
        const dataAlerts = [...customAlerts, ...projectAlerts]
        this.setState({ dataAlerts })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  getNotifications = () => {
    if (
      !this.props.shouldRender ||
      this.state.isFetching ||
      this.state.isDeleting ||
      this.state.unFetchedNotifications
    ) {
      return
    }

    this.hasFetchedNotifications = true
    const offset = this.state.notificationList?.length ?? 0

    if (this.state.pagination && this.state.pagination.total_items <= offset) {
      return
    }

    this.setState({ isFetching: true })
    return fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      limit: this.NOTIFICATION_FETCH_LIMIT,
      offset,
      enableFetchAllNotificationFeedAcrossProjects: this.props.enableFetchAllNotificationFeedAcrossProjects,
      selectedProjectId: this.props.selectedProjectId,
      notificationTitle: this.props.notificationTitle,
    })
      .then((data) => {
        if (!data?.items?.length) {
          this.setState({
            isFetchingFirstNotifications: false,
            fetchNotificationsError: null,
            isFetching: false,
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
          isFetching: false,
        }

        if (newList?.length && this._isMounted) {
          newState.notificationList = [...this.state.notificationList, ...newList]
          newState.pagination = data.pagination
          if (this.state.isAllSelected) {
            newState.selectedNotifications = [...this.state.selectedNotifications, ...newList.map((n) => n.id)]
          }
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
            isFetching: false,
          })
        }
      })
  }

  getNewNotifications = () => {
    const limit = this.props.enableFetchAllNotificationFeedAcrossProjects
      ? this.NOTIFICATION_FETCH_LIMIT
      : (this.state.notificationList?.length || this.NOTIFICATION_FETCH_LIMIT) +
        (this.state.unFetchedNotifications ?? 0)

    fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: 0,
      limit: limit,
      enableFetchAllNotificationFeedAcrossProjects: this.props.enableFetchAllNotificationFeedAcrossProjects,
      selectedProjectId: this.props.selectedProjectId,
    })
      .then((response) => {
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
          ...(this.state.isAllSelected && { selectedNotifications: response.items?.map((n) => n.id) ?? [] }),
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }
  filterNotificationsByProject = () => {
    fetchNotificationFeed({
      ...getAuthentication(this.props.authentication),
      offset: 0,
      limit: this.NOTIFICATION_FETCH_LIMIT,
      enableFetchAllNotificationFeedAcrossProjects: true,
      selectedProjectId: this.props.selectedProjectId,
      notificationTitle: this.props.notificationTitle,
    })
      .then((response) => {
        const items = response?.items
        const notificationList = this.state.notificationList
        const lastIndex = response.items?.length - 1

        if (
          items?.[0]?.id === notificationList?.[0]?.id &&
          items?.[lastIndex]?.id === notificationList?.[lastIndex]?.id
        ) {
          // There are no new notifications if the first (newest) is the same as what is already there
          this.setState({ unFetchedNotifications: 0, isFetchingFirstNotifications: false })
          return
        }

        // A different project or title filter is a different set of notifications, so clear the selection
        this.setState({
          isFetchingFirstNotifications: false,
          notificationList: response.items,
          pagination: response.pagination,
          unFetchedNotifications: 0,
          selectedNotifications: [],
          isAllSelected: false,
          isEverythingSelected: false,
        })
      })
      .catch((error) => {
        console.error(error)
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

  onDeleteAllClick = () => {
    this.setState({
      notificationList: [],
      pagination: { ...this.state.pagination, total_items: 0 },
      isDeleting: true,
      selectedNotifications: [],
      isAllSelected: false,
      isEverythingSelected: false,
      displayNotificationItemCheckbox: false,
    })
  }
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
  onDeleteMultipleNotificationsClick = () => {
    const newList = this.state.notificationList.filter((n) => !this.state.selectedNotifications.includes(n.id))
    const deletedCount = this.state.notificationList.length - newList.length
    let pagination = this.state.pagination ?? {}
    if (pagination) {
      pagination = {
        ...pagination,
        total_items: Math.max((pagination.total_items ?? 0) - deletedCount, 0),
      }
    }

    this.setState({
      notificationList: newList,
      pagination,
      isDeleting: true,
      selectedNotifications: [],
      isAllSelected: false,
      isEverythingSelected: false,
      displayNotificationItemCheckbox: false,
    })
  }
  onDeleteClick = (notification) => {
    const newList = this.state.notificationList.filter((n) => n.id !== notification.id)

    let pagination = this.state.pagination ?? {}
    if (pagination) {
      pagination = {
        ...pagination,
        total_items: pagination.total_items > 0 ? pagination.total_items - 1 : 0,
      }
    }

    this.setState({
      notificationList: newList,
      pagination,
      isDeleting: true,
    })
  }

  onDeleteEnd = () => {
    this.setState({ isDeleting: false }, () => {
      if (this.hasMoreNotifications() && this.state.notificationList?.length < this.NOTIFICATION_FETCH_LIMIT) {
        this.getNotifications()
      }
    })
  }

  onDataAlertSave = () => {
    this.setState({ isEditModalVisible: false })
  }
  onDataAlertDelete = () => {
    this.setState({
      isEditModalVisible: false,
    })
    this.refreshNotifications()
  }
  onSelectNotificationClick = () => {
    this.lastClickedNotificationID = undefined
    this.collapseActive()
    this.setState({ displayNotificationItemCheckbox: true })
  }
  onCancelSelectNotificationClick = () => {
    this.lastClickedNotificationID = undefined
    this.setState({
      displayNotificationItemCheckbox: false,
      selectedNotifications: [],
      isAllSelected: false,
      isEverythingSelected: false,
    })
  }
  onNotificationItemClick = (option, e) => {
    const selected = this.state.selectedNotifications ?? []
    const isSelecting = !selected.includes(option.id)

    // Shift-click applies the clicked notification's new state to every notification between it and the
    // last one clicked
    let ids = [option.id]
    const list = this.state.notificationList
    const anchorIndex = list.findIndex((n) => n.id === this.lastClickedNotificationID)
    if (e?.shiftKey && anchorIndex !== -1) {
      const index = list.findIndex((n) => n.id === option.id)
      ids = list.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1).map((n) => n.id)
    }
    this.lastClickedNotificationID = option.id

    if (isSelecting) {
      this.setState({ selectedNotifications: [...selected, ...ids.filter((id) => !selected.includes(id))] })
    } else {
      // Unselecting leaves "all" mode: only the notifications still checked will be deleted
      this.setState({
        selectedNotifications: selected.filter((id) => !ids.includes(id)),
        isAllSelected: false,
        isEverythingSelected: false,
      })
    }
  }
  onSelectAllClick = () => {
    if (this.state.isAllSelected) {
      this.setState({ selectedNotifications: [], isAllSelected: false, isEverythingSelected: false })
    } else {
      this.setState({ selectedNotifications: this.state.notificationList.map((n) => n.id), isAllSelected: true })
    }
  }
  // The header checkbox selects the loaded notifications. The banner then offers every notification the feed is
  // showing (same project and title filter), except when the feed spans all projects: selecting everything never
  // deletes across projects.
  canSelectEverything = () => {
    if (!this.props.enableFetchAllNotificationFeedAcrossProjects) {
      return true
    }
    const projectId = this.props.selectedProjectId
    return !!projectId && `${projectId}`.toLowerCase() !== 'all'
  }
  isDeleteAllSelected = () => this.state.isEverythingSelected && this.canSelectEverything()
  onSelectEverythingClick = () => {
    this.setState({ isEverythingSelected: true })
  }
  onClearSelectionClick = () => {
    this.setState({ selectedNotifications: [], isAllSelected: false, isEverythingSelected: false })
  }
  getEverythingLabel = (total) => {
    const notifications = `${total} notification${total === 1 ? '' : 's'}`
    return this.props.enableFetchAllNotificationFeedAcrossProjects
      ? `${notifications} in ${this.props.selectedProjectName}`
      : notifications
  }
  renderSelectAllBanner = () => {
    const total = this.state.pagination?.total_items ?? 0
    const loaded = this.state.notificationList.length
    if (
      !this.state.displayNotificationItemCheckbox ||
      !this.state.isAllSelected ||
      !this.canSelectEverything() ||
      total <= loaded
    ) {
      return null
    }

    if (this.state.isEverythingSelected) {
      return (
        <div className='react-autoql-notification-select-all-banner'>
          <span>All {this.getEverythingLabel(total)} are selected.</span>{' '}
          <a onClick={this.onClearSelectionClick}>Clear selection</a>
        </div>
      )
    }

    return (
      <div className='react-autoql-notification-select-all-banner'>
        <span>All {loaded} loaded notifications are selected.</span>{' '}
        <a onClick={this.onSelectEverythingClick}>Select all {this.getEverythingLabel(total)}</a>
      </div>
    )
  }
  // The IDs of every notification the feed is showing, fetched from the same list endpoint (without query results).
  // Each request starts after the IDs already fetched, so a service that returns fewer than `limit` per page is still
  // read to the end. It stops at `total` IDs, or when a page adds none (the end, or a service ignoring the offset).
  fetchAllNotificationIds = async (total) => {
    const ids = new Set()
    while (ids.size < total) {
      const data = await fetchNotificationFeed({
        ...getAuthentication(this.props.authentication),
        offset: ids.size,
        limit: this.ALL_IDS_FETCH_LIMIT,
        enableFetchAllNotificationFeedAcrossProjects: this.props.enableFetchAllNotificationFeedAcrossProjects,
        selectedProjectId: this.props.selectedProjectId,
        notificationTitle: this.props.notificationTitle,
      })
      const countBefore = ids.size
      ;(data?.items ?? []).forEach((n) => ids.add(n.id))
      if (ids.size === countBefore) {
        break
      }
    }
    return [...ids]
  }
  deleteEverySelectedNotification = () => {
    const total = this.state.pagination?.total_items ?? 0
    this.props.onConfirmCallback()
    this.onDeleteAllClick()
    return this.fetchAllNotificationIds(total)
      .then((notificationList) =>
        deleteMultipleNotifications({ ...getAuthentication(this.props.authentication), notificationList }),
      )
      .then(() => this.handleDeleteNotificationsResponse())
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        // The list was cleared before deleting, so load it again to show what is left. isDeleting is cleared here
        // because getNotifications does nothing while a delete is in progress.
        this.setState({ pagination: {}, isDeleting: false }, this.getNotifications)
      })
      .finally(this.onDeleteEnd)
  }
  onDeleteSelectedConfirm = () => {
    if (this.isDeleteAllSelected()) {
      this.deleteEverySelectedNotification()
    } else {
      this.deleteSelectedNotification()
    }
  }
  renderTopOptions = () => {
    const shouldRenderDeleteAllButton =
      this.props.enableFetchAllNotificationFeedAcrossProjects &&
      !this.state.displayNotificationItemCheckbox &&
      this.props.showSelectNotificationsButton
    return (
      <div className='notification-feed-top-options-container'>
        {shouldRenderDeleteAllButton && this.renderDeleteAllButton()}
        {this.state.displayNotificationItemCheckbox
          ? this.renderSelectAllControl()
          : this.renderDataAlertsManagerButton()}
        {this.renderNotificationsOptionsButton()}
      </div>
    )
  }
  renderNotificationItemCheckbox = (notification) => {
    return (
      <div className='notification-item-checkbox'>
        {/* Not clickable itself: the click reaches the notification container, which handles shift-click too */}
        <Checkbox
          checked={this.state.selectedNotifications.includes(notification.id)}
          className='notification-item-checkbox'
          clickable={false}
        />
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
    const projectName =
      this.props.selectedProjectName === this.ALL_PROJECTS ? 'all data sources' : this.props.selectedProjectName
    let title = `Delete all notifications for ${projectName}?`

    return (
      <ConfirmPopover
        onConfirm={this.deleteAllNotifications}
        title={title}
        confirmText='Delete'
        danger
        backText='Cancel'
        popoverParentElement={this.props.popoverParentElement ?? this.feedContainer}
        positions={['bottom', 'left', 'right', 'top']}
        align='end'
      >
        <div className='react-autoql-notification-delete-all'>
          <Icon type='trash' /> <span>Delete all</span>
        </div>
      </ConfirmPopover>
    )
  }

  renderMarkAllAsReadButton = () => (
    <ConfirmPopover
      onConfirm={this.onMarkAllAsReadClick}
      title='Mark all as read?'
      confirmText='Yes'
      backText='Cancel'
      popoverParentElement={this.props.popoverParentElement ?? this.feedContainer}
      positions={['bottom', 'left', 'right', 'top']}
      align='end'
    >
      <div className='react-autoql-notification-mark-all'>
        <Icon type='mark-read' /> <span>Mark all as read</span>
      </div>
    </ConfirmPopover>
  )
  renderSelectMultipleNotificationsButton = () => (
    <div className='react-autoql-notification-select-button' onClick={this.onSelectNotificationClick}>
      <Icon type='select-multiple' />
      <span>Select</span>
    </div>
  )
  getSelectedCount = () => {
    if (this.isDeleteAllSelected()) {
      return this.state.pagination?.total_items ?? this.state.notificationList.length
    }
    return this.state.selectedNotifications.length
  }
  // Sits on the left, above the notification checkboxes. Shows a dash when only some are selected.
  renderSelectAllControl = () => {
    const hasSelection = this.state.selectedNotifications.length > 0
    return (
      <div className='react-autoql-notification-select-all' onClick={this.onSelectAllClick}>
        <Checkbox
          checked={this.state.isAllSelected}
          indeterminate={hasSelection && !this.state.isAllSelected}
          clickable={false}
        />
        <span>Select all</span>
      </div>
    )
  }
  getDeleteSelectedTitle = () => {
    if (this.isDeleteAllSelected()) {
      const total = this.getSelectedCount()
      return `Delete all ${this.getEverythingLabel(total)}?`
    }

    const count = this.state.selectedNotifications.length
    return `Delete ${count} notification${count === 1 ? '' : 's'}?`
  }
  renderDeleteButton = () => (
    <ConfirmPopover
      onConfirm={this.onDeleteSelectedConfirm}
      title={this.getDeleteSelectedTitle()}
      confirmText='Delete'
      danger
      backText='Cancel'
      popoverParentElement={this.props.popoverParentElement ?? this.feedContainer}
      positions={['bottom', 'left', 'right', 'top']}
      align='end'
      disable={this.state.selectedNotifications.length === 0}
    >
      <div
        className={`react-autoql-notification-delete ${this.state.selectedNotifications.length === 0 ? 'disable' : ''}`}
      >
        <Icon type='trash' />{' '}
        <span className='react-autoql-notification-delete-label'>
          {this.getSelectedCount() ? `Delete (${this.getSelectedCount()})` : 'Delete'}
        </span>
      </div>
    </ConfirmPopover>
  )
  renderNotificationsOptionsButton = () =>
    this.state.displayNotificationItemCheckbox ? (
      <div className='react-autoql-notification-select-container'>
        {this.renderDeleteButton()}
        <div className='react-autoql-notification-select-button'>
          <span onClick={this.onCancelSelectNotificationClick}>Cancel</span>
        </div>
      </div>
    ) : this.props.showSelectNotificationsButton ? (
      <div className='react-autoql-notification-select-container'>
        {this.renderSelectMultipleNotificationsButton()}
        {this.renderMarkAllAsReadButton()}
      </div>
    ) : null

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
        onDelete={this.onDataAlertDelete}
        onSuccessAlert={this.props.onSuccessCallback}
        currentDataAlert={this.state.activeDataAlert}
        onSave={this.onDataAlertSave}
        onErrorCallback={this.props.onErrorCallback}
        allowDelete={this.state.activeDataAlert?.type === 'CUSTOM'}
        tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
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

  updateScrollbars = (delay = 0) => {
    setTimeout(this.infiniteScroll?.updateScrollbars, delay)
  }

  hasMoreNotifications = () => {
    return !this.state.isFetching && this.state.pagination?.total_items > this.state.notificationList?.length
  }
  handleDeleteNotificationsResponse = () => {
    this.props.onChange(this.state.notificationList)
    this.props.onSuccessCallback(this.DELETE_NOTIFICATIONS_SUCCESSFULL_MESSAGE)
  }
  deleteSelectedNotification = () => {
    // Read the selection before onDeleteMultipleNotificationsClick clears it
    const notificationList = this.state.selectedNotifications
    this.onDeleteMultipleNotificationsClick()
    deleteMultipleNotifications({
      ...getAuthentication(this.props.authentication),
      notificationList,
    })
      .then(() => this.handleDeleteNotificationsResponse())
      .catch((error) => this.props.onErrorCallback(error))
      .finally(this.onDeleteEnd)
  }

  deleteAllNotifications = () => {
    this.props.onConfirmCallback()
    this.onDeleteAllClick()
    deleteAllNotifications({ ...getAuthentication(this.props.authentication), projectId: this.props.selectedProjectId })
      .then(() => this.handleDeleteNotificationsResponse())
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
      })
      .finally(this.onDeleteEnd)
  }
  render = () => {
    const notificationListContainerClass = classNames('react-autoql-notification-list-container', {
      desktop: !this.props.isMobile,
      mobile: this.props.isMobile,
      landscape: this.props.isMobileLandscape,
    })

    let style = {}
    if (!this.props.shouldRender) {
      style.visibility = 'hidden'
      style.opacity = '0'
    }

    if (this.state.isFetchingFirstNotifications) {
      return (
        <div style={style} className='notification-feed-skeleton-container' data-test='notification-list'>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className='notification-feed-skeleton-item'>
              <div className='notification-feed-skeleton-strip' />
              <div className='notification-feed-skeleton-content'>
                <div className='notification-feed-skeleton-block title' />
                <div className='notification-feed-skeleton-block description' />
                <div className='notification-feed-skeleton-block timestamp' />
              </div>
            </div>
          ))}
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
          className={notificationListContainerClass}
          data-test='notification-list'
        >
          {!this.props.tooltipID && <Tooltip tooltipId={this.TOOLTIP_ID} delayShow={500} />}
          {!this.props.chartTooltipID && <Tooltip tooltipId={this.CHART_TOOLTIP_ID} delayShow={0} />}
          {this.state.notificationList?.length ? (
            <>
              {this.renderTopOptions()}
              {this.renderSelectAllBanner()}
              <InfiniteScroll
                ref={(r) => (this.infiniteScroll = r)}
                pageStart={0}
                useWindow={false}
                initialLoad={false}
                loadMore={this.getNotifications}
                hasMore={this.hasMoreNotifications()}
              >
                <div className='notification-feed-list'>
                  {this.state.notificationList.map((notification, i) => {
                    const dataAlert = this.state.dataAlerts?.find(
                      (alert) => alert.id === notification.payload?.data_alert_id,
                    )
                    return (
                      <div
                        className={`notification-item-container ${
                          this.state.displayNotificationItemCheckbox ? 'selecting' : ''
                        } ${this.state.selectedNotifications.includes(notification.id) ? 'selected' : ''}`}
                        key={i}
                        onClick={
                          this.state.displayNotificationItemCheckbox
                            ? (e) => this.onNotificationItemClick(notification, e)
                            : undefined
                        }
                      >
                        {this.state.displayNotificationItemCheckbox &&
                          this.renderNotificationItemCheckbox(notification)}
                        <NotificationItem
                          isSelecting={this.state.displayNotificationItemCheckbox}
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
                          enableSettingsMenu={this.props.enableSettingsMenu}
                          enableNotificationsMenu={this.props.enableNotificationsMenu}
                          displayProjectName={this.props.displayProjectName}
                          expanded={!!notification.expanded}
                          onDismissCallback={this.onDismissClick}
                          onUnreadCallback={this.onUnreadClick}
                          onQueryClick={this.props.onQueryClick}
                          popoverParentElement={this.props.popoverParentElement}
                          onDismissSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          onDeleteClick={this.onDeleteClick}
                          onDeleteEnd={this.onDeleteEnd}
                          onDeleteSuccessCallback={() => {
                            this.props.onChange(this.state.notificationList)
                          }}
                          enableCyclicalDates={this.props.enableCyclicalDates}
                          onExpandCallback={this.onNotificationExpand}
                          onCollapseCallback={this.onNotificationCollapse}
                          autoChartAggregations={this.props.autoChartAggregations}
                          onErrorCallback={this.props.onErrorCallback}
                          onSuccessCallback={this.props.onSuccessCallback}
                          onDataAlertChange={this.props.onDataAlertChange}
                          onEditClick={(dataAlert) => {
                            this.showEditDataAlertModal(dataAlert)
                          }}
                          isResizing={this.props.isResizing}
                          updateScrollbars={this.updateScrollbars}
                          tooltipID={this.props.tooltipID ?? this.TOOLTIP_ID}
                          chartTooltipID={this.props.chartTooltipID ?? this.CHART_TOOLTIP_ID}
                          enableFilterBtn={this.props.enableFilterBtn}
                          enableCustomColumns={this.props.enableCustomColumns}
                          enableMagicWand={this.props.enableMagicWand}
                          showMagicWandQuoteButton={this.props.showMagicWandQuoteButton}
                          enableBillingGate={this.props.enableBillingGate}
                          onQuotaExceeded={this.props.onQuotaExceeded}
                          valueActionCallbacks={this.props.valueActionCallbacks}
                        />
                      </div>
                    )
                  })}
                  {this.state.isFetching && (
                    <div className='react-autoql-spinner-centered'>
                      <Spinner />
                    </div>
                  )}
                </div>
              </InfiniteScroll>
            </>
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
