import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import Drawer from 'rc-drawer'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import _get from 'lodash.get'
import _has from 'lodash.has'
import _isEmpty from 'lodash.isempty'
import _isEqual from 'lodash.isequal'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { ChatContent } from '../ChatContent'
import TopicsCascader from './TopicsCascader'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType,
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault,
  getAuthentication,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import { setCSSVars } from '../../js/Util'
import { lang, setLanguage } from '../../js/Localization'

// Components
import { Icon } from '../Icon'
import { Button } from '../Button'
import { ExploreQueries } from '../ExploreQueries'
import { DataAlertModal } from '../Notifications/DataAlertModal'
import { NotificationIcon } from '../Notifications/NotificationIcon'
import { NotificationFeed } from '../Notifications/NotificationFeed'
import { fetchTopics } from '../../js/queryService'
import { FilterLockPopover } from '../FilterLockPopover'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'

export default class DataMessenger extends React.Component {
  constructor(props) {
    super(props)

    this.minWidth = 400
    this.minHeight = 400

    this.COMPONENT_KEY = uuid()
    this.HEADER_THICKNESS = 70
    this.TAB_THICKNESS = 45
    this.DEFAULT_AJAX_PAGE_SIZE = 50

    setCSSVars(props.themeConfig)

    this.dataMessengerIntroMessages = [
      props.introMessage
        ? `${props.introMessage}`
        : `Hi ${props.userDisplayName ||
            'there'}! Let’s dive into your data. What can I help you discover today?`,
    ]

    this.dprMessengerIntroMessages = [
      <>
        <span>Ask questions, get answers.</span>
        <br />
        <br />
        <span>
          Get helpful information about trading and investing, simply by asking
          a question in your own words. Results are returned from content on{' '}
          <a
            href="https://www.investopedia.com/"
            target="_blank"
            rel="noopener"
          >
            Investopedia®
          </a>
          , including applicable reference links.
        </span>
      </>,
    ]

    this.state = {
      dataMessengerId: uuid(),
      hasError: false,
      activePage: props.defaultTab,
      width: props.width,
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
    themeConfig: themeConfigType,

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
    dataPageSize: PropTypes.number,
    notificationCount: PropTypes.number,

    enableDynamicCharting: PropTypes.bool,
    defaultTab: PropTypes.string,
    autoChartAggregations: PropTypes.bool,
    enableFilterLocking: PropTypes.bool,
    enableQueryQuickStartTopics: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,

    // Callbacks
    onNotificationExpandCallback: PropTypes.func,
    onNewNotification: PropTypes.func,
    onNotificationCount: PropTypes.func,
    onVisibleChange: PropTypes.func,
    onErrorCallback: PropTypes.func,
    onSuccessAlert: PropTypes.func,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,
    themeConfig: themeConfigDefault,

    // UI
    placement: 'right',
    maskClosable: true,
    isVisible: true,
    width: 500,
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
    enableExploreQueriesTab: true,
    enableNotificationsTab: false,
    resizable: true,
    inputPlaceholder: 'Type your queries here',
    dataPageSize: undefined,
    notificationCount: undefined,

    enableDynamicCharting: true,
    defaultTab: 'data-messenger',
    autoChartAggregations: true,
    enableFilterLocking: false,
    enableQueryQuickStartTopics: true,
    enableAjaxTableData: false,
    enableDPRTab: false,

    // Callbacks
    onNotificationExpandCallback: () => {},
    onNewNotification: () => {},
    onNotificationCount: () => {},
    onVisibleChange: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    try {
      document.addEventListener('visibilitychange', this.onWindowResize)
      window.addEventListener('resize', this.onWindowResize)

      if (this.props.enableQueryQuickStartTopics) {
        this.setQueryTopics()
      }
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }

    setTimeout(this.rebuildTooltips, 1000)
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
        typeof this.props.notificationCount === 'number' &&
        this.props.notificationCount !== prevProps.notificationCount
      ) {
        this.refreshNotifications()
      }

      if (
        !this.state.isVisible &&
        prevState.isVisible &&
        this.props.clearOnClose
      ) {
        this.setState({ dataMessengerId: uuid() })
      }

      if (
        !_isEqual(
          getThemeConfig(this.props.themeConfig),
          getThemeConfig(prevProps.themeConfig)
        )
      ) {
        setCSSVars(this.props.themeConfig)
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
      document.removeEventListener('visibilitychange', this.onWindowResize)

      clearTimeout(this.windowResizeTimer)
      clearTimeout(this.feedbackTimeout)
      clearTimeout(this.animateTextTimeout)
      clearTimeout(this.exploreQueriesTimeout)
      clearTimeout(this.executeQueryTimeout)
      clearTimeout(this.rebuildTooltipsTimer)
    } catch (error) {}
  }

