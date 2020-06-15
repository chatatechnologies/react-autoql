import React, { Fragment } from 'react'
import { number, bool, string, func, shape, array } from 'prop-types'
import uuid from 'uuid'
import Drawer from 'rc-drawer'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import _get from 'lodash.get'
import { Scrollbars } from 'react-custom-scrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
// import { throttle, debounce } from 'throttle-debounce'

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
} from '../../props/defaults'

import { LIGHT_THEME, DARK_THEME } from '../../js/Themes'
import { setStyleVars, filterDataForDrilldown } from '../../js/Util'
import errorMessages from '../../js/errorMessages'

// Components
import { Icon } from '../Icon'
import { QueryInput } from '../QueryInput'
import { ChatMessage } from '../ChatMessage'
import { Button } from '../Button'
import { QueryTipsTab } from '../QueryTipsTab'
import { Cascader } from '../Cascader'
import { NotificationModal } from '../Notifications/NotificationModal'
import { NotificationButton } from '../Notifications/NotificationButton'
import { NotificationList } from '../Notifications/NotificationList'
import {
  runDrilldown,
  cancelQuery,
  fetchQueryTips,
  fetchSuggestions,
} from '../../js/queryService'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'

export default class DataMessenger extends React.Component {
  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,
    themeConfig: themeConfigType,

    // UI
    placement: string,
    maskClosable: bool,
    isVisible: bool,
    width: number,
    height: number,
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
    queryQuickStartTopics: array,
    enableDynamicCharting: bool,
    defaultTab: string,

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
    enableNotificationsTab: true,
    resizable: true,
    inputPlaceholder: undefined,
    queryQuickStartTopics: undefined,
    enableDynamicCharting: true,
    defaultTab: 'data-messenger',

