import React, { Fragment } from 'react'
import { number, bool, string, func, shape, array, oneOfType } from 'prop-types'
import uuid from 'uuid'
import Drawer from 'rc-drawer'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import _get from 'lodash.get'
import _has from 'lodash.has'
import _isEmpty from 'lodash.isempty'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

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
  getDataFormatting,
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import {
  setCSSVars,
  filterDataForDrilldown,
  removeFromDOM,
} from '../../js/Util'
import errorMessages from '../../js/errorMessages'
import { lang, setLanguage } from '../../js/Localization'

// Components
import { Icon } from '../Icon'
import { QueryInput } from '../QueryInput'
import { ChatMessage } from '../ChatMessage'
import { Button } from '../Button'
import { QueryTipsTab } from '../QueryTipsTab'
import { Cascader } from '../Cascader'
import { DataAlertModal } from '../Notifications/DataAlertModal'
import { NotificationIcon } from '../Notifications/NotificationIcon'
import { NotificationFeed } from '../Notifications/NotificationFeed'
import {
  runDrilldown,
  fetchQueryTips,
  fetchConditions,
  fetchTopics,
} from '../../js/queryService'
import { ConditionLockMenu } from '../ConditionLockMenu'
import { CustomScrollbars } from '../CustomScrollbars'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'