  setQueryTopics = () => {
    fetchTopics(getAuthentication(this.props.authentication))
      .then((response) => {
        if (
          this.dataMessengerContentRef?._isMounted &&
          !!response?.data?.data?.topics?.length
        ) {
          const topicsContent = (
            <TopicsCascader
              topics={response.data.data.topics}
              enableExploreQueriesTab={this.props.enableExploreQueriesTab}
              onTopicClick={this.onTopicClick}
              onExploreQueriesClick={this.openExploreQueries}
            />
          )

          this.dataMessengerIntroMessages.push(topicsContent)
          if (this.dataMessengerContentRef?._isMounted) {
            this.dataMessengerContentRef?.addIntroMessage(topicsContent)
          }
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  rebuildTooltips = (delay = 500) => {
    clearTimeout(this.rebuildTooltipsTimer)
    this.rebuildTooltipsTimer = setTimeout(() => {
      ReactTooltip.rebuild()
    }, delay)
  }

  refreshNotifications = () => {
    this.notificationListRef?.refreshNotifications('dm')
  }

  getMaxWidthAndHeightFromDocument = () => {
    const maxWidth =
      Math.max(document.documentElement.clientWidth, window.innerWidth || 0) -
      this.TAB_THICKNESS
    const maxHeight =
      Math.max(document.documentElement.clientHeight, window.innerHeight || 0) -
      this.TAB_THICKNESS
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

  openExploreQueries = (topic) => {
    this.setState({ activePage: 'explore-queries' })

    if (topic) {
      clearTimeout(this.exploreQueriesTimeout)
      this.exploreQueriesTimeout = setTimeout(() => {
        this.exploreQueriesRef?.animateQITextAndSubmit(topic)
      }, 500)
    }
  }

  toggleFullScreen = (isFullScreen, maxWidth, maxHeight) => {
    this.setState({
      width: isFullScreen ? this.props.width : maxWidth,
      height: isFullScreen ? this.props.height : maxHeight,
      isSizeMaximum: isFullScreen ? false : true,
    })
    ReactTooltip.hide()
  }

  getHandleProp = () => {
    if (this.props.customHandle !== undefined) {
      return this.props.customHandle
    } else if (this.props.showHandle) {
      return (
        <div
          className={`drawer-handle
            ${this.state.isVisible ? ' hide' : ''}
            ${this.props.handleImage ? '' : ' default-logo'}`}
          style={this.props.handleStyles}
        >
          {this.props.handleImage ? (
            <img
              src={this.props.handleImage}
              height="22px"
              width="22px"
              draggable="false"
            />
          ) : (
            <Icon type="react-autoql-bubbles-outlined" size={26} />
          )}
        </div>
      )
    }
    return false
  }

  getDrawerHeight = () => {
    if (this.state.placement === 'right' || this.state.placement === 'left') {
      return null
    }
    return this.state.height
  }

  getDrawerWidth = () => {
    if (this.state.placement === 'right' || this.state.placement === 'left') {
      return this.state.width
    }
    return null
  }

  getPlacementProp = () => {
    const { placement } = this.props
    let formattedPlacement
    if (typeof placement === 'string') {
      formattedPlacement = placement.trim().toLowerCase()
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

  renderTabs = () => {
    const page = this.state.activePage

    return (
      <div
        className={`data-messenger-tab-container ${this.props.placement} ${
          this.state.isVisible ? 'visible' : 'hidden'
        }`}
      >
        <div
          className={`page-switcher-shadow-container  ${this.props.placement}`}
        >
          <div className={`page-switcher-container ${this.props.placement}`}>
            <div
              className={`tab${page === 'data-messenger' ? ' active' : ''}`}
              onClick={() => this.setState({ activePage: 'data-messenger' })}
              data-tip="Data Messenger"
              data-for="react-autoql-header-tooltip"
            >
              <Icon type="react-autoql-bubbles-outlined" />
            </div>
            {this.props.enableExploreQueriesTab && (
              <div
                className={`tab${
                  page === 'explore-queries' ? ' active' : ''
                } react-autoql-explore-queries`}
                onClick={() => this.setState({ activePage: 'explore-queries' })}
                data-tip={lang.exploreQueries}
                data-for="react-autoql-header-tooltip"
              >
                <Icon type="light-bulb" size={22} />
              </div>
            )}
            {this.props.enableNotificationsTab &&
              getAutoQLConfig(this.props.autoQLConfig).enableNotifications && (
                <div
                  className={`tab${
                    page === 'notifications' ? ' active' : ''
                  } react-autoql-notifications`}
                  onClick={() => {
                    this.setState({ activePage: 'notifications' })
                    if (this.notificationBadgeRef) {
                      this.notificationBadgeRef.resetCount()
                    }
                  }}
                  data-tip="Notifications"
                  data-for="react-autoql-header-tooltip"
                >
                  <div className="data-messenger-notification-btn">
                    <NotificationIcon
                      ref={(r) => (this.notificationBadgeRef = r)}
                      authentication={getAuthentication(
                        getAuthentication(this.props.authentication)
                      )}
                      themeConfig={this.props.themeConfig}
                      clearCountOnClick={false}
                      style={{ fontSize: '19px' }}
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
                </div>
              )}
            {this.props.enableDPRTab && (
              <div
                className={`tab${
                  page === 'dpr' ? ' active' : ''
                } react-autoql-dpr`}
                onClick={() => this.setState({ activePage: 'dpr' })}
                data-tip="Education"
                data-for="react-autoql-header-tooltip"
              >
                <Icon type="grad-cap" size={22} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  renderRightHeaderContent = () => {
    return (
      <>
        {getAutoQLConfig(this.props.autoQLConfig).enableFilterLocking &&
          this.renderFilterLockPopover()}
        <Popover
          isOpen={this.state.isOptionsDropdownOpen}
          onClickOutside={() => {
            this.setState({ isOptionsDropdownOpen: false })
          }}
          position="bottom" // preferred position
          content={
            <div>
              <div className="clear-messages-confirm-popover">
                <div
                  className="react-autoql-menu-text"
                  onClick={this.handleClearQueriesDropdown}
                >
                  <Icon type="trash" />
                  <span style={{ marginLeft: 5 }}>
                    {lang.clearDataResponses}
                  </span>
                </div>
                <div
                  ref={(r) => (this.clearQueriesDropdown = r)}
                  id="clear-queries-dropdown"
                  style={{ display: 'none' }}
                >
                  <Button
                    type="default"
                    size="small"
                    onClick={() =>
                      this.setState({ isOptionsDropdownOpen: false })
                    }
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => this.clearMessages()}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          }
        >
          <button
            onClick={() =>
              this.setState({
                isOptionsDropdownOpen: !this.state.isOptionsDropdownOpen,
              })
            }
            className={`react-autoql-drawer-header-btn clear-all ${
              this.state.activePage === 'data-messenger' ||
              this.state.activePage === 'dpr'
                ? 'visible'
                : 'hidden'
            }`}
            data-tip={lang.clearDataResponses}
            data-for="react-autoql-header-tooltip"
          >
            <Icon type="trash" />
          </button>
        </Popover>
      </>
    )
  }

  renderHeaderTitle = () => {
    let title = ''
    switch (this.state.activePage) {
      case 'data-messenger': {
        title = this.props.title
        break
      }
      case 'explore-queries': {
        title = lang.exploreQueries
        break
      }
      case 'notifications': {
        title = lang.notifications
        break
      }
      case 'dpr': {
        title = 'Education'
        break
      }
    }

    return <div className="header-title">{title}</div>
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

  renderFilterLockPopover = () => {
    return (
      <FilterLockPopover
        ref={(r) => (this.filterLockRef = r)}
        authentication={this.props.authentication}
        themeConfig={this.props.themeConfig}
        isOpen={this.state.isFilterLockMenuOpen}
        onChange={this.onFilterChange}
        onClose={this.closeFilterLockMenu}
        rebuildTooltips={this.rebuildTooltips}
        position="bottom"
        align="end"
      >
        <button
          className={`react-autoql-drawer-header-btn filter-locking ${
            this.state.activePage === 'data-messenger' ? 'visible' : 'hidden'
          }`}
          data-tip={lang.openFilterLocking}
          data-for="react-autoql-header-tooltip"
          onClick={
            this.state.isFilterLockMenuOpen
              ? this.closeFilterLockMenu
              : this.openFilterLockMenu
          }
        >
          <Icon type={this.state.hasFilters ? 'lock' : 'unlock'} />
        </button>
      </FilterLockPopover>
    )
  }

  renderHeaderContent = () => {
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()
    const isFullScreen = this.state.width === maxWidth
    return (
      <Fragment>
        <div className="react-autoql-header-left-container">
          <button
            onClick={() => {
              this.dmRef.setState({ open: false })
              this.setState({ isVisible: false })
            }}
            className="react-autoql-drawer-header-btn close"
            data-tip={lang.closeDataMessenger}
            data-for="react-autoql-header-tooltip"
          >
            <Icon type="close" />
          </button>

          <button
            onClick={() =>
              this.toggleFullScreen(isFullScreen, maxWidth, maxHeight)
            }
            className="react-autoql-drawer-header-btn screen-mode"
            data-tip={
              isFullScreen
                ? lang.minimizeDataMessenger
                : lang.maximizeDataMessenger
            }
            data-for="react-autoql-header-tooltip"
          >
            <Icon type={isFullScreen ? 'minimize' : 'maximize'} />
          </button>
        </div>
        <div className="react-autoql-header-center-container">
          {this.renderHeaderTitle()}
        </div>
        <div className="react-autoql-header-right-container">
          {this.renderRightHeaderContent()}
        </div>
      </Fragment>
    )
  }

  renderBodyContent = () => {
    return (
      <>
        {this.renderDataMessengerContent()}
        {this.renderExploreQueriesContent()}
        {this.renderNotificationsContent()}
        {this.renderDPRContent()}
      </>
    )
  }

  renderDataMessengerContent = () => {
    let dataPageSize = this.props.dataPageSize
    if (this.props.enableAjaxTableData && !dataPageSize) {
      dataPageSize = this.DEFAULT_AJAX_PAGE_SIZE
    }

    return (
      <ErrorBoundary>
        <ChatContent
          {...this.props}
          shouldRender={this.state.activePage === 'data-messenger'}
          key={this.state.dataMessengerId}
          ref={(r) => (this.dataMessengerContentRef = r)}
          authentication={this.props.authentication}
          autoQLConfig={this.props.autoQLConfig}
          themeConfig={this.props.themeConfig}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          source={['data_messenger']}
          rebuildTooltips={this.rebuildTooltips}
          onRTValueLabelClick={this.onRTValueLabelClick}
          queryFilters={this.state.sessionFilters}
          isDataMessengerOpen={!!this.dmRef?.state?.open}
          introMessages={this.dataMessengerIntroMessages}
          inputPlaceholder={this.props.inputPlaceholder}
          enableAjaxTableData={this.props.enableAjaxTableData}
          autoChartAggregations={this.props.autoChartAggregations}
          dataPageSize={dataPageSize}
        />
      </ErrorBoundary>
    )
  }

  renderDPRContent = () => {
    return (
      <ErrorBoundary>
        <ChatContent
          {...this.props}
          shouldRender={this.state.activePage === 'dpr'}
          key={this.state.dataMessengerId}
          ref={(r) => (this.dprMessengerContentRef = r)}
          authentication={{
            dprKey: this.props.authentication?.dprKey,
            dprDomain: this.props.authentication?.dprDomain,
          }}
          themeConfig={this.props.themeConfig}
          isResizing={this.state.isResizing || this.state.isWindowResizing}
          source={['data_messenger']}
          rebuildTooltips={this.rebuildTooltips}
          isDataMessengerOpen={!!this.dmRef?.state?.open}
          introMessages={this.dprMessengerIntroMessages}
          disableMaxMessageHeight={true}
          inputPlaceholder="Type your questions here"
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
        />
      </ErrorBoundary>
    )
  }

  renderExploreQueriesContent = () => (
    <ErrorBoundary>
      <ExploreQueries
        ref={(r) => (this.exploreQueriesRef = r)}
        authentication={this.props.authentication}
        shouldRender={
          this.state.activePage === 'explore-queries' &&
          !!this.dmRef?.state?.open
        }
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

  renderNotificationsContent = () => (
    <ErrorBoundary>
      <NotificationFeed
        ref={(ref) => (this.notificationListRef = ref)}
        authentication={getAuthentication(this.props.authentication)}
        themeConfig={this.props.themeConfig}
        onExpandCallback={this.props.onNotificationExpandCallback}
        onCollapseCallback={this.props.onNotificationCollapseCallback}
        activeNotificationData={this.props.activeNotificationData}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessCallback={this.props.onSuccessCallback}
        showNotificationDetails={false}
        shouldRender={
          !!this.dmRef?.state?.open && this.state.activePage === 'notifications'
        }
      />
    </ErrorBoundary>
  )

  resizeDrawer = (e) => {
    const { placement } = this.state
    const { maxWidth, maxHeight } = this.getMaxWidthAndHeightFromDocument()

    if (placement === 'right') {
      const offset = _get(this.state.startingResizePosition, 'x') - e.pageX
      let newWidth = _get(this.state.startingResizePosition, 'width') + offset
      if (newWidth > maxWidth) newWidth = maxWidth
      if (newWidth < this.minWidth) newWidth = this.minWidth
      if (Number(newWidth)) {
        this.setState({
          width: newWidth,
          containerWidth: newWidth,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'left') {
      const offset = e.pageX - _get(this.state.startingResizePosition, 'x')
      let newWidth = _get(this.state.startingResizePosition, 'width') + offset
      if (newWidth > maxWidth) newWidth = maxWidth
      if (newWidth < this.minWidth) newWidth = this.minWidth
      if (Number(newWidth)) {
        this.setState({
          width: newWidth,
          containerWidth: newWidth,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'bottom') {
      const offset = _get(this.state.startingResizePosition, 'y') - e.pageY
      let newHeight = _get(this.state.startingResizePosition, 'height') + offset
      if (newHeight > maxHeight) newHeight = maxHeight
      if (newHeight < this.minHeight) newHeight = this.minHeight
      if (Number(newHeight)) {
        this.setState({
          height: newHeight,
          isSizeMaximum: false,
        })
      }
    } else if (placement === 'top') {
      const offset = e.pageY - _get(this.state.startingResizePosition, 'y')
      let newHeight = _get(this.state.startingResizePosition, 'height') + offset
      if (newHeight > this.maxHeight) newHeight = this.maxHeight
      if (newHeight < this.minHeight) newHeight = this.minHeight
      if (Number(newHeight)) {
        this.setState({
          height: newHeight,
          isSizeMaximum: false,
        })
      }
    }
  }

  stopResizingDrawer = () => {
    if (this.state.placement === 'right' || this.state.placement === 'left') {
      this.setState({
        isResizing: false,
        containerWidth: this.state.width,
      })
    } else if (
      this.state.placement === 'top' ||
      this.state.placement === 'bottom'
    ) {
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
                width: this.state.width,
                height: this.state.height,
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

  renderTooltips = () => {
    return (
      <Fragment>
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="react-autoql-header-tooltip"
          effect="solid"
          delayShow={800}
          place="top"
          html
        />
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="react-autoql-toolbar-btn-tooltip"
          effect="solid"
          delayShow={500}
          place="top"
          html
        />
      </Fragment>
    )
  }

  renderDataAlertModal = () => {
    return (
      <DataAlertModal
        authentication={getAuthentication(this.props.authentication)}
        themeConfig={this.props.themeConfig}
        isVisible={this.state.isDataAlertModalVisible}
        onClose={() => this.setState({ isDataAlertModalVisible: false })}
        onSave={() => {
          this.props.onSuccessAlert('Notification created!')
          this.setState({ isDataAlertModalVisible: false })
        }}
        onErrorCallback={() =>
          this.props.onErrorCallback(
            'Something went wrong when creating this notification. Please try again.'
          )
        }
        initialQuery={this.state.activeQuery}
      />
    )
  }

  render = () => {
    if (this.state.hasError) {
      return null
    }

    return (
      <ErrorBoundary>
        {setLanguage()}
        <Drawer
          ref={(ref) => (this.dmRef = ref)}
          id={`react-autoql-drawer-${this.COMPONENT_KEY}`}
          data-test="react-autoql-drawer-test"
          className={`react-autoql-drawer
              ${this.state.isResizing ? ' disable-selection' : ''}
              ${this.state.isVisible ? ' open' : ' closed'}`}
          showMask={this.props.showMask}
          placement={this.getPlacementProp()}
          width={this.getDrawerWidth()}
          height={this.getDrawerHeight()}
          onChange={this.onDrawerChange}
          maskClosable={true}
          handler={this.getHandleProp()}
          level={this.props.shiftScreen ? 'all' : null}
          keyboard={false}
        >
          {this.props.resizable && this.renderResizeHandle()}
          {(this.props.enableExploreQueriesTab ||
            this.props.enableNotificationsTab) &&
            this.renderTabs()}
          <div className="react-autoql-drawer-content-container">
            <div className="chat-header-container">
              {this.renderHeaderContent()}
            </div>
            {this.renderBodyContent()}
          </div>
        </Drawer>
        {this.renderDataAlertModal()}
        {this.renderTooltips()}
      </ErrorBoundary>
    )
  }
}
