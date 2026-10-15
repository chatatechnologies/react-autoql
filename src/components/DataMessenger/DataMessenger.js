import React from 'react'
import PropTypes from 'prop-types'
import Drawer from 'rc-drawer'
import _isEmpty from 'lodash.isempty'
import { v4 as uuid } from 'uuid'
import { isBrowser, isMobile } from 'react-device-detect'
import {
  mergeSources,
  autoQLConfigDefault,
  dataFormattingDefault,
  getAutoQLConfig,
  CustomColumnTypes,
  normalizeString,
} from 'autoql-fe-utils'
import classNames from 'classnames'
// Components
import { Icon } from '../Icon'
import { ExploreQueries } from '../ExploreQueries'
import { DataExplorer } from '../DataExplorer'
import { NotificationIcon } from '../Notifications/NotificationIcon'
import { NotificationFeed } from '../Notifications/NotificationFeed'
import { ChatContent } from '../ChatContent'
import { ConfirmPopover } from '../ConfirmPopover'
import { AgentMessenger } from '../AgentMessenger'
import { Tooltip } from '../Tooltip'
import { Select } from '../Select'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

// Utils
import { withTheme } from '../../theme'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import { lang, setLanguage } from '../../js/Localization'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'

export class DataMessenger extends React.Component {
  constructor(props) {
    super(props)

    this.minWidth = 400
    this.minHeight = 400

    this.COMPONENT_KEY = uuid()
    this.HEADER_THICKNESS = 70
    this.SOURCE = mergeSources(props.source, 'data_messenger')
    this.TOOLTIP_ID = `react-autoql-data-messenger-tooltip-${this.COMPONENT_KEY}`
    this.CHART_TOOLTIP_ID = `react-autoql-dm-chart-tooltip-${this.COMPONENT_KEY}`

    // The header's clear-conversation trigger: a quiet text button, sized for a
    // thumb on mobile.
    this.popoverDeleteButtonClass = classNames({
      mobile: isMobile,
      'popover-delete-button': true,
    })

    // The one thing worth adding to the empty state beyond "ask a question": where to
    // look when you don't know what there is to ask about. Only offered when the tab
    // exists — Quick Topics stays out of it, since the input already shows them.
    this.dataExplorerEmptyStateSubtitle = (
      <span>
        Ask about your data in plain language, or use{' '}
        <span className='empty-state-de-link' onClick={this.openDataExplorer}>
          <Icon type='data-search' /> {lang.dataExplorer}
        </span>{' '}
        to discover what's available to you.
      </span>
    )

    this.dprEmptyStateSubtitle = (
      <span>
        Get helpful information about trading and investing, simply by asking a question in your own words. Results are
        returned from content on{' '}
        <a href='https://www.investopedia.com/' target='_blank' rel='noopener noreferrer'>
          Investopedia®
        </a>
        , including applicable reference links.
      </span>
    )

    if (props.enableAjaxTableData !== undefined) {
      console.warn(
        'enableAjaxtableData is deprecated - the provided prop will be ignored and the default value of "true" will be used instead.',
      )
    }

    this.state = {
      dataMessengerId: uuid(),
      // The Data Agent's own remount key. Its threads hold live backend sessions,
      // so they have to be dropped when the conversation is cleared or the project
      // changes underneath them - see clearMessages and componentDidUpdate.
      agentMessengerId: uuid(),
      hasError: false,
      activePage: props.defaultTab,
      width: isBrowser ? props.width : '100vw',
      height: props.height,
      isResizing: false,
      isWindowResizing: false,
      placement: this.getPlacementProp(props.placement),
      isOptionsDropdownOpen: false,
      selectedValueLabel: undefined,
      isSizeMaximum: false,
      // Whether the pointer is close to the drawer's outer edge while maximized,
      // which is what reveals the restore pill there.
      isNearRestoreEdge: false,
      // Whether the thread on screen has anything to clear. Reported by
      // ChatContent (per visible session tab), and all the header's
      // "Clear conversation" button goes on.
      hasClearableMessages: { 'data-messenger': false, dpr: false },
      // The lock itself lives in ChatContent now (see openFilterLockMenu), but
      // integrators read `dataMessengerRef.current.state.hasFilters` to drive
      // their own lock affordances, so it is mirrored back up here.
      hasFilters: false,
    }
  }