export default class DataMessenger extends React.Component {
  constructor(props) {
    super(props)

    this.csvProgressLog = {}
    this.messageRefs = {}
    this.minWidth = 400
    this.minHeight = 400
    this.DATA_MESSENGER_ID = uuid.v4()
    this.HEADER_THICKNESS = 70
    this.setMaxWidthAndHeightFromDocument()
    setCSSVars(getThemeConfig(this.props.themeConfig))

    this.state = {
      hasError: false,
      isVisible: false,
      activePage: props.defaultTab,
      width: props.width,
      height: props.height,
      isResizing: false,
      placement: this.getPlacementProp(props.placement),
      lastMessageId: undefined,
      isOptionsDropdownOpen: false,
      isFilterLockingMenuOpen: false,
      selectedValueLabel: undefined,
      conditions: undefined,
      messages: [],
      topicsMessageContent: undefined,
      queryTipsList: undefined,
      queryTipsLoading: false,
      queryTipsError: false,
      queryTipsTotalPages: undefined,
      queryTipsCurrentPage: 1,
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
    placement: string,
    maskClosable: bool,
    width: oneOfType([string, number]),
    height: oneOfType([string, number]),
    showHandle: bool,
    handleImage: string,
    handleStyles: shape({}),
    shiftScreen: bool,
    userDisplayName: string,
    clearOnClose: bool,
    enableVoiceRecord: bool,
    title: string,
    maxMessages: number,
    introMessage: string,
    enableExploreQueriesTab: bool,
    enableNotificationsTab: bool,
    resizable: bool,
    inputPlaceholder: string,

    enableDynamicCharting: bool,
    defaultTab: string,
    autoChartAggregations: bool,
    enableQueryInterpretation: bool,
    defaultShowInterpretation: bool,
    enableFilterLocking: bool,
    enableQueryQuickStartTopics: bool,

    // Callbacks
    onVisibleChange: func,
    onHandleClick: func,
    onErrorCallback: func,
    onSuccessAlert: func,
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
    maxMessages: undefined,
    introMessage: undefined,
    enableExploreQueriesTab: true,
    enableNotificationsTab: false,
    resizable: true,
    inputPlaceholder: undefined,

    enableDynamicCharting: true,
    defaultTab: 'data-messenger',
    autoChartAggregations: true,
    enableQueryInterpretation: false,
    defaultShowInterpretation: false,
    enableFilterLocking: false,
    enableQueryQuickStartTopics: true,

    // Callbacks
    onHandleClick: () => {},
    onVisibleChange: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
  }

  componentDidMount = () => {
    try {
      this.setIntroMessages()
      document.addEventListener('visibilitychange', this.onWindowResize)
      window.addEventListener('resize', this.onWindowResize)

      this.setState({
        containerHeight: this.getScrollContainerHeight(),
        containerWidth: this.getScrollContainerWidth(),
      })
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }

    fetchConditions(getAuthentication(this.props.authentication))
      .then((response) => {
        var sessionConditions = JSON.parse(sessionStorage.getItem('conditions'))
        this.setState({
          conditions: {
            persistent: _get(response, 'data.data.data'),
            session: sessionConditions,
          },
        })
      })
      .catch((error) => {
        console.error(error)
      })

    if (this.props.enableQueryQuickStartTopics) {
      fetchTopics(getAuthentication(this.props.authentication))
        .then((response) => {
          const topics = _get(response, 'data.data.topics')
          if (topics) {
            const topicsMessageContent = this.createTopicsMessage(topics)
            if (topicsMessageContent) {
              const topicsMessage = this.createIntroMessage({
                content: topicsMessageContent,
              })
              this.setState({
                messages: [...this.state.messages, topicsMessage],
                topicsMessageContent: topicsMessageContent,
              })
            }
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      const nextState = {}

      if (this.props.placement !== prevProps.placement) {
        nextState.placement = this.getPlacementProp(this.props.placement)
        nextState.containerHeight = this.getScrollContainerHeight()
        nextState.containerWidth = this.getScrollContainerWidth()
      }
      if (this.state.isSizeMaximum !== prevState.isSizeMaximum) {
        this.forceUpdate()
      }
      if (this.state.isVisible && !prevState.isVisible) {
        if (this.queryInputRef) {
          this.queryInputRef.focus()
        }
        nextState.containerHeight = this.getScrollContainerHeight()
        nextState.containerWidth = this.getScrollContainerWidth()
      }

      if (
        !this.state.isVisible &&
        prevState.isVisible &&
        this.props.clearOnClose
      ) {
        this.clearMessages()
      }
      if (this.state.messages.length === 0) {
        this.setIntroMessages()
      }

      const thisTheme = getThemeConfig(this.props.themeConfig).theme
      const prevTheme = getThemeConfig(prevProps.themeConfig).theme
      if (thisTheme && thisTheme !== prevTheme) {
        setCSSVars(getThemeConfig(this.props.themeConfig))
      }

      if (
        this.state.isFilterLockingMenuOpen !== prevState.isFilterLockingMenuOpen
      ) {
        fetchConditions(getAuthentication(this.props.authentication))
          .then((response) => {
            var sessionConditions = JSON.parse(
              sessionStorage.getItem('conditions')
            )
            nextState.conditions = {
              persistent: _get(response, 'data.data.data'),
              session: sessionConditions,
            }
          })
          .catch((error) => {
            console.error(error)
          })
      }

      if (this.state.activePage !== prevState.activePage) {
        nextState.isFilterLockingMenuOpen = false
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
      document.removeEventListener('visibilitychange', this.onWindowResize)
      window.removeEventListener('resize', this.onWindowResize)

      clearTimeout(this.scrollToBottomTimeout)
      clearTimeout(this.windowResizeTimer)
      clearTimeout(this.responseTimeout)
      clearTimeout(this.feedbackTimeout)
      clearTimeout(this.animateTextTimeout)
      clearTimeout(this.exploreQueriesTimeout)
      clearTimeout(this.executeQueryTimeout)
      clearTimeout(this.rebuildTooltipsTimer)
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }
  }

  rebuildTooltips = () => {
    clearTimeout(this.rebuildTooltipsTimer)
    this.rebuildTooltipsTimer = setTimeout(() => {
      ReactTooltip.rebuild()
    }, 500)
  }

  setMaxWidthAndHeightFromDocument = () => {
    this.maxWidth =
      Math.max(document.documentElement.clientWidth, window.innerWidth || 0) -
      45
    this.maxHeight =
      Math.max(document.documentElement.clientHeight, window.innerHeight || 0) -
      45
  }

  onWindowResize = () => {
    if (!this.state.isWindowResizing) {
      this.setState({
        isWindowResizing: true,
      })
    }

    clearTimeout(this.windowResizeTimer)
    this.windowResizeTimer = setTimeout(() => {
      this.setMaxWidthAndHeightFromDocument()
      this.setState({
        isWindowResizing: false,
        containerHeight: this.getScrollContainerHeight(),
        containerWidth: this.getScrollContainerWidth(),
      })
    }, 300)
  }

  escFunction = (event) => {
    if (this.state.isVisible && event.keyCode === 27) {
      // todo: add this functionality back
      // cancelQuery()
    }
  }

  createIntroMessage = ({ type, content }) => {
    return {
      id: uuid.v4(),
      isResponse: true,
      type: type || 'text',
      content: content || '',
      isIntroMessage: true,
    }
  }

  createTopicsMessage = (response) => {
    const enableExploreQueries = this.props.enableExploreQueriesTab
    const topics = response.map((topic) => {
      return {
        label: topic.name,
        value: uuid.v4(),
        children: topic.queries.map((query) => ({
          label: query.query,
          value: uuid.v4(),
        })),
      }
    })

    try {
      const content = (
        <div>
          {lang.introPrompt}
          <br />
          <div className="topics-container">
            {
              <Cascader
                options={topics}
                onFinalOptionClick={(option) => {
                  this.onSuggestionClick({
                    query: option.label,
                    source: 'welcome_prompt',
                  })
                }}
                onSeeMoreClick={
                  enableExploreQueries
                    ? (label) => this.runTopicInExporeQueries(label)
                    : undefined
                }
              />
            }
          </div>
          {enableExploreQueries && (
            <div>
              {lang.use}{' '}
              <span
                className="intro-qi-link"
                onClick={() => this.setState({ activePage: 'explore-queries' })}
              >
                <Icon type="light-bulb" style={{ marginRight: '-3px' }} />{' '}
                {lang.exploreQueries}
              </span>{' '}
              {lang.explorePrompt}
            </div>
          )}
        </div>
      )

      return content
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  setIntroMessages = () => {
    let introMessageContent = this.props.introMessage
      ? `${this.props.introMessage}`
      : `Hi ${this.props.userDisplayName ||
          'there'}! Let’s dive into your data. What can I help you discover today?`

    let introMessages = [
      this.createIntroMessage({
        type: 'text',
        content: introMessageContent,
      }),
    ]
    if (this.state.topicsMessageContent) {
      introMessages.push(
        this.createIntroMessage({
          content: this.state.topicsMessageContent,
        })
      )
    }
    this.setState({
      messages: introMessages,
      lastMessageId: introMessages[introMessages.length - 1].id,
      isOptionsDropdownOpen: false,
      isFilterLockingMenuOpen: false,
    })
  }
  toggleFullScreen = (isFullScreen, maxWidth, maxHeight) => {
    this.setState({
      width: isFullScreen ? this.props.width : maxWidth,
      height: isFullScreen ? this.props.height : maxHeight,
      isSizeMaximum: isFullScreen ? false : true,
    })
  }

  getHandlerProp = () => {
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
    // this.props.onVisibleChange(isOpen)

    if (!isOpen) {
      this.setState({
        isFilterLockingMenuOpen: false,
        selectedValueLabel: undefined,
        isVisible: false,
      })
    } else {
      this.setState({ isVisible: true })
    }
  }

  scrollToBottom = () => {
    if (this.messengerScrollComponent) {
      this.messengerScrollComponent.scrollToBottom()
    }
  }

  onInputSubmit = (text) => {
    this.addRequestMessage(text)
    this.setState({ isChataThinking: true })
  }

  onSuggestionClick = ({
    query,
    userSelection,
    skipQueryValidation,
    source,
  }) => {
    if (this.queryInputRef) {
      this.queryInputRef.animateInputTextAndSubmit({
        query,
        userSelection,
        skipQueryValidation,
        source,
      })
    }
  }

  getIsSuggestionResponse = (response) => {
    return !!_get(response, 'data.data.items')
  }
  getIsDownloadingCSVResponse = (response) => {
    return !!_get(response, 'config.onDownloadProgress')
  }
  onResponse = (response, query) => {
    if (this.getIsSuggestionResponse(response)) {
      this.addResponseMessage({
        content: 'I want to make sure I understood your query. Did you mean:',
      })
    }
    if (_has(_get(response, 'data.data'), 'authorization_url')) {
      this.addResponseMessage({
        content: (
          <span>
            Looks like you’re trying to query a Microsoft Dynamics data source.{' '}
            <br />
            <br />
            <a
              href={_get(response, 'data.data.authorization_url')}
              target="_blank"
            >
              Click here to authorize access
            </a>
            , then try querying again.
          </span>
        ),
      })
    } else {
      this.addResponseMessage({ response, query })
    }

    this.setState({ isChataThinking: false })
    if (this.queryInputRef) {
      this.queryInputRef.focus()
    }
  }

  runDrilldownFromAPI = (data, queryID) => {
    runDrilldown({
      ...getAuthentication(getAuthentication(this.props.authentication)),
      ...getAutoQLConfig(getAutoQLConfig(this.props.autoQLConfig)),
      queryID,
      data,
    })
      .then((response) => {
        this.addResponseMessage({
          response: { ...response, enableDrilldowns: true },
        })
        this.setState({ isChataThinking: false })
      })
      .catch((error) => {
        console.error(error)
        this.addResponseMessage({
          content: _get(error, 'message'),
        })
        this.setState({ isChataThinking: false })
      })
  }

  runFilterDrilldown = (drilldownData, messageId) => {
    const response = this.state.messages.find(
      (message) => message.id === messageId
    ).response

    if (!response) {
      return
    }

    const drilldownResponse = filterDataForDrilldown(response, drilldownData)

    clearTimeout(this.responseTimeout)
    this.responseTimeout = setTimeout(() => {
      this.addResponseMessage({
        response: drilldownResponse,
      })
      this.setState({ isChataThinking: false })
    }, 1500)
  }

  processDrilldown = (drilldownData, queryID, messageId) => {
    if (
      getAutoQLConfig(getAutoQLConfig(this.props.autoQLConfig)).enableDrilldowns
    ) {
      if (!drilldownData || !drilldownData.data) {
        return
      }

      this.setState({ isChataThinking: true })

      if (!drilldownData.supportedByAPI) {
        this.runFilterDrilldown(drilldownData.data, messageId)
      } else {
        this.runDrilldownFromAPI(drilldownData.data, queryID)
      }
    }
  }

  clearMessages = () => {
    if (this.queryInputRef) {
      this.queryInputRef.focus()
    }

    this.setIntroMessages()
  }

  deleteMessage = (id) => {
    const messagesToDelete = [id]
    const messageIndex = this.state.messages.findIndex(
      (message) => message.id === id
    )

    // If there is a query message right above it (not a drilldown), delete the query message also
    const messageAbove = this.state.messages[messageIndex - 1]

    // If the messageAbove is not undefined
    if (messageAbove) {
      if (!messageAbove.isResponse) {
        messagesToDelete.push(messageAbove.id)
      }
    }

    const newMessages = this.state.messages.filter(
      (message) => !messagesToDelete.includes(message.id)
    )

    this.setState({
      messages: newMessages,
    })
  }

  createErrorMessage = (content) => {
    return {
      content: content || errorMessages.GENERAL_QUERY,
      id: uuid.v4(),
      type: 'error',
      isResponse: true,
    }
  }

  createMessage = ({
    response,
    content,
    query,
    isCSVProgressMessage,
    queryId,
    appliedFilters,
    linkedQueryResponseRef,
  }) => {
    const id = uuid.v4()
    this.setState({ lastMessageId: id })

    return {
      content,
      response,
      query,
      id,
      appliedFilters,
      type: _get(response, 'data.data.display_type'),
      isResponse: true,
      isCSVProgressMessage,
      queryId,
      linkedQueryResponseRef,
    }
  }

  addRequestMessage = (text) => {
    let currentMessages = this.state.messages
    if (
      this.props.maxMessages > 1 &&
      this.state.messages.length === this.props.maxMessages
    ) {
      // shift item from beginning of messages array
      currentMessages.shift()
    }

    const message = {
      content: text,
      id: uuid.v4(),
      isResponse: false,
    }

    this.setState({
      messages: [...currentMessages, message],
    })
  }

  addResponseMessage = ({
    response,
    content,
    query,
    isCSVProgressMessage,
    queryId,
    linkedQueryResponseRef,
  }) => {
    let currentMessages = this.state.messages

    if (
      this.props.maxMessages > 1 &&
      this.state.messages.length === this.props.maxMessages
    ) {
      currentMessages.shift()
    }

    let message = {}
    if (_get(response, 'error') === 'cancelled') {
      message = this.createErrorMessage('Query Cancelled.')
    } else if (_get(response, 'error') === 'Unauthenticated') {
      message = this.createErrorMessage(errorMessages.UNAUTHENTICATED)
    } else if (_get(response, 'error') === 'Parse error') {
      // Invalid response JSON
      message = this.createErrorMessage()
    } else if (isCSVProgressMessage) {
      message = this.createMessage({
        content,
        query,
        isCSVProgressMessage,
        queryId,
        linkedQueryResponseRef,
      })
    } else if (!response && !content) {
      message = this.createErrorMessage()
    } else {
      const appliedFilters = [
        ..._get(response, 'data.data.persistent_locked_conditions', []),
        ..._get(response, 'data.data.session_locked_conditions', []),
      ]
      message = this.createMessage({ response, content, query, appliedFilters })
    }

    this.setState({
      messages: [...currentMessages, message],
    })
  }

  setActiveMessage = (id) => {
    this.setState({ activeMessageId: id })
  }

  setQueryInputRef = (ref) => {
    this.queryInputRef = ref
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

  getFilterMenuPosition = () => {
    switch (this.state.placement) {
      case 'right':
        return {
          transform: 'translate(1%, -3%)',
        }
      case 'left':
        return {
          transform: 'translate(-1%, -3%)',
        }
      case 'top':
        return {
          transform: 'translate(1.5%, -3%)',
          minWidth: '100vw',
        }
      case 'bottom':
        return {
          transform: 'translate(1.5%, -3%)',
          minWidth: '100vw',
        }
      default:
      // code block
    }
  }

  onRTValueLabelClick = (text) => {
    this.setState({
      isFilterLockingMenuOpen: true,
      selectedValueLabel: text,
    })
  }

  renderTabs = () => {
    const page = this.state.activePage

    if (this.state.isVisible) {
      return (
        <div className={`data-messenger-tab-container ${this.props.placement}`}>
          <div
            className={`page-switcher-shadow-container  ${this.props.placement}`}
          >
            <div className={`page-switcher-container ${this.props.placement}`}>
              <div
                className={`tab${page === 'data-messenger' ? ' active' : ''}`}
                onClick={() => this.setState({ activePage: 'data-messenger' })}
                data-tip="Data Messenger"
                data-for="react-autoql-header-tooltip"
                data-delay-show={1000}
              >
                <Icon type="react-autoql-bubbles-outlined" />
              </div>
              {this.props.enableExploreQueriesTab && (
                <div
                  className={`tab${
                    page === 'explore-queries' ? ' active' : ''
                  } react-autoql-explore-queries`}
                  onClick={() =>
                    this.setState({ activePage: 'explore-queries' })
                  }
                  data-tip={lang.exploreQueries}
                  data-for="react-autoql-header-tooltip"
                  data-delay-show={1000}
                >
                  <Icon type="light-bulb" size={22} />
                </div>
              )}
              {this.props.enableNotificationsTab &&
                getAutoQLConfig(getAutoQLConfig(this.props.autoQLConfig))
                  .enableNotifications && (
                  <div
                    className={`tab${
                      page === 'notifications' ? ' active' : ''
                    } react-autoql-notifications`}
                    onClick={() => {
                      if (this.notificationBadgeRef) {
                        this.notificationBadgeRef.resetCount()
                      }
                      this.setState({ activePage: 'notifications' })
                    }}
                    data-tip="Notifications"
                    data-for="react-autoql-header-tooltip"
                    data-delay-show={1000}
                    style={{ paddingBottom: '5px', paddingLeft: '2px' }}
                  >
                    <div className="data-messenger-notification-btn">
                      <NotificationIcon
                        ref={(r) => (this.notificationBadgeRef = r)}
                        authentication={getAuthentication(
                          getAuthentication(this.props.authentication)
                        )}
                        themeConfig={getThemeConfig(
                          getThemeConfig(this.props.themeConfig)
                        )}
                        clearCountOnClick={false}
                        style={{ fontSize: '19px' }}
                        overflowCount={9}
                        useDot
                        isAlreadyMountedInDOM={React.isValidElement(
                          <NotificationIcon />
                        )}
                        onNewNotification={() => {
                          // If a new notification is detected, refresh the list
                          if (
                            this.notificationListRef &&
                            this.state.activePage === 'notifications'
                          ) {
                            this.notificationListRef.refreshNotifications()
                          }
                        }}
                        onErrorCallback={this.props.onErrorCallback}
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )
    }
  }

  renderOptionsDropdown = () => {
    if (this.state.activePage === 'data-messenger') {
      return (
        <>
          <div
            id="react-autoql-filter-menu-dropdown"
            style={{ justifyContent: 'left', position: 'absolute', right: 30 }}
          >
            {getAutoQLConfig(this.props.autoQLConfig).enableFilterLocking ? (
              <button
                id="react-autoql-filter-menu-dropdown-button"
                onClick={(e) => {
                  e.stopPropagation()
                  this.setState({
                    isFilterLockingMenuOpen: !this.state
                      .isFilterLockingMenuOpen,
                  })
                }}
                className="react-autoql-drawer-header-btn clear-all"
                data-tip={lang.openFilterLocking}
                data-for="react-autoql-header-tooltip"
              >
                <Icon
                  type={
                    _get(this.state.conditions, 'persistent.length') > 0 ||
                    _get(this.state.conditions, 'session.length') > 0
                      ? 'lock'
                      : 'unlock'
                  }
                />
              </button>
            ) : (
              <span />
            )}
          </div>
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
              className="react-autoql-drawer-header-btn clear-all"
              data-tip={lang.clearDataResponses}
              data-for="react-autoql-header-tooltip"
            >
              <Icon type="trash" />
            </button>
          </Popover>
        </>
      )
    }
  }

  renderHeaderTitle = () => {
    let title = ''
    if (this.state.activePage === 'data-messenger') {
      title = this.props.title
    }
    if (this.state.activePage === 'explore-queries') {
      title = lang.exploreQueries
    }
    if (this.state.activePage === 'notifications') {
      title = 'Notifications'
    }
    return <div className="header-title">{title}</div>
  }

  renderHeaderContent = () => {
    const maxWidth =
      Math.max(document.documentElement.clientWidth, window.innerWidth || 0) -
      45
    const maxHeight =
      Math.max(document.documentElement.clientHeight, window.innerHeight || 0) -
      45
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
        {!getAutoQLConfig(getAutoQLConfig(this.props.autoQLConfig))
          .enableFilterLocking && this.state.isFilterLockingMenuOpen ? (
          <div className="react-autoql-header-center-container">
            {this.renderHeaderTitle()}
          </div>
        ) : (
          <Popover
            containerStyle={this.getFilterMenuPosition()}
            isOpen={this.state.isFilterLockingMenuOpen}
            onClickOutside={(e) => {
              if (this.state.isFilterLockingMenuOpen) {
                this.setState({ isFilterLockingMenuOpen: false })
              }
            }}
            position="bottom"
            padding={2}
            align="center"
            content={
              <div id="condition-menu-dropdown" style={{ display: 'block' }}>
                <ConditionLockMenu
                  data-test="react-autoql-filter-menu"
                  id="react-autoql-filter-menu"
                  authentication={getAuthentication(
                    getAuthentication(this.props.authentication)
                  )}
                  containerWidth={this.getDrawerWidth()}
                  isOpen={this.state.isFilterLockingMenuOpen}
                  themeConfig={getThemeConfig(
                    getThemeConfig(this.props.themeConfig)
                  )}
                  initFilterText={this.state.selectedValueLabel}
                  onClose={() => {
                    this.setState({
                      isFilterLockingMenuOpen: false,
                      selectedValueLabel: undefined,
                    })
                  }}
                />
              </div>
            }
          >
            <div className="react-autoql-header-center-container">
              {this.renderHeaderTitle()}
            </div>
          </Popover>
        )}
        <div className="react-autoql-header-right-container">
          {this.renderOptionsDropdown()}
        </div>
      </Fragment>
    )
  }

  renderBodyContent = () => {
    switch (this.state.activePage) {
      case 'data-messenger': {
        return this.renderDataMessengerContent()
      }
      case 'explore-queries': {
        return this.renderQueryTipsContent()
      }
      case 'notifications': {
        return this.renderNotificationsContent()
      }
    }
  }

  onNoneOfTheseClick = () => {
    this.setState({ isChataThinking: true })

    clearTimeout(this.feedbackTimeout)
    this.feedbackTimeout = setTimeout(() => {
      this.setState({ isChataThinking: false })
      this.addResponseMessage({ content: 'Thank you for your feedback' })
    }, 1000)
  }

  setCSVDownloadProgress = (id, percentCompleted) => {
    this.csvProgressLog[id] = percentCompleted
    if (this.messageRefs[id]) {
      this.messageRefs[id].setState({
        csvDownloadProgress: percentCompleted,
      })
    }
  }

  renderDataMessengerContent = () => {
    return (
      <Fragment>
        <CustomScrollbars
          innerRef={(c) => {
            this.messengerScrollComponent = c
          }}
          className="chat-message-container"
          renderView={(props) => (
            <div {...props} className="custom-scrollbar-container" />
          )}
        >
          {this.state.messages.length > 0 &&
            this.state.messages.map((message) => {
              return (
                <ChatMessage
                  key={message.id}
                  id={message.id}
                  ref={(r) => (this.messageRefs[message.id] = r)}
                  isIntroMessage={message.isIntroMessage}
                  authentication={getAuthentication(
                    getAuthentication(this.props.authentication)
                  )}
                  autoQLConfig={getAutoQLConfig(
                    getAutoQLConfig(this.props.autoQLConfig)
                  )}
                  themeConfig={getThemeConfig(
                    getThemeConfig(this.props.themeConfig)
                  )}
                  linkedQueryResponseRef={message.linkedQueryResponseRef}
                  isCSVProgressMessage={message.isCSVProgressMessage}
                  initialCSVDownloadProgress={this.csvProgressLog[message.id]}
                  setCSVDownloadProgress={this.setCSVDownloadProgress}
                  queryId={message.queryId}
                  queryText={message.query}
                  scrollRef={this.messengerScrollComponent}
                  isDataMessengerOpen={this.state.isVisible}
                  setActiveMessage={this.setActiveMessage}
                  isActive={this.state.activeMessageId === message.id}
                  addMessageToDM={this.addResponseMessage}
                  processDrilldown={(drilldownData, queryID) =>
                    this.processDrilldown(drilldownData, queryID, message.id)
                  }
                  isResponse={message.isResponse}
                  isChataThinking={this.state.isChataThinking}
                  onSuggestionClick={this.onSuggestionClick}
                  content={message.content}
                  scrollToBottom={this.scrollToBottom}
                  lastMessageId={this.state.lastMessageId}
                  onQueryOutputUpdate={this.rebuildTooltips}
                  dataFormatting={getDataFormatting(
                    getDataFormatting(this.props.dataFormatting)
                  )}
                  displayType={
                    message.displayType ||
                    _get(message, 'response.data.data.display_type')
                  }
                  onResponseCallback={this.onResponse}
                  response={message.response}
                  type={message.type}
                  onErrorCallback={this.props.onErrorCallback}
                  onSuccessAlert={this.props.onSuccessAlert}
                  deleteMessageCallback={this.deleteMessage}
                  scrollContainerRef={this.messengerScrollComponent}
                  isResizing={
                    this.state.isResizing || this.state.isWindowResizing
                  }
                  enableDynamicCharting={this.props.enableDynamicCharting}
                  onNoneOfTheseClick={this.onNoneOfTheseClick}
                  autoChartAggregations={this.props.autoChartAggregations}
                  messageContainerHeight={this.state.containerHeight}
                  messageContainerWidth={this.state.containerWidth}
                  onRTValueLabelClick={this.onRTValueLabelClick}
                  appliedFilters={message.appliedFilters}
                />
              )
            })}
        </CustomScrollbars>
        {this.state.isChataThinking && (
          <div className="response-loading-container">
            <div className="response-loading">
              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
        )}
        <div className="chat-bar-container">
          <div className="watermark">
            <Icon type="react-autoql-bubbles-outlined" />
            {lang.run}
          </div>
          <QueryInput
            authentication={getAuthentication(
              getAuthentication(this.props.authentication)
            )}
            autoQLConfig={getAutoQLConfig(
              getAutoQLConfig(this.props.autoQLConfig)
            )}
            themeConfig={getThemeConfig(getThemeConfig(this.props.themeConfig))}
            ref={this.setQueryInputRef}
            className="chat-drawer-chat-bar"
            onSubmit={this.onInputSubmit}
            onResponseCallback={this.onResponse}
            isDisabled={this.state.isChataThinking}
            enableVoiceRecord={this.props.enableVoiceRecord}
            autoCompletePlacement="above"
            showChataIcon={false}
            showLoadingDots={false}
            placeholder={this.props.inputPlaceholder}
            onErrorCallback={this.props.onErrorCallback}
            hideInput={this.props.hideInput}
            source={['data_messenger']}
            AutoAEId={this.props.AutoAEId}
          />
        </div>
      </Fragment>
    )
  }

  fetchQueryTipsList = (keywords, pageNumber, skipQueryValidation) => {
    this.setState({ queryTipsLoading: true, queryTipsKeywords: keywords })

    // todo: use infinite scroll to simplify this
    let pageSize = 10
    if (this.queryTipsPage) {
      pageSize = Math.floor((this.queryTipsPage.clientHeight - 150) / 50)
    }

    fetchQueryTips({
      ...getAuthentication(this.props.authentication),
      keywords,
      pageSize,
      pageNumber,
      skipQueryValidation,
    })
      .then((response) => {
        // if caught by validation...
        if (_get(response, 'data.full_suggestion')) {
          this.setState({
            queryTipsLoading: false,
            queryTipsQueryValidationResponse: response,
          })
        } else {
          const totalQueries = Number(
            _get(response, 'data.data.pagination.total_items')
          )
          const totalPages = Number(
            _get(response, 'data.data.pagination.total_pages')
          )
          const pageNumber = Number(
            _get(response, 'data.data.pagination.current_page')
          )

          this.setState({
            queryTipsList: _get(response, 'data.data.items'),
            queryTipsLoading: false,
            queryTipsError: false,
            queryTipsTotalPages: totalPages,
            queryTipsCurrentPage: pageNumber,
            queryTipsTotalQueries: totalQueries,
            queryTipsQueryValidationResponse: undefined,
          })
        }
      })
      .catch((error) => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({
          queryTipsLoading: false,
          queryTipsError: true,
          queryTipsQueryValidationResponse: undefined,
        })
      })
  }

  onQueryTipsInputKeyPress = (e) => {
    if (e.key == 'Enter') {
      this.fetchQueryTipsList(e.target.value, 1)
    } else {
      this.setState({ queryTipsInputValue: e.target.value })
    }
  }

  onQueryTipsPageChange = ({ selected }) => {
    const nextPage = selected + 1 // Because ReactPaginate is 0 indexed
    this.fetchQueryTipsList(this.state.queryTipsKeywords, nextPage, true)
  }

  onQueryTipsQueryValidationSuggestionClick = (queryValidationObj) => {
    const keywords = queryValidationObj.query
    this.setState({ queryTipsInputValue: keywords })
    this.fetchQueryTipsList(keywords, 1, true)
  }

  animateQITextAndSubmit = (text) => {
    if (typeof text === 'string' && _get(text, 'length')) {
      for (let i = 1; i <= text.length; i++) {
        clearTimeout(this.animateTextTimeout)
        this.animateTextTimeout = setTimeout(() => {
          this.setState({
            queryTipsInputValue: text.slice(0, i),
          })
          if (i === text.length) {
            this.fetchQueryTipsList(text, 1)
          }
        }, i * 50)
      }
    }
  }

  runTopicInExporeQueries = (topic) => {
    this.setState({ activePage: 'explore-queries' })

    clearTimeout(this.exploreQueriesTimeout)
    this.exploreQueriesTimeout = setTimeout(() => {
      this.animateQITextAndSubmit(topic)
    }, 500)
  }

  renderQueryTipsContent = () => (
    <QueryTipsTab
      themeConfig={getThemeConfig(getThemeConfig(this.props.themeConfig))}
      onQueryTipsInputKeyPress={this.onQueryTipsInputKeyPress}
      queryTipsQueryValidationResponse={
        this.state.queryTipsQueryValidationResponse
      }
      onQueryValidationSuggestionClick={
        this.onQueryTipsQueryValidationSuggestionClick
      }
      loading={this.state.queryTipsLoading}
      error={this.state.queryTipsError}
      queryTipsList={this.state.queryTipsList}
      queryTipsInputValue={this.state.queryTipsInputValue}
      totalPages={this.state.queryTipsTotalPages}
      currentPage={this.state.queryTipsCurrentPage}
      queryTipsPageRef={(r) => (this.queryTipsPage = r)}
      onPageChange={this.onQueryTipsPageChange}
      executeQuery={(query) => {
        this.setState({ activePage: 'data-messenger' })
        clearTimeout(this.executeQueryTimeout)
        this.executeQueryTimeout = setTimeout(() => {
          this.onSuggestionClick({ query, source: 'explore_queries' })
        }, 500)
      }}
    />
  )

  renderNotificationsContent = () => {
    return (
      <NotificationFeed
        ref={(ref) => (this.notificationListRef = ref)}
        authentication={getAuthentication(this.props.authentication)}
        themeConfig={getThemeConfig(getThemeConfig(this.props.themeConfig))}
        onExpandCallback={this.props.onNotificationExpandCallback}
        onCollapseCallback={this.props.onNotificationCollapseCallback}
        activeNotificationData={this.props.activeNotificationData}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessCallback={this.props.onSuccessCallback}
        showNotificationDetails={false}
      />
    )
  }

  resizeDrawer = (e) => {
    const { placement } = this.state

    if (placement === 'right') {
      const offset = _get(this.state.startingResizePosition, 'x') - e.pageX
      let newWidth = _get(this.state.startingResizePosition, 'width') + offset
      if (newWidth > this.maxWidth) newWidth = this.maxWidth
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
      if (newWidth > this.maxWidth) newWidth = this.maxWidth
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
      if (newHeight > this.maxHeight) newHeight = this.maxHeight
      if (newHeight < this.minHeight) newHeight = this.minHeight
      if (Number(newHeight)) {
        this.setState({
          height: newHeight,
          containerHeight: newHeight,
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
          containerHeight: newHeight,
          isSizeMaximum: false,
        })
      }
    }
  }

  getScrollContainerHeight = () => {
    if (this.messengerScrollComponent) {
      return this.messengerScrollComponent.getClientHeight()
    }
  }

  getScrollContainerWidth = () => {
    if (this.messengerScrollComponent) {
      return this.messengerScrollComponent.getClientWidth()
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
        containerHeight: this.state.height,
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
          delayShow={500}
          place="top"
        />
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="react-autoql-toolbar-btn-tooltip"
          effect="solid"
          delayShow={500}
          place="top"
          html
        />
        <ReactTooltip
          className="react-autoql-chart-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
      </Fragment>
    )
  }

  renderDataAlertModal = () => {
    return (
      <DataAlertModal
        authentication={getAuthentication(this.props.authentication)}
        themeConfig={getThemeConfig(getThemeConfig(this.props.themeConfig))}
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
        <Fragment>
          {this.renderTooltips()}
          {setLanguage()}
          <Drawer
            ref={(ref) => (this.dmRef = ref)}
            id={`react-autoql-drawer-${this.DATA_MESSENGER_ID}`}
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
            handler={this.getHandlerProp()}
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
        </Fragment>
      </ErrorBoundary>
    )
  }
}
