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
import { FilterLockPopover } from '../FilterLockPopover'
import { ChatContent } from '../ChatContent'
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

    this.dataMessengerIntroMessages = [
      props.introMessage ? (
        `${props.introMessage}`
      ) : (
        <>
          <span>Hi {props.userDisplayName || 'there'}! Let’s dive into your data.</span>
          <br />
          <br />
          <span>Get started by asking a query below, or use </span>
          <span className='intro-qi-link' onClick={this.openDataExplorer}>
            <Icon type='data-search' /> {lang.dataExplorer}
          </span>
          <span> to discover what data is available to you!</span>
        </>
      ),
    ]

    this.dprMessengerIntroMessages = [
      <>
        <span>Ask questions, get answers.</span>
        <br />
        <br />
        <span>
          Get helpful information about trading and investing, simply by asking a question in your own words. Results
          are returned from content on{' '}
          <a href='https://www.investopedia.com/' target='_blank' rel='noopener noreferrer'>
            Investopedia®
          </a>
          , including applicable reference links.
        </span>
      </>,
    ]

    if (props.enableAjaxTableData !== undefined) {
      console.warn(
        'enableAjaxtableData is deprecated - the provided prop will be ignored and the default value of "true" will be used instead.',
      )
    }

    this.state = {
      dataMessengerId: uuid(),
      hasError: false,
      activePage: props.defaultTab,
      width: isBrowser ? props.width : '100vw',
      height: props.height,
      isResizing: false,
      isWindowResizing: false,
      placement: this.getPlacementProp(props.placement),
      isOptionsDropdownOpen: false,
      isFilterLockMenuOpen: false,
      selectedValueLabel: undefined,
      isSizeMaximum: false,
    }
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    // UI
    placement: PropTypes.string,
    maskClosable: PropTypes.bool,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    showHandle: PropTypes.bool,
    handleImage: PropTypes.string,
    handleStyles: PropTypes.shape({}),
    shiftScreen: PropTypes.bool,
    userDisplayName: PropTypes.string,
    clearOnClose: PropTypes.bool,
    enableVoiceRecord: PropTypes.bool,
    title: PropTypes.string,
    maxMessages: PropTypes.number,
    introMessage: PropTypes.string,
    enableExploreQueriesTab: PropTypes.bool,
    enableNotificationsTab: PropTypes.bool,
    resizable: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
    enableDPRTab: PropTypes.bool,
    // Session-based agent page. defaultTab accepts 'agent' when this is enabled, and
    // openDataMessenger('agent') deep-links to it (including on mobile, where the tab
    // rail isn't rendered).
    enableAgentTab: PropTypes.bool,
    agentInputPlaceholder: PropTypes.string,
    agentSuggestions: PropTypes.arrayOf(PropTypes.string),
    agentModels: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string })),
    agentModelsEndpoint: PropTypes.string,
    agentDefaultModelId: PropTypes.string,
    // Development only: renders captured session payloads instead of calling the API.
    agentMockResponses: PropTypes.bool,
    dataPageSize: PropTypes.number,
    notificationCount: PropTypes.number,
    defaultOpen: PropTypes.bool,
    popoverParentElement: PropTypes.element,

    enableDynamicCharting: PropTypes.bool,
    defaultTab: PropTypes.string,
    autoChartAggregations: PropTypes.bool,
    enableFilterLocking: PropTypes.bool,
    enableQueryQuickStartTopics: PropTypes.bool,
    enableQueryInputTopics: PropTypes.bool,
    disableColumnSelectionForDataExplorer: PropTypes.bool,
    enableMagicWand: PropTypes.bool,
    showMagicWandQuoteButton: PropTypes.bool,
    enableBillingGate: PropTypes.bool,
    onQuotaExceeded: PropTypes.func,
    enableCyclicalDates: PropTypes.bool,
    enableFollowOnQuery: PropTypes.bool,
    // Splits the Data Messenger chat into user sessions: a tab bar with a close
    // button per tab and a "+" for a new one. Each session gets its own UUID,
    // sent along with the queries the user types in it. Default false — no tabs
    // and no session UUID, exactly as before.
    enableSessions: PropTypes.bool,

    // Projects
    projectSelectList: PropTypes.arrayOf(
      PropTypes.shape({
        projectId: PropTypes.string.isRequired,
        displayName: PropTypes.string.isRequired,
      }),
    ),
    selectedProjectId: PropTypes.string,

    // Callbacks
    onNotificationExpandCallback: PropTypes.func,
    onNewNotification: PropTypes.func,
    onNotificationCount: PropTypes.func,
    onVisibleChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
    setMobileActivePage: PropTypes.func,
    onProjectSelectChange: PropTypes.func,
    onCreateQueryEvaluationItem: PropTypes.func,
    queryItemActionName: PropTypes.string,
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
    width: 600,
    height: 350,
    showHandle: true,
    handleImage: undefined,
    handleStyles: undefined,
    shiftScreen: false,
    userDisplayName: 'there',
    clearOnClose: false,
    enableVoiceRecord: true,
    title: 'Data Messenger',
    maxMessages: 20,
    introMessage: '',
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
    enableDPRTab: false,
    enableAgentTab: false,
    agentInputPlaceholder: undefined,
    agentSuggestions: undefined,
    agentModels: undefined,
    agentModelsEndpoint: undefined,
    agentDefaultModelId: undefined,
    agentMockResponses: false,
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

      if (this.state.activePage !== prevState.activePage) {
        nextState.isFilterLockMenuOpen = false
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
            <Icon type='react-autoql-bubbles-outlined' size={26} />
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
        isFilterLockMenuOpen: false,
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

  onRTValueLabelClick = (text) => {
    this.setState({ isFilterLockMenuOpen: true }, () => {
      this.filterLockRef?.insertFilter(text)
    })
  }

  clearMessages = () => {
    if (this.state.activePage === 'data-messenger') {
      this.dataMessengerContentRef?.clearMessages()
    } else if (this.state.activePage === 'dpr') {
      this.dprMessengerContentRef?.clearMessages()
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

  // Clearing the conversation is no longer a header action — ChatContent floats
  // its own "Clear conversation" button over the top of the thread it owns, so
  // the control clears the session you are actually looking at.
  renderRightHeaderContent = () => {
    return <>{getAutoQLConfig(this.props.autoQLConfig).enableFilterLocking && this.renderFilterLockPopover()}</>
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

  openFilterLockMenu = () => {
    if (!this.state.isFilterLockMenuOpen) {
      this.setState({
        isFilterLockMenuOpen: true,
      })
    }
  }

  closeFilterLockMenu = () => {
    if (this.state.isFilterLockMenuOpen) {
      this.setState({
        isFilterLockMenuOpen: false,
      })
    }
  }

  onFilterChange = (allFilters) => {
    const sessionFilters = allFilters.filter((filter) => filter.isSession)
    this.setState({ sessionFilters, hasFilters: !!allFilters?.length })
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

  renderFilterLockPopover = () => {
    this.filterLockingDrawerHeaderButtonClass = classNames({
      'react-autoql-drawer-header-btn filter-locking': true,
      visible: this.state.activePage === 'data-messenger',
      hidden: this.state.activePage !== 'data-messenger',
      mobile: isMobile,
    })
    return (
      <FilterLockPopover
        ref={(r) => (this.filterLockRef = r)}
        authentication={this.props.authentication}
        isOpen={this.state.isFilterLockMenuOpen}
        onChange={this.onFilterChange}
        onClose={this.closeFilterLockMenu}
        parentElement={this.messengerDrawerRef}
        boundaryElement={this.messengerDrawerRef}
        tooltipID={this.TOOLTIP_ID}
        positions={['bottom', 'left', 'top', 'right']}
        align='center'
      >
        <button
          className={this.filterLockingDrawerHeaderButtonClass}
          data-tooltip-content={lang.openFilterLocking}
          data-tooltip-id={this.TOOLTIP_ID}
          onClick={this.state.isFilterLockMenuOpen ? this.closeFilterLockMenu : this.openFilterLockMenu}
        >
          <span className='react-autoql-filter-lock-icon-container'>
            <Icon type={this.state.hasFilters ? 'lock' : 'unlock'} />
            {this.state.hasFilters ? <div className='react-autoql-filter-lock-icon-badge' /> : null}
          </span>
        </button>
      </FilterLockPopover>
    )
  }

  renderHeaderContent = () => {
    if (isMobile && this.state.activePage === 'data-explorer') {
      return null
    }
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()
    const isFullScreen = this.isEffectivelyMaximized()
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
              {/* Only maximized state gets a header control. Expanding is offered
                  by the pill on the drawer's outer edge instead, so the header
                  keeps just the one action that is relevant right now. */}
              {isFullScreen && (
                <button
                  onClick={() => this.toggleFullScreen(isFullScreen, maxWidth, maxHeight)}
                  className='react-autoql-drawer-header-btn screen-mode'
                  data-tooltip-content={lang.minimizeDataMessenger}
                  data-tooltip-id={this.TOOLTIP_ID}
                >
                  <Icon type='caret-right' />
                </button>
              )}
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
          key={this.state.dataMessengerId}
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
          enableVoiceRecord={this.props.enableVoiceRecord}
          tooltipID={this.TOOLTIP_ID}
          onErrorCallback={this.props.onErrorCallback}
        />
      </ErrorBoundary>
    )
  }

  renderDataMessengerContent = () => {
    const valueLabelClickFn = getAutoQLConfig(this.props.autoQLConfig).enableFilterLocking
      ? this.onRTValueLabelClick
      : undefined

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
          onRTValueLabelClick={valueLabelClickFn}
          queryFilters={this.state.sessionFilters}
          introMessages={this.dataMessengerIntroMessages}
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
          // With sessions on, this ChatContent hosts the tab bar and one thread
          // per session. "Clear messages" and animateInputTextAndSubmit reach
          // the visible session through the same ref, so nothing here changes.
          enableSessions={this.props.enableSessions}
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
          introMessages={this.dprMessengerIntroMessages}
          disableMaxMessageHeight={true}
          inputPlaceholder='Type your questions here'
          // Sessions are a Data Messenger chat feature — the DPR tab talks to a
          // different service and already has its own session id below, so keep
          // the tab bar out of it even when the integrator turns sessions on.
          enableSessions={false}
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
  // maximized — at that point the header's restore control is the way back.
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
          >
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
