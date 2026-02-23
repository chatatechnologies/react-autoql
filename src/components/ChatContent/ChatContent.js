import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _has from 'lodash.has'
import _isEqual from 'lodash.isequal'
import { isMobile } from 'react-device-detect'
import {
  REQUEST_CANCELLED_ERROR,
  UNAUTHENTICATED_ERROR,
  GENERAL_QUERY_ERROR,
  dataFormattingDefault,
  getAuthentication,
  fetchSubjectList,
} from 'autoql-fe-utils'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'
import { lang } from '../../js/Localization'

// Components
import { Icon } from '../Icon'
import { QueryInput } from '../QueryInput'
import { ChatMessage } from '../ChatMessage'
import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

// Styles
import './ChatContent.scss'

const TOOLBAR_OFFSET = 90 // Offset in pixels to account for toolbar at the top

export default class ChatContent extends React.Component {
  constructor(props) {
    super(props)

    this.messageRefs = {}
    this.csvProgressLog = {}
    this.keepLoading = false
    this.scrollTimeout = null
    this.lastScrollMessageId = null
    this.lastScrollTime = 0

    this.state = {
      messages: [],
      subjects: [],
      isQueryRunning: false,
      isDrilldownRunning: false,
      isInputDisabled: false,
      isGeneratingSummary: false,
      isAtBottom: true,
    }
  }