    // Callbacks
    onHandleClick: () => {},
    onVisibleChange: () => {},
    onErrorCallback: () => {},
    onSuccessAlert: () => {},
  }

  state = {
    hasError: false,

    activePage: this.props.defaultTab,
    width: this.props.width,
    height: this.props.height,
    isResizing: false,

    lastMessageId: undefined,
    isClearMessageConfirmVisible: false,
    messages: [],

    queryTipsList: undefined,
    queryTipsLoading: false,
    queryTipsError: false,
    queryTipsTotalPages: undefined,
    queryTipsCurrentPage: 1,
  }

  componentDidMount = () => {
    try {
      this.setStyles()
      this.setintroMessages()

      // Listen for esc press to cancel queries while they are running
      document.addEventListener('keydown', this.escFunction, false)

      // There is a bug with react tooltips where it doesnt bind properly right when the component mounts
      setTimeout(() => {
        ReactTooltip.rebuild()
      }, 100)
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }
  }

  componentDidUpdate = (prevProps, prevState) => {
    try {
      setTimeout(() => {
        ReactTooltip.rebuild()
      }, 1000)

      if (
        this.state.activePage === 'data-messenger' &&
        prevState.activePage !== 'data-messenger'
      ) {
        this.scrollToBottom()
      }

      if (this.props.isVisible && !prevProps.isVisible) {
        if (this.queryInputRef) {
          this.queryInputRef.focus()
        }
      }

      if (
        !this.props.isVisible &&
        prevProps.isVisible &&
        this.props.clearOnClose
      ) {
        this.clearMessages()
      }

      const thisTheme = this.props.themeConfig.theme
      const prevTheme = prevProps.themeConfig.theme
      if (thisTheme && thisTheme !== prevTheme) {
        this.setStyles()
      }
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }
  }

  componentWillUnmount() {
    try {
      document.removeEventListener('keydown', this.escFunction, false)
    } catch (error) {
      console.error(error)
      this.setState({ hasError: true })
    }
  }

  escFunction = event => {
    if (this.props.isVisible && event.keyCode === 27) {
      cancelQuery()
    }
  }

  createIntroMessage = ({ type, content }) => {
    return {
      id: uuid.v4(),
      isResponse: true,
      type: type || 'text',
      content: content || '',
    }
  }

  createTopicsMessage = () => {
    const topics = this.props.queryQuickStartTopics.map(topic => {
      return {
        label: topic.topic,
        value: uuid.v4(),
        children: topic.queries.map(query => ({
          label: query,
          value: uuid.v4(),
        })),
      }
    })

    try {
      const content = (
        <div>
          Some things you can ask me:
          <br />
          <div className="topics-container">
            {
              <Cascader
                options={topics}
                onFinalOptionClick={option => {
                  this.onSuggestionClick(
                    option.label,
                    undefined,
                    undefined,
                    'welcome_prompt'
                  )
                }}
                onSeeMoreClick={label => this.runTopicInExporeQueries(label)}
              />
            }
          </div>
          Use{' '}
          <span
            className="intro-qi-link"
            onClick={() => this.setState({ activePage: 'explore-queries' })}
          >
            <Icon type="light-bulb" style={{ marginRight: '-3px' }} /> Explore
            Queries
          </span>{' '}
          to further explore the possibilities.
        </div>
      )

      return content
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  setintroMessages = () => {
    const introMessages = [
      this.createIntroMessage({
        content: this.props.introMessage
          ? `${this.props.introMessage}`
          : `Hi ${this.props.userDisplayName ||
              'there'}! Let’s dive into your data. What can I help you discover today?`,
      }),
    ]

    if (
      !this.props.introMessage &&
      _get(this.props.queryQuickStartTopics, 'length')
    ) {
      const topicsMessageContent = this.createTopicsMessage()

      if (topicsMessageContent) {
        introMessages.push(
          this.createIntroMessage({ content: topicsMessageContent })
        )
      }
    }

    this.setState({
      messages: introMessages,
      lastMessageId: introMessages[introMessages.length - 1].id,
      isClearMessageConfirmVisible: false,
    })
  }

  setStyles = () => {
    const { theme, accentColor, fontFamily } = this.props.themeConfig
    const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME
    if (accentColor) {
      themeStyles['accent-color'] = accentColor
    }
    if (fontFamily) {
      themeStyles['font-family'] = fontFamily
    }

    setStyleVars({ themeStyles, prefix: '--chata-messenger-' })
  }

  getHandlerProp = () => {
    if (this.props.customHandle !== undefined) {
      return this.props.customHandle
    } else if (this.props.showHandle) {
      return (
        <div
          className={`drawer-handle${this.props.isVisible ? ' hide' : ''}`}
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
            <Icon type="chata-bubbles-outlined" size={26} />
          )}
        </div>
      )
    }
    return false
  }

  getDrawerHeight = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
      return null
    }
    return this.state.height
  }

  getDrawerWidth = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
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

  handleMaskClick = () => {
    if (this.props.maskClosable === false) {
      return
    }
    if (this.props.onMakClick) {
      this.props.onMaskClick()
    }
    if (this.props.onHandleClick) {
      this.props.onHandleClick()
    }
  }

  scrollToBottom = () => {
    if (this.messengerScrollComponent) {
      this.messengerScrollComponent.scrollToBottom()
    }
    // Required to make animation smooth
    setTimeout(() => {
      if (this.messengerScrollComponent) {
        this.messengerScrollComponent.scrollToBottom()
      }
    }, 0)
  }

  onInputSubmit = text => {
    this.addRequestMessage(text)
    this.setState({ isChataThinking: true })
  }

  onSuggestionClick = (suggestion, isButtonClick, skipSafetyNet, source) => {
    if (this.queryInputRef) {
      this.queryInputRef.animateInputTextAndSubmit(
        suggestion,
        skipSafetyNet,
        source
      )
    }
  }

  onResponse = (response, query) => {
    this.addResponseMessage({ response, query })

    if (_get(response, 'reference_id') === '1.1.430') {
      // Fetch suggestion list now
      fetchSuggestions({
        query: response.originalQuery,
        ...this.props.authentication,
      })
        .then(response => {
          this.addResponseMessage({ response, query })
          this.setState({ isChataThinking: false })
          if (this.queryInputRef) {
            this.queryInputRef.focus()
          }
        })
        .catch(error => {
          this.addResponseMessage({
            content: _get(error, 'response.data.message'),
            query,
          })
          this.setState({ isChataThinking: false })
          if (this.queryInputRef) {
            this.queryInputRef.focus()
          }
        })
    } else {
      this.setState({ isChataThinking: false })
      if (this.queryInputRef) {
        this.queryInputRef.focus()
      }
    }
  }

  runDrilldownFromAPI = (data, queryID) => {
    runDrilldown({
      ...this.props.authentication,
      ...this.props.autoQLConfig,
      queryID,
      data,
    })
      .then(response => {
        this.addResponseMessage({
          response: { ...response, enableDrilldowns: true },
        })
        this.setState({ isChataThinking: false })
      })
      .catch(error => {
        console.error(error)
        this.addResponseMessage({
          content: _get(error, 'message'),
        })
        this.setState({ isChataThinking: false })
      })
  }

  runFilterDrilldown = (drilldownData, messageId) => {
    const response = this.state.messages.find(
      message => message.id === messageId
    ).response

    if (!response) {
      return
    }

    const drilldownResponse = filterDataForDrilldown(response, drilldownData)

    setTimeout(() => {
      this.addResponseMessage({
        response: drilldownResponse,
      })
      this.setState({ isChataThinking: false })
    }, 1500)
  }

  processDrilldown = (drilldownData, queryID, messageId) => {
    if (this.props.autoQLConfig.enableDrilldowns) {
      if (!drilldownData || !drilldownData.data) {
        return
      }

      const { data } = drilldownData
      this.setState({ isChataThinking: true })

      if (!drilldownData.supportedByAPI) {
        this.runFilterDrilldown(data, messageId)
      } else {
        this.runDrilldownFromAPI(data, queryID)
      }
    }
  }

  clearMessages = () => {
    if (this.queryInputRef) {
      this.queryInputRef.focus()
    }

    this.setintroMessages()
  }

  deleteMessage = id => {
    const messagesToDelete = [id]
    const messageIndex = this.state.messages.findIndex(
      message => message.id === id
    )

    // If there is a query message right above it (not a drilldown), delete the query message also
    const messageAbove = this.state.messages[messageIndex - 1]
    if (!messageAbove.isResponse) {
      messagesToDelete.push(messageAbove.id)
    }

    const newMessages = this.state.messages.filter(
      message => !messagesToDelete.includes(message.id)
    )

    this.setState({
      messages: newMessages,
    })
  }

  createErrorMessage = content => {
    return {
      content: content || errorMessages.GENERAL,
      id: uuid.v4(),
      type: 'error',
      isResponse: true,
    }
  }

  createMessage = ({ response, content, query }) => {
    const id = uuid.v4()
    this.setState({ lastMessageId: id })

    return {
      content,
      response,
      query,
      id,
      type: _get(response, 'data.data.display_type'),
      isResponse: true,
    }
  }

  addRequestMessage = text => {
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
    this.scrollToBottom()
  }

  addResponseMessage = ({ response, content, query }) => {
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
    } else if (_get(response, 'error') === 'unauthenticated') {
      message = this.createErrorMessage(errorMessages.UNAUTHENTICATED)
    } else if (_get(response, 'error') === 'parse error') {
      // Invalid response JSON
      message = this.createErrorMessage()
    } else if (!response && !content) {
      message = this.createErrorMessage()
    } else {
      message = this.createMessage({ response, content, query })
    }
    this.setState({
      messages: [...currentMessages, message],
    })
    this.scrollToBottom()
  }

  setActiveMessage = id => {
    this.setState({ activeMessageId: id })
  }

  setQueryInputRef = ref => {
    this.queryInputRef = ref
  }

  renderTabs = () => {
    const page = this.state.activePage

    if (this.props.isVisible) {
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
                data-for="chata-header-tooltip"
                data-delay-show={1000}
              >
                <Icon type="chata-bubbles-outlined" />
              </div>
              {this.props.enableExploreQueriesTab && (
                <div
                  className={`tab${
                    page === 'explore-queries' ? ' active' : ''
                  } tips`}
                  onClick={() =>
                    this.setState({ activePage: 'explore-queries' })
                  }
                  data-tip="Explore Queries"
                  data-for="chata-header-tooltip"
                  data-delay-show={1000}
                >
                  <Icon type="light-bulb" size={22} />
                </div>
              )}
              {this.props.enableNotificationsTab &&
                this.props.autoQLConfig.enableNotifications && (
                  <div
                    className={`tab${
                      page === 'notifications' ? ' active' : ''
                    } notifications`}
                    onClick={() => {
                      if (this.notificationBadgeRef) {
                        this.notificationBadgeRef.resetCount()
                      }
                      this.setState({ activePage: 'notifications' })
                    }}
                    data-tip="Notifications"
                    data-for="chata-header-tooltip"
                    data-delay-show={1000}
                    style={{ paddingBottom: '5px', paddingLeft: '2px' }}
                  >
                    <div className="data-messenger-notification-btn">
                      <NotificationButton
                        ref={r => (this.notificationBadgeRef = r)}
                        authentication={this.props.authentication}
                        themeConfig={this.props.themeConfig}
                        clearCountOnClick={false}
                        style={{ fontSize: '19px' }}
                        overflowCount={9}
                        useDot
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

  renderClearMessagesButton = () => {
    if (this.state.activePage === 'data-messenger') {
      return (
        <Popover
          isOpen={this.state.isClearMessageConfirmVisible}
          onClickOutside={() =>
            this.setState({ isClearMessageConfirmVisible: false })
          }
          position="bottom" // preferred position
          content={
            <div className="clear-messages-confirm-popover">
              <div className="chata-confirm-text">
                <Icon className="chata-confirm-icon" type="warning" />
                Clear all queries & responses?
              </div>
              <Button
                type="default"
                size="small"
                onClick={() =>
                  this.setState({ isClearMessageConfirmVisible: false })
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
          }
        >
          <button
            onClick={() =>
              this.setState({ isClearMessageConfirmVisible: true })
            }
            className="chata-button clear-all"
            data-tip="Clear data responses"
            data-for="chata-header-tooltip"
          >
            <Icon type="trash" />
          </button>
        </Popover>
      )
    }
  }

  renderHeaderTitle = () => {
    let title = ''
    if (this.state.activePage === 'data-messenger') {
      title = this.props.title
    }
    if (this.state.activePage === 'explore-queries') {
      title = 'Explore Queries'
    }
    if (this.state.activePage === 'notifications') {
      title = 'Notifications'
    }
    return <div className="header-title">{title}</div>
  }

  renderHeaderContent = () => {
    return (
      <Fragment>
        <div className="chata-header-left-container">
          <button
            onClick={this.props.onHandleClick}
            className="chata-button close"
            data-tip="Close Data Messenger"
            data-for="chata-header-tooltip"
          >
            <Icon type="close" />
          </button>
        </div>
        <div className="chata-header-center-container">
          {this.renderHeaderTitle()}
        </div>
        <div className="chata-header-right-container">
          {this.renderClearMessagesButton()}
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

  renderDataMessengerContent = () => {
    return (
      <Fragment>
        <Scrollbars
          ref={c => {
            this.messengerScrollComponent = c
          }}
          className="chat-message-container"
        >
          {this.state.messages.length > 0 &&
            this.state.messages.map(message => {
              return (
                <ChatMessage
                  key={message.id}
                  id={message.id}
                  authentication={this.props.authentication}
                  autoQLConfig={this.props.autoQLConfig}
                  themeConfig={this.props.themeConfig}
                  scrollRef={this.messengerScrollComponent}
                  setActiveMessage={this.setActiveMessage}
                  isActive={this.state.activeMessageId === message.id}
                  processDrilldown={(drilldownData, queryID) =>
                    this.processDrilldown(drilldownData, queryID, message.id)
                  }
                  isResponse={message.isResponse}
                  originalQuery={message.query}
                  isChataThinking={this.state.isChataThinking}
                  onSuggestionClick={this.onSuggestionClick}
                  content={message.content}
                  scrollToBottom={this.scrollToBottom}
                  lastMessageId={this.state.lastMessageId}
                  dataFormatting={this.props.dataFormatting}
                  displayType={
                    message.displayType ||
                    _get(message, 'response.data.data.display_type')
                  }
                  response={message.response}
                  type={message.type}
                  onErrorCallback={this.props.onErrorCallback}
                  onSuccessAlert={this.props.onSuccessAlert}
                  deleteMessageCallback={this.deleteMessage}
                  scrollContainerRef={this.messengerScrollComponent}
                  isResizing={this.state.isResizing}
                  enableDynamicCharting={this.props.enableDynamicCharting}
                />
              )
            })}
        </Scrollbars>
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
            <Icon type="chata-bubbles-outlined" />
            We run on AutoQL by Chata
          </div>
          <QueryInput
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            themeConfig={this.props.themeConfig}
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
          />
        </div>
      </Fragment>
    )
  }

  fetchQueryTipsList = (keywords, pageNumber, skipSafetyNet) => {
    this.setState({ queryTipsLoading: true, queryTipsKeywords: keywords })

    const containerElement = document.querySelector(
      '.query-tips-page-container'
    )
    const pageSize = Math.floor((containerElement.clientHeight - 150) / 50)

    fetchQueryTips({
      ...this.props.authentication,
      keywords,
      pageSize,
      pageNumber,
      skipSafetyNet,
    })
      .then(response => {
        // if caught by safetynet...
        if (_get(response, 'data.full_suggestion')) {
          this.setState({
            queryTipsLoading: false,
            queryTipsSafetyNetResponse: response,
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
            queryTipsSafetyNetResponse: undefined,
          })
        }
      })
      .catch(error => {
        console.error(error)
        this.props.onErrorCallback(error)
        this.setState({
          queryTipsLoading: false,
          queryTipsError: true,
          queryTipsSafetyNetResponse: undefined,
        })
      })
  }

  onQueryTipsInputKeyPress = e => {
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

  onQueryTipsSafetyNetSuggestionClick = keywords => {
    this.setState({ queryTipsInputValue: keywords })
    this.fetchQueryTipsList(keywords, 1, true)
  }

  animateQITextAndSubmit = text => {
    if (typeof text === 'string' && _get(text, 'length')) {
      for (let i = 1; i <= text.length; i++) {
        setTimeout(() => {
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

  runTopicInExporeQueries = topic => {
    this.setState({ activePage: 'explore-queries' })
    setTimeout(() => {
      this.animateQITextAndSubmit(topic)
    }, 500)
  }

  renderQueryTipsContent = () => (
    <QueryTipsTab
      onQueryTipsInputKeyPress={this.onQueryTipsInputKeyPress}
      queryTipsSafetyNetResponse={this.state.queryTipsSafetyNetResponse}
      onSafetyNetSuggestionClick={this.onQueryTipsSafetyNetSuggestionClick}
      loading={this.state.queryTipsLoading}
      error={this.state.queryTipsError}
      queryTipsList={this.state.queryTipsList}
      queryTipsInputValue={this.state.queryTipsInputValue}
      totalPages={this.state.queryTipsTotalPages}
      currentPage={this.state.queryTipsCurrentPage}
      onPageChange={this.onQueryTipsPageChange}
      executeQuery={query => {
        this.setState({ activePage: 'data-messenger' })
        setTimeout(() => {
          this.onSuggestionClick(query, undefined, undefined, 'explore_queries')
        }, 500)
      }}
    />
  )

  renderNotificationsContent = () => {
    return (
      <NotificationList
        ref={ref => (this.notificationListRef = ref)}
        authentication={this.props.authentication}
        themeConfig={this.props.themeConfig}
        onExpandCallback={this.props.onNotificationExpandCallback}
        onCollapseCallback={this.props.onNotificationCollapseCallback}
        activeNotificationData={this.props.activeNotificationData}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessCallback={this.props.onSuccessCallback}
        showNotificationDetails={false}
      />
    )
  }

  resizeDrawer = e => {
    const self = this
    const placement = this.getPlacementProp()
    const maxWidth =
      Math.max(document.documentElement.clientWidth, window.innerWidth || 0) -
      45
    const maxHeight =
      Math.max(document.documentElement.clientHeight, window.innerHeight || 0) -
      45

    if (placement === 'right') {
      const offset = _get(self.state.startingResizePosition, 'x') - e.pageX
      let newWidth = _get(self.state.startingResizePosition, 'width') + offset
      if (newWidth > maxWidth) newWidth = maxWidth
      if (Number(newWidth)) {
        self.setState({
          width: newWidth,
        })
      }
    } else if (placement === 'left') {
      const offset = e.pageX - _get(self.state.startingResizePosition, 'x')
      let newWidth = _get(self.state.startingResizePosition, 'width') + offset
      if (newWidth > maxWidth) newWidth = maxWidth
      if (Number(newWidth)) {
        self.setState({
          width: newWidth,
        })
      }
    } else if (placement === 'bottom') {
      const offset = _get(self.state.startingResizePosition, 'y') - e.pageY
      let newHeight = _get(self.state.startingResizePosition, 'height') + offset
      if (newHeight > maxHeight) newHeight = maxHeight
      if (Number(newHeight)) {
        self.setState({
          height: newHeight,
        })
      }
    } else if (placement === 'top') {
      const offset = e.pageY - _get(self.state.startingResizePosition, 'y')
      let newHeight = _get(self.state.startingResizePosition, 'height') + offset
      if (newHeight > maxHeight) newHeight = maxHeight
      if (Number(newHeight)) {
        self.setState({
          height: newHeight,
        })
      }
    }
  }

  stopResizingDrawer = () => {
    this.setState({
      isResizing: false,
    })
    window.removeEventListener('mousemove', this.resizeDrawer)
    window.removeEventListener('mouseup', this.stopResizingDrawer)
  }

  renderResizeHandle = () => {
    const self = this
    if (this.props.isVisible) {
      const placement = this.getPlacementProp()
      return (
        <div
          className={`chata-drawer-resize-handle ${placement}`}
          onMouseDown={e => {
            this.setState({
              isResizing: true,
              startingResizePosition: {
                x: e.pageX,
                y: e.pageY,
                width: this.state.width,
                height: this.state.height,
              },
            })
            window.addEventListener('mousemove', self.resizeDrawer)
            window.addEventListener('mouseup', self.stopResizingDrawer)
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
          className="chata-drawer-tooltip"
          id="chata-header-tooltip"
          effect="solid"
          delayShow={500}
          place="top"
        />
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-toolbar-btn-tooltip"
          effect="solid"
          delayShow={500}
          place="top"
          html
        />
        <ReactTooltip
          className="chata-chart-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
      </Fragment>
    )
  }

  renderNotificationModal = () => {
    return (
      <NotificationModal
        authentication={this.props.authentication}
        isVisible={this.state.isNotificationModalVisible}
        onClose={() => this.setState({ isNotificationModalVisible: false })}
        onSave={() => {
          this.props.onSuccessAlert('Notification created!')
          this.setState({ isNotificationModalVisible: false })
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
          <Drawer
            data-test="chata-drawer-test"
            className={`chata-drawer${
              this.state.isResizing ? ' disable-selection' : ''
            }`}
            open={this.props.isVisible}
            showMask={this.props.showMask}
            placement={this.getPlacementProp()}
            width={this.getDrawerWidth()}
            height={this.getDrawerHeight()}
            onMaskClick={this.handleMaskClick}
            onHandleClick={this.props.onHandleClick}
            afterVisibleChange={this.props.onVisibleChange}
            handler={this.getHandlerProp()}
            level={this.props.shiftScreen ? 'all' : null}
            keyboard={false}
          >
            {this.props.resizable && this.renderResizeHandle()}
            {(this.props.enableExploreQueriesTab ||
              this.props.enableNotificationsTab) &&
              this.renderTabs()}
            <div className="chata-drawer-content-container">
              <div className="chat-header-container">
                {this.renderHeaderContent()}
              </div>
              {this.renderBodyContent()}
            </div>
          </Drawer>
          {this.renderNotificationModal()}
        </Fragment>
      </ErrorBoundary>
    )
  }
}