  static propTypes = {
    // Global
    /** Credentials for the AutoQL API. All three fields are required: `domain` is the API URL, `apiKey` identifies your integration, and `token` is the signed-in user's JWT. */
    authentication: authenticationType,
    /** Turns AutoQL features on or off, such as autocomplete, drilldowns and CSV download. Each field has its own default, so pass only what you want to change. */
    autoQLConfig: autoQLConfigType,
    /** How numbers, currency and dates are shown, such as the currency code, locale and number of decimals. Each field has its own default. */
    dataFormatting: dataFormattingType,

    // UI
    /** Which edge of the screen the drawer opens from: `'right'`, `'left'`, `'top'` or `'bottom'`. */
    placement: PropTypes.string,
    /** @internal Has no effect: the drawer always closes when the backdrop is clicked. */
    maskClosable: PropTypes.bool,
    /** Width of the drawer in pixels or as a CSS value, used when it opens from the left or right. On phones the drawer is always full width. Only read when the component mounts. */
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Height of the drawer in pixels or as a CSS value, used when it opens from the top or bottom. Only read when the component mounts. */
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Shows the floating button on the edge of the screen that opens the drawer. If you hide it, open the drawer yourself with `defaultOpen` or the `openDataMessenger()` method. */
    showHandle: PropTypes.bool,
    /** @internal */
    handleImage: PropTypes.string,
    /** Inline styles for the floating button that opens the drawer. */
    handleStyles: PropTypes.shape({}),
    /** Pushes the rest of the page aside when the drawer opens, instead of covering it. */
    shiftScreen: PropTypes.bool,
    /** @internal Has no effect: never read. */
    userDisplayName: PropTypes.string,
    /** Clears the conversation each time the drawer is closed. */
    clearOnClose: PropTypes.bool,
    /** Shows a microphone button so users can speak their question. Not shown on phones. */
    enableVoiceRecord: PropTypes.bool,
    /** @internal */
    title: PropTypes.string,
    /** The most messages kept in the conversation. Older messages are removed from the top. */
    maxMessages: PropTypes.number,
    /**
     * @internal
     * How much answer data is held in memory at once. Once an answer has been pushed
     * back past `keepHydratedMessages` other answers, its rows are dropped to a preview
     * and fetched again on request, so the history can be long without the data behind
     * it growing without bound. Answers smaller than `truncateMinRows` are left alone,
     * since fetching them again would cost more than holding them. Both are forwarded
     * to ChatContent, which holds the defaults.
     */
    keepHydratedMessages: PropTypes.number,
    /** @internal */
    truncateMinRows: PropTypes.number,
    /** Headline shown while the conversation is empty. Defaults to "What would you like to know?". */
    emptyStateTitle: PropTypes.node,
    /** Line shown under the empty-state headline. Defaults to "Ask about your data in plain language.", with a link to Data Explorer when `enableDataExplorerTab` is on. */
    emptyStateSubtitle: PropTypes.node,
    /** Adds a Data Explorer page, where users browse the topics and sample questions available to them. */
    enableDataExplorerTab: PropTypes.bool,
    /**
     * @internal
     * Deprecated: superseded by Data Explorer. Off by default; only enable it for
     * integrations that haven't migrated yet.
     */
    enableExploreQueriesTab: PropTypes.bool,
    /** Adds a Notifications page listing the user's data alert notifications. The header button for it also needs `autoQLConfig.enableNotifications`. */
    enableNotificationsTab: PropTypes.bool,
    /** @internal */
    resizable: PropTypes.bool,
    /** Placeholder text in the question box. Defaults to "Start a new query...". */
    inputPlaceholder: PropTypes.string,
    /** @internal */
    enableDPRTab: PropTypes.bool,
    /**
     * @internal
     * Session-based agent page. defaultTab accepts 'agent' when this is enabled, and
     * openDataMessenger('agent') deep-links to it (including on mobile, where the tab
     * rail isn't rendered).
     */
    enableAgentTab: PropTypes.bool,
    /** @internal */
    agentInputPlaceholder: PropTypes.string,
    /** @internal */
    agentSuggestions: PropTypes.arrayOf(PropTypes.string),
    /** @internal */
    agentModels: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string })),
    /** @internal */
    agentModelsEndpoint: PropTypes.string,
    /** @internal */
    agentDefaultModelId: PropTypes.string,
    /** @internal Development only: renders captured session payloads instead of calling the API. */
    agentMockResponses: PropTypes.bool,
    /** @internal Shows the session id above each thread so it can be copied into a bug report. */
    agentDebug: PropTypes.bool,
    /** @internal */
    dataPageSize: PropTypes.number,
    /** @internal */
    notificationCount: PropTypes.number,
    /** Opens the drawer as soon as the component mounts. */
    defaultOpen: PropTypes.bool,
    /** @internal */
    popoverParentElement: PropTypes.element,

    /** @internal */
    enableDynamicCharting: PropTypes.bool,
    /** The page shown when the drawer first opens: `'data-messenger'` (the chat), `'data-explorer'` or `'notifications'`. The matching page must be turned on. Only read when the component mounts. */
    defaultTab: PropTypes.string,
    /** Shows grouped results, such as totals by month or by category, as a chart instead of a table. */
    autoChartAggregations: PropTypes.bool,
    /** @internal Has no effect here. The filter lock is turned on with autoQLConfig.enableFilterLocking. */
    enableFilterLocking: PropTypes.bool,
    /** @internal Has no effect: never read. */
    enableQueryQuickStartTopics: PropTypes.bool,
    /** @internal */
    enableQueryInputTopics: PropTypes.bool,
    /** When a question can't be answered, shows a list of related questions the user can pick from instead of an error. Also adds suggestions to Data Explorer. */
    enableQuerySuggestions: PropTypes.bool,
    /** @internal */
    disableColumnSelectionForDataExplorer: PropTypes.bool,
    /** @internal */
    enableMagicWand: PropTypes.bool,
    /** @internal */
    showMagicWandQuoteButton: PropTypes.bool,
    /** @internal */
    enableBillingGate: PropTypes.bool,
    /** @internal */
    onQuotaExceeded: PropTypes.func,
    /** Adds cyclical date groupings to charts, such as month of year, day of week and hour of day. */
    enableCyclicalDates: PropTypes.bool,
    /** @internal */
    enableFollowOnQuery: PropTypes.bool,
    /**
     * Splits the chat into tabs, one per conversation. Users add a tab with the + button (up to 8) and close
     * tabs with ×. Each tab keeps its own answers, and the questions asked in a tab are sent with that tab's
     * session ID. The header's clear-conversation button is hidden while tabs are on.
     */
    enableSessions: PropTypes.bool,

    // Projects
    /** @internal */
    projectSelectList: PropTypes.arrayOf(
      PropTypes.shape({
        projectId: PropTypes.string.isRequired,
        displayName: PropTypes.string.isRequired,
      }),
    ),
    /** @internal */
    selectedProjectId: PropTypes.string,

    // Callbacks
    /** @internal */
    onNotificationExpandCallback: PropTypes.func,
    /** Called with the number of unread notifications when it changes. Checked every 90 seconds while the Notifications button is shown. */
    onNewNotification: PropTypes.func,
    /** @internal */
    onNotificationCount: PropTypes.func,
    /** @internal Has no effect: never called. */
    onVisibleChange: PropTypes.func,
    /** Called when something goes wrong, so you can show your own message. Receives either a message string or an Error object. */
    onErrorCallback: PropTypes.func,
    /** Called with a confirmation message after an action succeeds, such as copying a table or creating a data alert, so you can show your own message. */
    onSuccessAlert: PropTypes.func,
    /** @internal */
    setMobileActivePage: PropTypes.func,
    /** @internal */
    onProjectSelectChange: PropTypes.func,
    /** @internal */
    onCreateQueryEvaluationItem: PropTypes.func,
    /** @internal */
    queryItemActionName: PropTypes.string,
    /** @internal */
    mobileActivePage: PropTypes.string,
    /** @internal Has no effect: has a default value but is never read. */
    isVisible: PropTypes.bool,
  }

  static defaultProps = {
    // Global
    authentication: {},
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    // UI
    placement: 'right',
    maskClosable: true,
    isVisible: true,
    width: 800,
    height: 350,
    showHandle: true,
    handleImage: undefined,
    handleStyles: undefined,
    shiftScreen: false,
    userDisplayName: 'there',
    clearOnClose: false,
    enableVoiceRecord: true,
    title: 'Data Messenger',
    // Raised from 20 now that the data behind older answers is dropped to a preview
    // once they fall out of the recent history (see ChatContent's keepHydratedMessages).
    // What a message costs to keep no longer scales with the size of its result, so the
    // limit can be about how far back it is useful to scroll instead.
    maxMessages: 50,
    emptyStateTitle: undefined,
    emptyStateSubtitle: undefined,
    enableDataExplorerTab: false,
    enableExploreQueriesTab: false,
    enableNotificationsTab: false,
    resizable: true,
    inputPlaceholder: undefined,
    dataPageSize: undefined,
    notificationCount: undefined,
    defaultOpen: false,
    popoverParentElement: undefined,
    enableCyclicalDates: false,

    // Projects
    projectSelectList: undefined,
    selectedProjectId: undefined,

    enableDynamicCharting: true,
    defaultTab: 'data-messenger',
    autoChartAggregations: true,
    enableFilterLocking: false,
    enableQueryQuickStartTopics: true,
    enableQueryInputTopics: true,
    enableQuerySuggestions: false,
    enableDPRTab: false,
    enableAgentTab: false,
    agentInputPlaceholder: undefined,
    agentSuggestions: undefined,
    agentModels: undefined,
    agentModelsEndpoint: undefined,
    agentDefaultModelId: undefined,
    agentMockResponses: false,
    agentDebug: false,
    mobileActivePage: 'data-messenger',
    disableColumnSelectionForDataExplorer: false,
    enableMagicWand: false,
    showMagicWandQuoteButton: false,
    enableBillingGate: false,
    onQuotaExceeded: undefined,
    enableFollowOnQuery: false,
    enableSessions: false,
    setMobileActivePage: () => {},
    // Callbacks
    onNotificationExpandCallback: () => {},
    onNewNotification: () => {},
    onNotificationCount: () => {},
    onVisibleChange: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
    onProjectSelectChange: () => {},
    onCreateQueryEvaluationItem: undefined,
    queryItemActionName: 'Add Query Evaluation Item',
  }

  componentDidMount = () => {
    this._isMounted = true

    try {
      window.addEventListener('resize', this.onWindowResize)
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }

    if (this.props.defaultOpen && !this.isOpen()) {
      this.openDataMessenger()
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      const nextState = {}

      if (this.props.placement !== prevProps.placement) {
        nextState.placement = this.getPlacementProp(this.props.placement)
      }
      if (this.state.isSizeMaximum !== prevState.isSizeMaximum) {
        this.forceUpdate()
      }

      if (
        typeof this.props.notificationCount === CustomColumnTypes.NUMBER &&
        this.props.notificationCount !== prevProps.notificationCount
      ) {
        this.refreshNotifications()
      }

      if (!this.state.isVisible && prevState.isVisible && this.props.clearOnClose) {
        this.setState({ dataMessengerId: uuid() })
      }

      // A project switch only calls clearMessages() for the page being looked at,
      // but an agent thread left over from the old project would resume its
      // session_id against the new project's credentials. So the agent is reset on
      // the change itself, whichever page is showing.
      if (this.props.selectedProjectId !== prevProps.selectedProjectId) {
        nextState.agentMessengerId = uuid()
      }

      if (this.state.activePage !== prevState.activePage) {
        nextState.selectedValueLabel = undefined
      }

      if (!_isEmpty(nextState)) {
        this.setState({
          ...nextState,
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }
  }

  componentWillUnmount() {
    try {
      this._isMounted = false
      window.removeEventListener('resize', this.onWindowResize)
      this.stopResizingDrawer()

      clearTimeout(this.windowResizeTimer)
      clearTimeout(this.executeQueryTimeout)
    } catch (error) {}
  }
  onError = () => this.props.onErrorCallback('Something went wrong when creating this notification. Please try again.')

  onSave = () => {
    this.props.onSuccessAlert('Notification created!')
    this.setState({ isDataAlertModalVisible: false })
  }

  onClose = () => {
    this.setState({ isDataAlertModalVisible: false })
  }

  refreshNotifications = () => {
    this.notificationListRef?.refreshNotifications('dm')
  }

  // The drawer used to leave a sliver of the page uncovered for the old side
  // tabs. Those are gone, so maximizing now takes the full viewport.
  getMaxWidthAndHeightFromDocument = () => {
    const maxWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    const maxHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    return { maxWidth, maxHeight }
  }

  onWindowResize = () => {
    if (!this.state.isWindowResizing) {
      this.setState({
        isWindowResizing: true,
      })
    }

    clearTimeout(this.windowResizeTimer)
    this.windowResizeTimer = setTimeout(() => {
      this.setState({
        isWindowResizing: false,
      })
    }, 300)
  }

  openDataMessenger = (tab) => {
    if (isMobile) {
      if (this.state.isVisible) {
        this.setState({ activePage: tab })
        return
      }
    }

    if (tab) {
      this.setState({ activePage: tab })
    } else if (isMobile && this.props.mobileActivePage === 'data-messenger') {
      this.setState({ activePage: 'data-messenger' })
    }

    if (!this.isOpen()) {
      this.dmRef.setState({ open: true })
    }
  }

  closeDataMessenger = () => {
    this.dmRef.setState({ open: false })
    this.setState({ isVisible: false })
  }

  openExploreQueries = (topic) => {
    this.setState({ activePage: 'explore-queries' }, () => {
      if (topic && this.exploreQueriesRef?.animateQITextAndSubmit) {
        this.exploreQueriesRef?.animateQITextAndSubmit(topic)
      }
    })
  }

  openDataExplorer = (topic) => {
    if (isMobile) {
      this.props.setMobileActivePage('data-explorer')
    }
    this.setState({ activePage: 'data-explorer' }, () => {
      if (topic && this.dataExplorerRef?.animateDETextAndSubmit) {
        this.dataExplorerRef?.animateDETextAndSubmit(topic)
      }
    })
  }

  openNotificationFeed = () => {
    if (isMobile) {
      this.props.setMobileActivePage('notification-feed')
    }
    if (this.notificationBadgeRef) {
      this.notificationBadgeRef.resetCount()
    }
    this.setState({ activePage: 'notifications' })
  }

  // The drawer can end up filling the viewport without having been maximized -
  // shrinking the window below the drawer's size makes `getDrawerWidth/Height`
  // clamp it to the edge. That reads as maximized to the user, so the controls
  // have to treat it as maximized too.
  isEffectivelyMaximized = () => {
    if (this.state.isSizeMaximum) {
      return true
    }

    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()
    const placement = this.state.placement

    if (placement === 'top' || placement === 'bottom') {
      return this.state.height >= maxHeight
    }

    return this.state.width >= maxWidth
  }

  // Restoring goes back to the size the drawer had before maximizing, falling
  // back to the configured width/height. Either one can still be as large as
  // the viewport (a shrunken window, or a configured size bigger than the
  // screen), so the result is clamped down to leave the drawer visibly smaller
  // than the window - otherwise "restore" would appear to do nothing.
  getRestoreSize = (preMaximizeSize, propSize, maxSize, minSize) => {
    const size = preMaximizeSize ?? propSize

    // Non-numeric sizes ('80vw', '500px') can't be compared to the viewport, so
    // they're passed through untouched
    if (!Number(size) || size < maxSize) {
      return size
    }

    return Math.max(Math.min(Math.round(maxSize * 0.75), maxSize - 50), Math.min(minSize, maxSize))
  }

  // `isSizeMaximum` is the source of truth for the maximized state - comparing
  // the stored width against the viewport breaks as soon as the window is
  // resized - but the drawer can also be pinned to the viewport edge without it
  // (see `isEffectivelyMaximized`), which restores the same way.
  toggleFullScreen = (isFullScreen, maxWidth, maxHeight) => {
    const nextState = isFullScreen
      ? {
          width: this.getRestoreSize(this.state.preMaximizeWidth, this.props.width, maxWidth, this.minWidth),
          height: this.getRestoreSize(this.state.preMaximizeHeight, this.props.height, maxHeight, this.minHeight),
          isSizeMaximum: false,
        }
      : {
          preMaximizeWidth: this.state.width,
          preMaximizeHeight: this.state.height,
          width: maxWidth,
          height: maxHeight,
          isSizeMaximum: true,
        }

    this.setState({ ...nextState, isResizing: true }, () => {
      this.setState({ isResizing: false })
    })
  }

  getHandleProp = () => {
    if (this.props.customHandle !== undefined) {
      return this.props.customHandle
    } else if (this.props.showHandle) {
      return (
        <div
          ref={(r) => (this.drawerHandle = r)}
          className={`drawer-handle
            ${this.state.isVisible ? ' hide' : ''}
            ${this.props.handleImage ? '' : ' default-logo'}`}
          style={this.props.handleStyles}
          data-test='data-messenger-handle'
        >
          {this.props.handleImage ? (
            <img src={this.props.handleImage} height='22px' width='22px' draggable='false' />
          ) : (
            // The product mark, matching the drawer's own header - the bubbles
            // were a second, unrelated logo for the same thing.
            <Icon type='react-autoql-logo' size={24} />
          )}
        </div>
      )
    }
    return false
  }

  getDrawerHeight = () => {
    if (this.state.placement === 'right' || this.state.placement === 'left') {
      return isMobile ? 'calc(100% - 50px)' : '100vh'
    }

    const { maxHeight } = this.getMaxWidthAndHeightFromDocument()

    if (this.state.isSizeMaximum || this.state.height > maxHeight) {
      return maxHeight
    }

    return this.state.height
  }

  getDrawerWidth = () => {
    if (this.state.placement === 'top' || this.state.placement === 'bottom') {
      return '100vw'
    }

    const { maxWidth } = this.getMaxWidthAndHeightFromDocument()

    if (this.state.isSizeMaximum || this.state.width > maxWidth) {
      return maxWidth
    }

    return this.state.width
  }

  getPlacementProp = () => {
    const { placement } = this.props
    let formattedPlacement
    if (typeof placement === 'string') {
      formattedPlacement = normalizeString(placement)
      if (
        formattedPlacement === 'right' ||
        formattedPlacement === 'left' ||
        formattedPlacement === 'bottom' ||
        formattedPlacement === 'top'
      ) {
        return formattedPlacement
      }
    }
    return 'right'
  }

  onDrawerChange = (isOpen) => {
    if (!isOpen) {
      this.setState({
        selectedValueLabel: undefined,
        isVisible: false,
      })
    } else {
      this.setState({ isVisible: true })
    }
  }

  onTopicClick = (...params) => {
    this.dataMessengerContentRef?.animateInputTextAndSubmit(...params)
  }

  getCustomToolbarOptions = () => {
    const customToolbarOptions = [...(this.props.customToolbarOptions || [])]
    if (!this.props.onCreateQueryEvaluationItem) {
      return customToolbarOptions
    }

    return [
      ...customToolbarOptions,
      {
        name: this.props.queryItemActionName || 'Add Query Evaluation Item',
        icon: 'plus',
        callback: async (queryToolbarPayload) => {
          try {
            await this.props.onCreateQueryEvaluationItem(queryToolbarPayload)
            this.props.onSuccessAlert?.(`${this.props.queryItemActionName || 'Add Query Evaluation Item'} succeeded.`)
          } catch (error) {
            console.error(error)
            this.props.onErrorCallback?.(
              error?.response?.data?.data || error?.message || 'Failed to create Query Evaluation Item.',
            )
          }
        },
      },
    ]
  }

  handleClearQueriesDropdown = () => {
    if (!this.clearQueriesDropdown) {
      return
    }

    if (this.clearQueriesDropdown.style.display === 'block') {
      this.clearQueriesDropdown.style.display = 'none'
    } else {
      this.clearQueriesDropdown.style.display = 'block'
    }
  }

  clearMessages = () => {
    if (this.state.activePage === 'data-messenger') {
      this.dataMessengerContentRef?.clearMessages()
    } else if (this.state.activePage === 'dpr') {
      this.dprMessengerContentRef?.clearMessages()
    } else if (this.state.activePage === 'agent') {
      // The agent has no clearMessages of its own to call: a thread is a live
      // backend session, so clearing it means starting over with fresh ones -
      // hence the remount. Without this branch the header's clear, the project
      // select and a consumer's dataMessengerRef.current.clearMessages() all did
      // nothing at all on this page.
      this.setState({ agentMessengerId: uuid() })
    }
    this.setState({ isOptionsDropdownOpen: false })
  }

  // The page switcher lives inline in the header as a row of icon buttons rather than on a
  // rail outside the drawer, so the drawer's left edge belongs entirely to the resize handle.
  renderHeaderNav = () => {
    const enableNotifications =
      this.props.enableNotificationsTab && getAutoQLConfig(this.props.autoQLConfig).enableNotifications

    if (
      !this.props.enableExploreQueriesTab &&
      !enableNotifications &&
      !this.props.enableDPRTab &&
      !this.props.enableDataExplorerTab &&
      !this.props.enableAgentTab
    ) {
      return null
    }

    const page = this.state.activePage
    const navBtnClass = (forPage) => `react-autoql-header-nav-btn${page === forPage ? ' active' : ''}`

    return (
      <>
        <span className='react-autoql-header-divider' />
        <div className='react-autoql-header-nav'>
          <button
            className={navBtnClass('data-messenger')}
            onClick={() => this.setState({ activePage: 'data-messenger' })}
            data-tooltip-content='Home'
            data-tooltip-id={this.TOOLTIP_ID}
          >
            <Icon type='react-autoql-bubbles-outlined' />
          </button>
          {this.props.enableDataExplorerTab && (
            <button
              className={`${navBtnClass('data-explorer')} react-autoql-data-explorer`}
              onClick={() => this.setState({ activePage: 'data-explorer' })}
              data-tooltip-content={lang.dataExplorer}
              data-tooltip-id={this.TOOLTIP_ID}
            >
              <Icon type='data-search' />
            </button>
          )}
          {/* Deprecated — Data Explorer replaces this page. */}
          {this.props.enableExploreQueriesTab && (
            <button
              className={`${navBtnClass('explore-queries')} react-autoql-explore-queries`}
              onClick={() => this.setState({ activePage: 'explore-queries' })}
              data-tooltip-content={lang.exploreQueries}
              data-tooltip-id={this.TOOLTIP_ID}
            >
              <Icon type='light-bulb' />
            </button>
          )}
          {enableNotifications && (
            <button
              className={`${navBtnClass('notifications')} react-autoql-notifications`}
              onClick={() => {
                if (this.notificationBadgeRef) {
                  this.notificationBadgeRef.resetCount()
                }
                this.setState({ activePage: 'notifications' })
              }}
              data-tooltip-content='Notifications'
              data-tooltip-id={this.TOOLTIP_ID}
            >
              <div className='data-messenger-notification-btn'>
                <NotificationIcon
                  ref={(r) => (this.notificationBadgeRef = r)}
                  authentication={this.props.authentication}
                  clearCountOnClick={false}
                  overflowCount={9}
                  count={this.props.notificationCount}
                  useDot
                  onCount={this.props.onNotificationCount}
                  onErrorCallback={this.props.onErrorCallback}
                  onNewNotification={(count) => {
                    this.props.onNewNotification(count)
                  }}
                />
              </div>
            </button>
          )}
          {this.props.enableAgentTab && (
            <button
              className={`${navBtnClass('agent')} react-autoql-agent`}
              data-test='data-messenger-agent-tab'
              onClick={() => this.setState({ activePage: 'agent' })}
              data-tooltip-content={lang.agent}
              data-tooltip-id={this.TOOLTIP_ID}
            >
              <Icon type='sparkles' />
            </button>
          )}
          {this.props.enableDPRTab && (
            <button
              className={`${navBtnClass('dpr')} react-autoql-dpr`}
              onClick={() => this.setState({ activePage: 'dpr' })}
              data-tooltip-content='Education'
              data-tooltip-id={this.TOOLTIP_ID}
            >
              <Icon type='grad-cap' />
            </button>
          )}
        </div>
      </>
    )
  }

  // The filter lock moved into ChatContent (it sits at the head of the query
  // input now rather than in this header), but these stay part of this
  // component's public surface: hosts drive the lock through the Data Messenger
  // ref - opening it from their own mobile chrome, and reading `hasFilters` to
  // badge their lock button.
  openFilterLockMenu = () => {
    this.dataMessengerContentRef?.openFilterLockMenu()
  }

  closeFilterLockMenu = () => {
    this.dataMessengerContentRef?.closeFilterLockMenu()
  }

  onFilterLockChange = (filters) => {
    const hasFilters = !!filters?.length
    if (hasFilters !== this.state.hasFilters) {
      this.setState({ hasFilters })
    }
  }

  setHasClearableMessages = (page, hasContent) => {
    this.setState((state) => {
      if (state.hasClearableMessages[page] === hasContent) {
        return null
      }

      return { hasClearableMessages: { ...state.hasClearableMessages, [page]: hasContent } }
    })
  }

  // Clearing lives in the header rather than over the thread: it's always in the
  // same place, it costs the conversation no room, and clearMessages sends it to
  // the page you're actually looking at. Only rendered once there is something to
  // clear, and only on a page where closing the thread is otherwise impossible:
  // with sessions on, the chat's tab bar already closes a thread (and the Data
  // Agent's always does), so a second way to do the same thing just crowds the
  // header. The DPR tab never gets a tab bar (see renderDPRContent), so it keeps
  // the button even with sessions enabled. The filter lock moved out of the
  // header the other way: it scopes the next query, so it belongs at the head of
  // the input rather than beside the window controls (see
  // renderDataMessengerContent).
  renderRightHeaderContent = () => {
    const { activePage } = this.state

    if (!this.state.hasClearableMessages[activePage]) {
      return null
    }

    if (activePage === 'agent' || (activePage === 'data-messenger' && this.props.enableSessions)) {
      return null
    }

    return (
      <ConfirmPopover
        className='react-autoql-drawer-header-btn clear-all'
        popoverParentElement={this.messengerDrawerRef}
        title={lang.clearDataResponses}
        onConfirm={this.clearMessages}
        confirmText='Clear'
        backText='Cancel'
        positions={['bottom', 'left', 'top', 'right']}
        align='end'
      >
        <button
          data-tooltip-content={lang.clearQueriesTooltip}
          data-tooltip-id={this.TOOLTIP_ID}
          className={this.popoverDeleteButtonClass}
        >
          Clear conversation
        </button>
      </ConfirmPopover>
    )
  }

  projectSelectorHeader = () => {
    return (
      <div className='react-autoql-header-project-selector-container'>
        <Select
          className='react-autoql-header-project-selector'
          size='small'
          outlined={false}
          fullWidth={true}
          placeholder='Select a new project'
          options={this.props.projectSelectList.map((project) => {
            return {
              value: project?.projectId,
              label: <span dangerouslySetInnerHTML={{ __html: project.displayName }} />,
            }
          })}
          label={null}
          value={this.props.selectedProjectId}
          onChange={(option) => {
            this.clearMessages()
            this.props.onProjectSelectChange(option)
          }}
          color='text'
        />
      </div>
    )
  }

  renderHeaderTitle = () => {
    let title = ''

    if (this.props?.autoQLConfig?.enableProjectSelect && this.props?.projectSelectList?.length > 0) {
      return this.projectSelectorHeader()
    }

    switch (this.state.activePage) {
      case 'data-messenger': {
        title = this.props.title
        break
      }
      case 'explore-queries': {
        title = lang.exploreQueries
        break
      }
      case 'data-explorer': {
        title = lang.dataExplorer
        break
      }
      case 'notifications': {
        title = lang.notifications
        break
      }
      case 'dpr': {
        title = lang.education
        break
      }
      case 'agent': {
        title = lang.agent
        break
      }
    }

    return <div className='header-title'>{title}</div>
  }

  isOpen = () => {
    return !!this.dmRef?.state?.open
  }

  shouldRenderPage = (page) => {
    return this.state.activePage === page && this.isOpen()
  }

  // Whether the page occupies layout, independent of whether the drawer is open. The closed drawer is
  // hidden by its own transform/opacity, so the active page can stay laid out with real dimensions -
  // that is what lets Tabulator keep its measurements instead of remounting on every open.
  isActivePage = (page) => {
    return this.state.activePage === page
  }

  renderHeaderContent = () => {
    if (isMobile && this.state.activePage === 'data-explorer') {
      return null
    }
    return (
      <>
        <div className={`react-autoql-header-left-container ${isMobile ? 'mobile-hidden' : ''}`}>
          <Icon type='react-autoql-logo' className='react-autoql-header-logo' />
          {!isMobile && <div className='react-autoql-header-center-container'>{this.renderHeaderTitle()}</div>}
          {isBrowser ? this.renderHeaderNav() : null}
        </div>
        <div className={`react-autoql-header-right-container ${isMobile ? 'mobile-hidden' : ''}`}>
          {this.renderRightHeaderContent()}
          {isBrowser ? (
            <>
              {/* No full screen controls here: maximizing and restoring are both
                  pills on the drawer's outer edge (renderMaximizeHandle and
                  renderRestoreHandle). */}
              <button
                onClick={this.closeDataMessenger}
                className={'react-autoql-drawer-header-btn'}
                data-tooltip-content={lang.closeDataMessenger}
                data-tooltip-id={this.TOOLTIP_ID}
              >
                <Icon type='close' />
              </button>
            </>
          ) : null}
        </div>
      </>
    )
  }

  renderBodyContent = () => {
    return (
      <>
        {this.renderDataMessengerContent()}
        {this.renderExploreQueriesContent()}
        {this.renderDataExplorerContent()}
        {this.renderNotificationsContent()}
        {this.renderDPRContent()}
        {this.renderAgentContent()}
      </>
    )
  }

  renderAgentContent = () => {
    if (!this.props.enableAgentTab) {
      return null
    }

    return (
      <ErrorBoundary>
        <AgentMessenger
          data-test='data-messenger-agent-content'
          key={`${this.state.dataMessengerId}-${this.state.agentMessengerId}`}
          shouldRender={this.shouldRenderPage('agent')}
          isActivePage={this.isActivePage('agent')}
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          placeholder={this.props.agentInputPlaceholder}
          suggestions={this.props.agentSuggestions}
          models={this.props.agentModels}
          modelsEndpoint={this.props.agentModelsEndpoint}
          defaultModelId={this.props.agentDefaultModelId}
          enableMockResponses={this.props.agentMockResponses}
          debug={this.props.agentDebug}
          enableVoiceRecord={this.props.enableVoiceRecord}
          tooltipID={this.TOOLTIP_ID}
          onErrorCallback={this.props.onErrorCallback}
        />
      </ErrorBoundary>
    )
  }

  renderDataMessengerContent = () => {
    return (
      <ErrorBoundary>
        <ChatContent
          {...this.props}
          data-test='data-messenger-chat-content'
          shouldRender={this.shouldRenderPage('data-messenger')}
          isActivePage={this.isActivePage('data-messenger')}
          key={this.state.dataMessengerId}
          ref={(r) => (this.dataMessengerContentRef = r)}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          source={this.SOURCE}
          emptyStateSubtitle={
            this.props.emptyStateSubtitle ??
            (this.props.enableDataExplorerTab ? this.dataExplorerEmptyStateSubtitle : undefined)
          }
          inputPlaceholder={this.props.inputPlaceholder ?? lang.queryPrompt}
          autoChartAggregations={this.props.autoChartAggregations}
          executeQuery={(queryRequestParams) => {
            this.dataMessengerContentRef?.animateInputTextAndSubmit({
              ...queryRequestParams,
              source: ['query_suggestions'],
            })
          }}
          popoverParentElement={this.messengerDrawerRef}
          dataPageSize={this.props.dataPageSize}
          createDataAlertCallback={this.closeDataMessenger}
          tooltipID={this.TOOLTIP_ID}
          chartTooltipID={this.CHART_TOOLTIP_ID}
          scope={this.props.scope}
          customToolbarOptions={this.getCustomToolbarOptions()}
          enableCustomColumns={this.props.enableCustomColumns}
          disableAggregationMenu={this.props.disableAggregationMenu}
          allowCustomColumnsOnDrilldown={this.props.allowCustomColumnsOnDrilldown}
          enableQueryInputTopics={this.props.enableQueryInputTopics}
          enableQuerySuggestions={this.props.enableQuerySuggestions}
          // With sessions on, this ChatContent hosts the tab bar and one thread
          // per session. "Clear messages" and animateInputTextAndSubmit reach
          // the visible session through the same ref, so nothing here changes.
          enableSessions={this.props.enableSessions}
          onContentChange={(hasContent) => this.setHasClearableMessages('data-messenger', hasContent)}
          onFilterLockChange={this.onFilterLockChange}
        />
      </ErrorBoundary>
    )
  }

  renderDPRContent = () => {
    if (!this.props.enableDPRTab) {
      return null
    }

    return (
      <ErrorBoundary>
        <ChatContent
          {...this.props}
          shouldRender={this.shouldRenderPage('dpr')}
          isActivePage={this.isActivePage('dpr')}
          key={this.state.dataMessengerId}
          ref={(r) => (this.dprMessengerContentRef = r)}
          authentication={{
            dprKey: this.props.authentication?.dprKey,
            dprDomain: this.props.authentication?.dprDomain,
          }}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          source={this.SOURCE}
          emptyStateTitle='Ask questions, get answers.'
          emptyStateSubtitle={this.dprEmptyStateSubtitle}
          disableMaxMessageHeight={true}
          inputPlaceholder='Type your questions here'
          // Sessions are a Data Messenger chat feature — the DPR tab talks to a
          // different service and already has its own session id below, so keep
          // the tab bar out of it even when the integrator turns sessions on.
          enableSessions={false}
          // The DPR service has no related-queries endpoint behind it, so the
          // suggestion fallback never applies here regardless of the prop.
          enableQuerySuggestions={false}
          sessionId={this.COMPONENT_KEY}
          autoQLConfig={{
            enableAutocomplete: false,
            enableQueryValidation: false,
            enableQuerySuggestions: false,
            enableColumnVisibilityManager: false,
            enableQueryInterpretation: false,
            enableDrilldowns: false,
            enableReportProblem: false,
          }}
          createDataAlertCallback={this.closeDataMessenger}
          tooltipID={this.TOOLTIP_ID}
          preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
          onContentChange={(hasContent) => this.setHasClearableMessages('dpr', hasContent)}
        />
      </ErrorBoundary>
    )
  }

  renderDataExplorerContent = () => {
    if (!this.props.enableDataExplorerTab) {
      return null
    }

    return (
      <ErrorBoundary>
        <DataExplorer
          ref={(r) => (this.dataExplorerRef = r)}
          authentication={this.props.authentication}
          dataFormatting={this.props.dataFormatting}
          shouldRender={this.shouldRenderPage('data-explorer')}
          tooltipID={this.TOOLTIP_ID}
          scope={this.props.scope}
          enableQuerySuggestions={this.props.enableQuerySuggestions}
          disableColumnSelection={this.props.disableColumnSelectionForDataExplorer}
          executeQuery={(queryRequestParams) => {
            if (isMobile) {
              this.props.setMobileActivePage('data-messenger')
            }
            this.setState({ activePage: 'data-messenger' })
            clearTimeout(this.executeQueryTimeout)

            this.executeQueryTimeout = setTimeout(() => {
              this.dataMessengerContentRef?.animateInputTextAndSubmit({
                ...queryRequestParams,
                source: ['data_explorer'],
              })
            }, 500)
          }}
        />
      </ErrorBoundary>
    )
  }

  renderExploreQueriesContent = () => {
    if (!this.props.enableExploreQueriesTab) {
      return null
    }
    return (
      <ErrorBoundary>
        <ExploreQueries
          ref={(r) => (this.exploreQueriesRef = r)}
          authentication={this.props.authentication}
          shouldRender={this.shouldRenderPage('explore-queries')}
          tooltipID={this.TOOLTIP_ID}
          executeQuery={(query) => {
            this.setState({ activePage: 'data-messenger' })
            clearTimeout(this.executeQueryTimeout)
            this.executeQueryTimeout = setTimeout(() => {
              this.dataMessengerContentRef?.animateInputTextAndSubmit({
                query,
                source: ['explore_queries'],
              })
            }, 500)
          }}
        />
      </ErrorBoundary>
    )
  }

  onDataAlertModalOpen = () => {
    this.closeDataMessenger()
    this.shouldOpenDataMessengerFromDA = true
  }

  onDataAlertModalClose = () => {
    if (this.shouldOpenDataMessengerFromDA) {
      this.shouldOpenDataMessengerFromDA = false
      this.openDataMessenger()
    }
  }

  renderNotificationsContent = () => {
    if (!this.props.enableNotificationsTab) {
      return null
    }

    return (
      <ErrorBoundary>
        <NotificationFeed
          ref={(ref) => (this.notificationListRef = ref)}
          authentication={this.props.authentication}
          onExpandCallback={this.props.onNotificationExpandCallback}
          onCollapseCallback={this.props.onNotificationCollapseCallback}
          onErrorCallback={this.props.onErrorCallback}
          onSuccessCallback={this.props.onSuccessAlert}
          onModalOpen={this.onDataAlertModalOpen}
          onModalClose={this.onDataAlertModalClose}
          shouldRender={this.isOpen() && this.state.activePage === 'notifications'}
          tooltipID={this.TOOLTIP_ID}
          chartTooltipID={this.CHART_TOOLTIP_ID}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          popoverParentElement={this.props.popoverParentElement}
          enableCustomColumns={this.props.enableCustomColumns}
          enableCyclicalDates={this.props.enableCyclicalDates}
        />
      </ErrorBoundary>
    )
  }

  resizeDrawer = (e) => {
    // buttons===0 means mouseup fired outside the document; stop resizing so the listener doesn't run forever.
    if (e.buttons === 0) {
      this.stopResizingDrawer()
      return
    }

    this.latestResizePageX = e.pageX
    this.latestResizePageY = e.pageY

    if (this.resizeAnimationFrame) {
      return
    }

    this.resizeAnimationFrame = window.requestAnimationFrame(() => {
      this.resizeAnimationFrame = undefined
      this.performResizeDrawer(this.latestResizePageX, this.latestResizePageY)
    })
  }

  performResizeDrawer = (pageX, pageY) => {
    const { placement } = this.state
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()

    if (placement === 'right') {
      const offset = (this.state.startingResizePosition?.x ?? 0) - pageX
      let newWidth = (this.state.startingResizePosition?.width ?? 0) + offset
      if (newWidth > maxWidth) {
        newWidth = maxWidth
      }
      if (newWidth < this.minWidth) {
        newWidth = this.minWidth
      }
      if (Number(newWidth)) {
        this.setState({
          width: newWidth,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'left') {
      const offset = pageX - (this.state.startingResizePosition?.x ?? 0)
      let newWidth = (this.state.startingResizePosition?.width ?? 0) + offset
      if (newWidth > maxWidth) {
        newWidth = maxWidth
      }
      if (newWidth < this.minWidth) {
        newWidth = this.minWidth
      }
      if (Number(newWidth)) {
        this.setState({
          width: newWidth,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'bottom') {
      const offset = (this.state.startingResizePosition?.y ?? 0) - pageY
      let newHeight = (this.state.startingResizePosition?.height ?? 0) + offset
      if (newHeight > maxHeight) {
        newHeight = maxHeight
      }
      if (newHeight < this.minHeight) {
        newHeight = this.minHeight
      }
      if (Number(newHeight)) {
        this.setState({
          height: newHeight,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'top') {
      const offset = pageY - (this.state.startingResizePosition?.y ?? 0)
      let newHeight = (this.state.startingResizePosition?.height ?? 0) + offset
      if (newHeight > maxHeight) {
        newHeight = maxHeight
      }
      if (newHeight < this.minHeight) {
        newHeight = this.minHeight
      }
      if (Number(newHeight)) {
        this.setState({
          height: newHeight,
          isSizeMaximum: false,
        })
      }
    }
  }

  stopResizingDrawer = () => {
    if (this.resizeAnimationFrame) {
      window.cancelAnimationFrame(this.resizeAnimationFrame)
      this.resizeAnimationFrame = undefined
    }

    if (this._isMounted && this.state.isResizing) {
      this.setState({
        isResizing: false,
      })
    }

    document.removeEventListener('mousemove', this.resizeDrawer)
    document.removeEventListener('mouseup', this.stopResizingDrawer)
    document.removeEventListener('mouseleave', this.stopResizingDrawer)
  }

  renderResizeHandle = () => {
    const self = this
    if (this.state.isVisible) {
      const placement = this.getPlacementProp()
      return (
        <div
          className={`react-autoql-drawer-resize-handle ${placement}`}
          onMouseDown={(e) => {
            this.setState({
              isResizing: true,
              startingResizePosition: {
                x: e.pageX,
                y: e.pageY,
                width: this.getDrawerWidth(),
                height: this.getDrawerHeight(),
              },
            })
            document.addEventListener('mousemove', self.resizeDrawer)
            document.addEventListener('mouseup', self.stopResizingDrawer)
            document.addEventListener('mouseleave', self.stopResizingDrawer)
          }}
        />
      )
    }
    return null
  }

  // A small pill straddling the drawer's outer edge that expands it to full
  // screen. It replaces the header's maximize button, and disappears once
  // maximized — at that point renderRestoreHandle's pill is the way back.
  renderMaximizeHandle = () => {
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()

    if (this.isEffectivelyMaximized() || !this.state.isVisible) {
      return null
    }

    return (
      <button
        className={`react-autoql-drawer-maximize-handle ${this.getPlacementProp()}`}
        onClick={() => this.toggleFullScreen(false, maxWidth, maxHeight)}
        data-tooltip-content={lang.maximizeDataMessenger}
        data-tooltip-id={this.TOOLTIP_ID}
      >
        <Icon type='caret-left' />
      </button>
    )
  }

  // How close, in px, the pointer has to come to the maximized drawer's outer edge
  // for the restore pill to show. Near rather than on the edge: that edge is the
  // edge of the screen, and nobody aims for the last pixel of it.
  RESTORE_EDGE_DISTANCE = 30

  getDistanceFromOuterEdge = (e) => {
    const rect = this.messengerDrawerRef?.getBoundingClientRect()

    if (!rect) {
      return Infinity
    }

    switch (this.getPlacementProp()) {
      case 'left':
        return rect.right - e.clientX
      case 'top':
        return rect.bottom - e.clientY
      case 'bottom':
        return e.clientY - rect.top
      default:
        return e.clientX - rect.left
    }
  }

  onDrawerMouseMove = (e) => {
    if (!isBrowser || !this.isEffectivelyMaximized()) {
      return
    }

    // The pill reaches a little past the reveal distance, so being on it counts as
    // near - otherwise it would vanish from under the pointer on its inner half.
    const isNearRestoreEdge =
      this.getDistanceFromOuterEdge(e) <= this.RESTORE_EDGE_DISTANCE || !!this.restoreHandleRef?.contains(e.target)

    // Every mouse move lands here, so only re-render when the answer changes.
    if (isNearRestoreEdge !== this.state.isNearRestoreEdge) {
      this.setState({ isNearRestoreEdge })
    }
  }

  onDrawerMouseLeave = () => {
    if (this.state.isNearRestoreEdge) {
      this.setState({ isNearRestoreEdge: false })
    }
  }

  // The maximize pill's counterpart. Maximized, the outer edge is the edge of the
  // screen, so this pill sits just inside it instead of straddling it, and stays
  // out of the way until the pointer comes near. It replaced a header button
  // customers weren't finding.
  renderRestoreHandle = () => {
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()

    if (!this.isEffectivelyMaximized() || !this.state.isVisible) {
      return null
    }

    return (
      <button
        ref={(r) => (this.restoreHandleRef = r)}
        className={`react-autoql-drawer-restore-handle ${this.getPlacementProp()}${
          this.state.isNearRestoreEdge ? ' visible' : ''
        }`}
        onClick={() => {
          this.setState({ isNearRestoreEdge: false })
          this.toggleFullScreen(true, maxWidth, maxHeight)
        }}
        aria-label={lang.minimizeDataMessenger}
        data-tooltip-content={lang.minimizeDataMessenger}
        data-tooltip-id={this.TOOLTIP_ID}
        data-test='data-messenger-restore-handle'
      >
        <Icon type='caret-right' />
      </button>
    )
  }

  renderTooltips = () => {
    return (
      <>
        <Tooltip tooltipId={this.TOOLTIP_ID} />
        <Tooltip className='react-autoql-chart-tooltip' tooltipId={this.CHART_TOOLTIP_ID} delayShow={0} />
      </>
    )
  }

  render = () => {
    if (this.state.hasError) {
      return null
    }
    const shouldHideHeader = isMobile && this.state.activePage === 'data-explorer'

    return (
      <ErrorBoundary>
        {setLanguage()}
        <Drawer
          ref={(ref) => (this.dmRef = ref)}
          id={`react-autoql-drawer-${this.COMPONENT_KEY}`}
          data-test='react-autoql-drawer-test'
          className={`react-autoql-drawer
              ${this.state.isResizing ? ' disable-selection' : ''}
              ${this.state.isVisible ? ' open' : ' closed'}
              ${`drawer-${this.state.placement}`}`}
          showMask={this.props.showMask}
          placement={this.getPlacementProp()}
          width={this.getDrawerWidth()}
          height={this.getDrawerHeight()}
          onChange={this.onDrawerChange}
          maskClosable={true}
          handler={this.getHandleProp()}
          level={this.props.shiftScreen ? 'all' : null}
          keyboard={false}
          style={isMobile ? { top: '50px', boxShadow: 'unset' } : null}
        >
          {this.props.resizable && isBrowser && this.renderResizeHandle()}
          {isBrowser && this.renderMaximizeHandle()}
          <div
            ref={(r) => (this.messengerDrawerRef = r)}
            className={`react-autoql-drawer-content-container ${this.state.activePage}`}
            onMouseMove={this.onDrawerMouseMove}
            onMouseLeave={this.onDrawerMouseLeave}
          >
            {isBrowser && this.renderRestoreHandle()}
            {!shouldHideHeader && (
              <div
                className={`chat-header-container ${isMobile ? 'mobile-hidden' : ''}`}
                id={isMobile ? 'mobile-version' : null}
              >
                {this.renderHeaderContent()}
              </div>
            )}
            {this.renderBodyContent()}
          </div>
        </Drawer>
        {this.renderTooltips()}
      </ErrorBoundary>
    )
  }
}

export default withTheme(DataMessenger)