  static propTypes = {
    authentication: authenticationType.isRequired,
    autoQLConfig: autoQLConfigType.isRequired,
    dataFormatting: dataFormattingType,
    enableVoiceRecord: PropTypes.bool.isRequired,
    maxMessages: PropTypes.number.isRequired,
    inputPlaceholder: PropTypes.string.isRequired,
    enableDynamicCharting: PropTypes.bool.isRequired,
    autoChartAggregations: PropTypes.bool.isRequired,
    enableFilterLocking: PropTypes.bool.isRequired,
    onErrorCallback: PropTypes.func.isRequired,
    onSuccessAlert: PropTypes.func.isRequired,
    onRTValueLabelClick: PropTypes.func,
    disableMaxMessageHeight: PropTypes.bool,
    dataPageSize: PropTypes.number,
    sessionId: PropTypes.string,
    isResizing: PropTypes.bool,
    source: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.string]),
    scope: PropTypes.string,
    shouldRender: PropTypes.bool,
    hideChatBarAfterInitialResponse: PropTypes.bool,
    executeQuery: PropTypes.func,
    enableMagicWand: PropTypes.bool,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    disableMaxMessageHeight: false,
    isResizing: false,
    dataPageSize: undefined,
    source: null,
    scope: undefined,
    onRTValueLabelClick: undefined,
    shouldRender: true,
    hideChatBarAfterInitialResponse: false,
    executeQuery: () => {},
    enableMagicWand: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.introMessages?.length) {
      this.addIntroMessages(this.props.introMessages)
    }

    //disable input focus for mobile, as ios keyboard has bug
    if (this.props.shouldRender && !isMobile) {
      this.focusInput()
    }

    this.fetchAllSubjects()
    this.setupScrollListener()
  }

  componentDidUpdate = (prevProps, prevState) => {
    //disable input focus for mobile, as ios keyboard has bug
    if (this.props.shouldRender && !prevProps.shouldRender && !isMobile) {
      this.focusInput()
    }

    if (!_isEqual(this.props.authentication, prevProps.authentication)) {
      this.fetchAllSubjects()
    }

    // Check if a new message was added (user request or system response) and scroll to it
    if (this.state.messages.length > prevState.messages.length) {
      const newMessages = this.state.messages.slice(prevState.messages.length)
      // Scroll to the last new message (whether it's a user request or system response)
      const lastNewMessage = newMessages[newMessages.length - 1]
      if (lastNewMessage) {
        // Clear any pending scrolls
        if (this.scrollTimeout) {
          clearTimeout(this.scrollTimeout)
          this.scrollTimeout = null
        }
        
        // Request messages don't have animations, so scroll immediately
        // Response messages need delay for CSS animation to complete
        if (!lastNewMessage.isResponse) {
          // Scroll immediately for request messages
          requestAnimationFrame(() => {
            this.scrollToMessageTop(lastNewMessage.id)
          })
        } else {
          // Use requestAnimationFrame to ensure DOM is ready, then wait for animation (500ms)
          requestAnimationFrame(() => {
            // Wait for CSS animation to complete (0.5s) plus small buffer for DOM to settle
            this.scrollTimeout = setTimeout(() => {
              this.scrollToMessageTop(lastNewMessage.id)
              this.scrollTimeout = null
            }, 550)
          })
        }
      }
    }

    // Setup scroll listener if not already set up
    if (this.messengerScrollComponent && !this.handleScroll) {
      this.setupScrollListener()
    }

    this.messengerScrollComponent?.update()
    // Check scroll position after update
    setTimeout(() => this.checkIfAtBottom(), 0)
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.feedbackTimeout)
    clearTimeout(this.responseDelayTimeout)
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }
    this.removeScrollListener()
  }

  fetchAllSubjects = () => {
    fetchSubjectList({ ...getAuthentication(this.props.authentication) })
      .then((subjects) => {
        if (this._isMounted) {
          if (subjects?.length) {
            const filteredSubjects = subjects.filter((subj) => !subj.isAggSeed())
            this.setState({ subjects: filteredSubjects })
          }
        }
      })
      .catch((error) => console.error(error))
  }

  focusInput = () => {
    if (this.queryInputRef?._isMounted) {
      this.queryInputRef.focus()
    }
  }

  scrollToBottom = () => {
    this.messengerScrollComponent?.scrollToBottom()
  }

  setupScrollListener = () => {
    // Don't set up if already set up
    if (this.handleScroll) return

    const container = this.messengerScrollComponent?.getContainer()
    if (container) {
      this.handleScroll = () => {
        this.checkIfAtBottom()
      }
      container.addEventListener('scroll', this.handleScroll)
      // Initial check
      this.checkIfAtBottom()
    }
  }

  removeScrollListener = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (container && this.handleScroll) {
      container.removeEventListener('scroll', this.handleScroll)
    }
  }

  checkIfAtBottom = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (!container) return

    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold

    if (this.state.isAtBottom !== isAtBottom) {
      this.setState({ isAtBottom })
    }
  }

  smoothScrollToBottom = () => {
    const container = this.messengerScrollComponent?.getContainer()
    if (!container) return

    const maxScrollTop = container.scrollHeight - container.clientHeight
    const startScrollTop = container.scrollTop
    const distance = maxScrollTop - startScrollTop
    const duration = 300 // ms
    const startTime = performance.now()

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      const currentScrollTop = startScrollTop + (distance * easeOut)
      container.scrollTop = currentScrollTop

      // Update scrollbars during animation
      this.messengerScrollComponent?.update()

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      } else {
        // Final update after animation completes
        container.scrollTop = maxScrollTop
        this.messengerScrollComponent?.update()
        this.checkIfAtBottom()
      }
    }

    requestAnimationFrame(animateScroll)
  }

  scrollToMessageFit = (messageId) => {
    // Debounce: if we just scrolled to this message recently, skip
    const now = Date.now()
    if (this.lastScrollMessageId === messageId && now - this.lastScrollTime < 500) {
      return
    }

    // Clear any pending scrolls
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }

    const container = this.messengerScrollComponent?.getContainer()
    if (!container) {
      this.scrollToBottom()
      return
    }

    // Try to find the element, with retries if needed
    const attemptScroll = (retries = 10) => {
      // Find the message element by ID
      const messageElement = document.getElementById(`message-${messageId}`)
      if (!messageElement) {
        if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => attemptScroll(retries - 1), 100)
          return
        }
        // Fallback to bottom if message element not found after retries
        this.scrollToBottom()
        return
      }

      // Use getBoundingClientRect to get accurate positions
      const containerRect = container.getBoundingClientRect()
      const messageRect = messageElement.getBoundingClientRect()
      
      const containerHeight = container.clientHeight
      const messageHeight = messageRect.height

      // Calculate message positions relative to container
      const messageTopOffset = messageRect.top - containerRect.top
      const messageBottomOffset = messageRect.bottom - containerRect.bottom
      
      // Find the scrollable content container to calculate absolute position
      const scrollContent = container.querySelector('.chat-content-container')
      if (!scrollContent) {
        this.scrollToBottom()
        return
      }
      
      // Calculate the absolute position of the message within the scrollable content
      let messageAbsoluteTop = 0
      let element = messageElement
      while (element && element !== scrollContent) {
        messageAbsoluteTop += element.offsetTop
        element = element.offsetParent
      }
      
      // If message is bigger than screen, align top with top (with toolbar offset)
      if (messageHeight > containerHeight) {
        // Scroll so message top is TOOLBAR_OFFSET above container top
        const targetScrollTop = messageAbsoluteTop - TOOLBAR_OFFSET
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        return
      }
      
      // Message is smaller than screen - fit it in viewport
      // Check if message top is above the desired position (TOOLBAR_OFFSET above container top)
      const desiredTopPosition = TOOLBAR_OFFSET

      if (messageTopOffset < desiredTopPosition) {
        // Scroll so message top is TOOLBAR_OFFSET above container top
        const targetScrollTop = messageAbsoluteTop - TOOLBAR_OFFSET
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        return
      }
      
      // If bottom is below screen, scroll up to align bottom with bottom
      if (messageBottomOffset > 0) {
        // Calculate absolute bottom position
        const messageAbsoluteBottom = messageAbsoluteTop + messageHeight
        // Scroll so message bottom aligns with container bottom
        const targetScrollTop = messageAbsoluteBottom - containerHeight
        container.scrollTop = targetScrollTop
        this.messengerScrollComponent?.update()
        this.lastScrollMessageId = messageId
        this.lastScrollTime = Date.now()
        return
      }
      
      // Message is already fully visible, no need to scroll
      this.lastScrollMessageId = messageId
      this.lastScrollTime = Date.now()
    }

    // Start attempting to scroll
    attemptScroll()
  }

  scrollToMessageTop = (messageId) => {
    // Debounce: if we just scrolled to this message recently, skip
    const now = Date.now()
    if (this.lastScrollMessageId === messageId && now - this.lastScrollTime < 500) {
      return
    }

    // Clear any pending scrolls
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
      this.scrollTimeout = null
    }

    const container = this.messengerScrollComponent?.getContainer()
    if (!container) {
      return
    }

    // Try to find the element, with retries if needed
    const attemptScroll = (retries = 3) => {
      // Find the message element by ID
      const messageElement = document.getElementById(`message-${messageId}`)
      if (!messageElement) {
        if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => attemptScroll(retries - 1), 50)
          return
        }
        return
      }

      // Find the scrollable content container to calculate absolute position
      const scrollContent = container.querySelector('.chat-content-container')
      if (!scrollContent) {
        return
      }
      
      // Calculate the absolute position of the message within the scrollable content
      let messageAbsoluteTop = 0
      let element = messageElement
      while (element && element !== scrollContent) {
        messageAbsoluteTop += element.offsetTop
        element = element.offsetParent
      }
      
      // Calculate target scroll: align message top with container top (minus toolbar offset)
      // If this would scroll past the bottom, cap at the max scroll position
      const maxScrollTop = container.scrollHeight - container.clientHeight
      const targetScrollTop = Math.min(maxScrollTop, Math.max(0, messageAbsoluteTop - TOOLBAR_OFFSET))

      // Scroll to align message top with container top (with toolbar offset)
      // If message is small, this will naturally scroll as far as possible (toward bottom)
      const startScrollTop = container.scrollTop
      const distance = targetScrollTop - startScrollTop
      const duration = 300 // ms
      const startTime = performance.now()
      
      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3)
        
        const currentScrollTop = startScrollTop + (distance * easeOut)
        container.scrollTop = currentScrollTop
        
        // Update scrollbars during animation
        this.messengerScrollComponent?.update()
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll)
        } else {
          // Final update after animation completes
          container.scrollTop = targetScrollTop
          this.messengerScrollComponent?.update()
          this.checkIfAtBottom()
        }
      }
      
      requestAnimationFrame(animateScroll)
      
      this.lastScrollMessageId = messageId
      this.lastScrollTime = Date.now()
    }

    // Start attempting to scroll
    requestAnimationFrame(() => {
      attemptScroll()
    })
  }
  onCSVDownloadProgress = ({ id, progress }) => {
    this.csvProgressLog[id] = progress
    if (this.messageRefs[id] && this.messageRefs[id]?._isMounted) {
      this.messageRefs[id].setState({
        csvDownloadProgress: progress,
      })
    }
  }

  clearMessages = () => {
    this.queryInputRef?.cancelQuery()
    if (this._isMounted) {
      this.setState({
        messages: this.getIntroMessages(this.props.introMessages),
        isClearingAllMessages: true,
      })
    }
  }

  animateInputTextAndSubmit = (...params) => {
    if (this.queryInputRef?._isMounted) {
      this.queryInputRef?.animateInputTextAndSubmit(...params)
    }
  }

  onNoneOfTheseClick = () => {
    this.addRequestMessage('None of these')
    this.setState({ isQueryRunning: true })

    clearTimeout(this.feedbackTimeout)
    this.feedbackTimeout = setTimeout(() => {
      if (this._isMounted) {
        clearTimeout(this.responseDelayTimeout)
        this.setState({ isQueryRunning: false, isInputDisabled: false })
        this.addResponseMessage({
          content: (
            <div className='feedback-message'>
              Thank you for your feedback!
              <br />
              To continue, try asking another query.
            </div>
          ),
        })
      }
    }, 1000)
  }

  onDrilldownStart = () => {
    if (this.state.isDrilldownRunning) {
      // Drilldown is already running. Tell onDrilldownEnd to not remove the loading dots
      this.keepLoading = true
    }

    this.setState({ isDrilldownRunning: true, isInputDisabled: true })
  }

  onDrilldownEnd = ({ response, error, originalQueryID, drilldownFilters } = {}) => {
    if (this._isMounted) {
      if (this.keepLoading) {
        this.keepLoading = false
      } else {
        clearTimeout(this.responseDelayTimeout)
        this.setState({ isDrilldownRunning: false, isInputDisabled: false })

        if (response) {
          this.addResponseMessage({ response, originalQueryID, drilldownFilters })
        } else if (error) {
          this.addResponseMessage({
            content: error,
          })
        }
      }
    }
  }

  getIsSuggestionResponse = (response) => {
    return !!response?.data?.data?.items
  }

  deleteMessage = (id) => {
    const { messages } = this.state
    const messageIndex = messages.findIndex((message) => id === message.id)
    const message = messages[messageIndex]

    let messagesToDelete = [id]
    if (message?.queryMessageID) {
      messagesToDelete = messages?.filter((m) => m.queryMessageID === message.queryMessageID).map((m) => m.id)
    }

    const newMessages = messages.filter((message) => !messagesToDelete.includes(message.id))
    this.setState({ messages: newMessages })
  }

  getIntroMessages = (contentList) => {
    return contentList.map((content) =>
      this.createMessage({
        isResponse: true,
        content: content || '',
        isIntroMessage: true,
      }),
    )
  }

  addIntroMessages = (contentList) => {
    if (Array.isArray(contentList) && contentList.length) {
      this.addMessages(this.getIntroMessages(contentList))
    }
  }

  addMessage = (message) => {
    this.addMessages([message])
  }

  addMessages = (newMessages) => {
    const { messages } = this.state
    let updatedMessages = [...messages]
    
    // Update existing messages or add new ones
    newMessages.forEach((newMessage) => {
      const existingIndex = updatedMessages.findIndex((msg) => msg.id === newMessage.id)
      if (existingIndex >= 0) {
        // Update existing message
        updatedMessages[existingIndex] = newMessage
      } else {
        // Add new message
        updatedMessages.push(newMessage)
      }
    })
    
    if (updatedMessages.length > this.props.maxMessages) {
      updatedMessages = updatedMessages.slice(-this.props.maxMessages)
    }

    if (this._isMounted) {
      this.setState({
        messages: updatedMessages,
      })
    }
  }

  addRequestMessage = (text, queryMessageID) => {
    this.addMessage(
      this.createMessage({
        content: text,
        isResponse: false,
        queryMessageID,
      }),
    )
  }

  addResponseMessage = (params = {}) => {
    let message
    params.isResponse = true

    if (params?.response?.error === 'Unauthenticated') {
      message = this.createErrorMessage(UNAUTHENTICATED_ERROR)
    } else if (params?.response?.error === 'Parse error') {
      message = this.createErrorMessage(GENERAL_QUERY_ERROR)
    } else if (!params?.response && !params?.content) {
      message = this.createErrorMessage()
    } else {
      const appliedFilters = this.getAppliedFilters(params?.response)
      message = this.createMessage({
        ...params,
        appliedFilters,
      })
    }

    if (message) {
      this.addMessage(message)
    }
  }

  onInputSubmit = (query, id) => {
    this.addRequestMessage(query, id)
    this.setState({ isInputDisabled: true })
    this.responseDelayTimeout = setTimeout(() => {
      this.setState({ isQueryRunning: true })
    }, 600)
  }

  onResponse = (response, query, queryMessageID) => {
    if (this._isMounted) {
      this.setState({ isQueryRunning: false, isInputDisabled: false })

      if (response?.data?.message === REQUEST_CANCELLED_ERROR && this.state.isClearingAllMessages) {
        this.setState({
          isClearingAllMessages: false,
          isQueryRunning: false,
          isDrilldownRunning: false,
          isInputDisabled: false,
        })
        return
      }

      if (this.getIsSuggestionResponse(response)) {
        this.addResponseMessage({
          content: 'I want to make sure I understood your query. Did you mean:',
          queryMessageID,
        })
      }

      // Keep around in case we want to use authorization_url
      if (_has(response?.data?.data, 'authorization_url')) {
        this.addResponseMessage({
          content: (
            <span>
              Looks like you're trying to query a Microsoft Dynamics data source.
              <a href={response.data.data.authorization_url} target='_blank' rel='noreferrer'>
                Click here to authorize access then try querying again.
              </a>
            </span>
          ),
          queryMessageID,
        })
      } else {
        this.addResponseMessage({ response, query, queryMessageID })
      }

      clearTimeout(this.responseDelayTimeout)

      //disable input focus for mobile, as ios keyboard has bug
      !isMobile && this.focusInput()
    }
  }

  createMessage = (params = {}) => {
    const uniqueId = params.id || uuid()

    return {
      id: uniqueId,
      type: params.response?.data?.data?.display_type,
      ...params,
    }
  }

  createErrorMessage = (content, queryMessageID) => {
    return this.createMessage({
      content: content || GENERAL_QUERY_ERROR,
      isResponse: true,
      type: 'error',
      queryMessageID,
    })
  }

  getAppliedFilters = (response) => {
    try {
      let persistedFilters = response?.data?.data?.fe_req?.persistent_filter_locks
      let sessionFilters = response?.data?.data?.fe_req?.session_filter_locks

      if (!Array.isArray(persistedFilters)) {
        persistedFilters = []
      }
      if (!Array.isArray(sessionFilters)) {
        sessionFilters = []
      }

      return [...persistedFilters, ...sessionFilters]
    } catch (error) {
      return []
    }
  }

  isChataThinking = () => {
    return this.state.isQueryRunning || this.state.isDrilldownRunning || this.state.isGeneratingSummary
  }

  setGeneratingSummary = (isGenerating) => {
    if (this._isMounted) {
      this.setState({ isGeneratingSummary: isGenerating })
    }
  }

  shouldHideQueryInputComponent = () => {
    const { hideChatBarAfterInitialResponse, shouldRender } = this.props
    const { messages } = this.state

    if (hideChatBarAfterInitialResponse && messages.length > 0) {
      return true
    }
    return !shouldRender
  }
  onMessageResize = (messageId) => {
    if (!this.messengerScrollComponent) {
      return
    }

    this.messengerScrollComponent.update()
    // Don't scroll on resize - let the initial scroll handle positioning
    // This prevents multiple conflicting scrolls
  }

  render = () => {
    const { messages } = this.state
    let chatMessageVisibility
    let chatMessageOpacity
    let queryInputVisibility
    let queryInputOpacity

    const hideQueryInput = this.shouldHideQueryInputComponent()

    if (!this.props.shouldRender) {
      chatMessageVisibility = 'hidden'
      chatMessageOpacity = '0'
      queryInputVisibility = 'hidden'
      queryInputOpacity = '0'
    } else if (hideQueryInput) {
      queryInputVisibility = 'hidden'
      queryInputOpacity = '0'
    }

    return (
      <ErrorBoundary>
        <div
          ref={(r) => (this.chatContentRef = r)}
          className={`chat-content-scroll-container ${this.props.shouldRender ? '' : 'react-autoql-content-hidden'}
            ${this.props.enableQueryInputTopics === false ? 'no-topics' : ''}
            ${isMobile ? 'mobile-padding' : ''}`}
          style={{ visibility: chatMessageVisibility, opacity: chatMessageOpacity }}
        >
          <CustomScrollbars
            ref={(r) => (this.messengerScrollComponent = r)}
            className='chat-content-scrollbars-container'
            suppressScrollX
          >
            <div className='chat-content-container'>
              {messages.map((message) => {
                return (
                  <ChatMessage
                    key={message.id}
                    id={message.id}
                    ref={(r) => (this.messageRefs[message.id] = r)}
                    isIntroMessage={message.isIntroMessage}
                    authentication={this.props.authentication}
                    autoQLConfig={this.props.autoQLConfig}
                    isCSVProgressMessage={message.isCSVProgressMessage}
                    initialCSVDownloadProgress={this.csvProgressLog[message.id]}
                    onCSVDownloadProgress={this.onCSVDownloadProgress}
                    queryId={message.queryId}
                    queryText={message.query}
                    originalQueryID={message.originalQueryID}
                    isDataMessengerOpen={this.props.isDataMessengerOpen}
                    isActive={this.state.activeMessageId === message.id}
                    addMessageToDM={this.addResponseMessage}
                    onDrilldownStart={this.onDrilldownStart}
                    onDrilldownEnd={this.onDrilldownEnd}
                    isResponse={message.isResponse}
                    isChataThinking={this.isChataThinking()}
                    onSuggestionClick={this.animateInputTextAndSubmit}
                    setGeneratingSummary={this.setGeneratingSummary}
                    customToolbarOptions={this.props.customToolbarOptions}
                    content={message.content}
                    scrollToBottom={this.scrollToBottom}
                    scrollToMessageTop={this.scrollToMessageTop}
                    scrollToMessageFit={this.scrollToMessageFit}
                    dataFormatting={this.props.dataFormatting}
                    response={message.response}
                    type={message.type}
                    drilldownFilters={message.drilldownFilters}
                    summaryResponseData={message.summaryResponseData}
                    focusPromptUsed={message.focusPromptUsed}
                    onErrorCallback={this.props.onErrorCallback}
                    enableCyclicalDates={this.props.enableCyclicalDates}
                    onSuccessAlert={this.props.onSuccessAlert}
                    deleteMessageCallback={this.deleteMessage}
                    createDataAlertCallback={this.props.createDataAlertCallback}
                    scrollContainerRef={this.messengerScrollComponent}
                    isResizing={this.props.isResizing}
                    enableDynamicCharting={this.props.enableDynamicCharting}
                    onNoneOfTheseClick={this.onNoneOfTheseClick}
                    autoChartAggregations={this.props.autoChartAggregations}
                    onRTValueLabelClick={this.props.onRTValueLabelClick}
                    appliedFilters={message.appliedFilters}
                    disableMaxHeight={this.props.disableMaxMessageHeight}
                    queryRequestData={message.queryRequestData}
                    popoverParentElement={this.chatContentRef}
                    isVisibleInDOM={this.props.shouldRender}
                    dataPageSize={this.props.dataPageSize}
                    shouldRender={this.props.shouldRender}
                    source={this.props.source}
                    scope={this.props.scope}
                    tooltipID={this.props.tooltipID}
                    chartTooltipID={this.props.chartTooltipID}
                    subjects={this.state.subjects}
                    onMessageResize={this.onMessageResize}
                    enableCustomColumns={this.props.enableCustomColumns}
                    disableAggregationMenu={this.props.disableAggregationMenu}
                    allowCustomColumnsOnDrilldown={this.props.allowCustomColumnsOnDrilldown}
                    preferRegularTableInitialDisplayType={this.props.preferRegularTableInitialDisplayType}
                    enableMagicWand={this.props.enableMagicWand}
                  />
                )
              })}
            </div>
          </CustomScrollbars>
          {this.isChataThinking() && (
            <div className={`response-loading-container ${isMobile ? 'mobile-padding' : ''}`}>
              <LoadingDots />
            </div>
          )}
          {!this.state.isAtBottom && (
            <button
              className='scroll-to-bottom-button'
              onClick={this.smoothScrollToBottom}
              aria-label='Scroll to bottom'
            >
              <Icon type='caret-down' />
            </button>
          )}
          <div className='watermark-fade' />
          <div className='watermark'>
            <Icon type='react-autoql-bubbles-outlined' />
            {lang.run}
          </div>
        </div>
        <div
          style={{ visibility: queryInputVisibility, opacity: queryInputOpacity }}
          className={`chat-bar-container ${!hideQueryInput ? '' : 'react-autoql-content-hidden'}`}
        >
          <QueryInput
            ref={(r) => (this.queryInputRef = r)}
            className='chat-drawer-chat-bar'
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onSubmit={this.onInputSubmit}
            onResponseCallback={this.onResponse}
            addResponseMessage={this.addResponseMessage}
            isDisabled={this.state.isInputDisabled}
            enableVoiceRecord={this.props.enableVoiceRecord}
            autoCompletePlacement='above'
            showChataIcon={false}
            showLoadingDots={false}
            placeholder={this.props.inputPlaceholder}
            onErrorCallback={this.props.onErrorCallback}
            hideInput={this.props.hideInput}
            source={this.props.source}
            scope={this.props.scope}
            queryFilters={this.props.queryFilters}
            sessionId={this.props.sessionId}
            dataPageSize={this.props.dataPageSize}
            isResizing={this.props.isResizing}
            shouldRender={this.props.shouldRender}
            tooltipID={this.props.tooltipID}
            executeQuery={this.props.executeQuery}
            enableQueryInputTopics={this.props.enableQueryInputTopics}
          />
        </div>
      </ErrorBoundary>
    )
  }
}
