import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _has from 'lodash.has'
import { isMobile } from 'react-device-detect'
import {
  REQUEST_CANCELLED_ERROR,
  UNAUTHENTICATED_ERROR,
  GENERAL_QUERY_ERROR,
  dataFormattingDefault,
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

export default class ChatContent extends React.Component {
  constructor(props) {
    super(props)

    this.messageRefs = {}
    this.csvProgressLog = {}
    this.keepLoading = false

    this.state = {
      messages: [],
    }
  }

  static propTypes = {
    authentication: authenticationType.isRequired,
    autoQLConfig: autoQLConfigType.isRequired,
    dataFormatting: dataFormattingType,
    clearOnClose: PropTypes.bool.isRequired,
    enableVoiceRecord: PropTypes.bool.isRequired,
    maxMessages: PropTypes.number.isRequired,
    introMessage: PropTypes.string.isRequired,
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
  }

  componentDidUpdate = (prevProps, prevState) => {
    //disable input focus for mobile, as ios keyboard has bug
    if (this.props.shouldRender && !prevProps.shouldRender && !isMobile) {
      this.focusInput()
    }

    this.messengerScrollComponent?.update()
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.feedbackTimeout)
    clearTimeout(this.responseDelayTimeout)
  }

  focusInput = () => {
    if (this.queryInputRef?._isMounted) {
      this.queryInputRef.focus()
    }
  }

  scrollToBottom = () => {
    this.messengerScrollComponent?.scrollToBottom()
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

  onDrilldownEnd = ({ response, error, originalQueryID } = {}) => {
    if (this._isMounted) {
      if (this.keepLoading) {
        this.keepLoading = false
      } else {
        clearTimeout(this.responseDelayTimeout)
        this.setState({ isDrilldownRunning: false, isInputDisabled: false })

        if (response) {
          this.addResponseMessage({ response, originalQueryID })
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
    const messageIndex = this.state.messages.findIndex((message) => id === message.id)
    const message = this.state.messages[messageIndex]

    let messagesToDelete = [id]
    if (message?.queryMessageID) {
      messagesToDelete = this.state.messages
        ?.filter((m) => m.queryMessageID === message.queryMessageID)
        .map((m) => m.id)
    }

    const newMessages = this.state.messages.filter((message) => !messagesToDelete.includes(message.id))

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

  addMessages = (messages) => {
    let newMessages = [...this.state.messages, ...messages]
    if (newMessages.length > this.props.maxMessages) {
      newMessages = newMessages.slice(-this.props.maxMessages)
    }

    if (this._isMounted) {
      this.setState({
        messages: newMessages,
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
              Looks like you’re trying to query a Microsoft Dynamics data source.
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
    return this.state.isQueryRunning || this.state.isDrilldownRunning
  }

  shouldHideQueryInputComponent = () => {
    const { hideChatBarAfterInitialResponse, shouldRender } = this.props
    const { messages } = this.state

    if (hideChatBarAfterInitialResponse && messages.length > 0) {
      return true
    }
    return !shouldRender
  }

  render = () => {
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
          className={`chat-content-scroll-container ${this.props.shouldRender ? '' : 'react-autoql-content-hidden'}`}
          style={{ visibility: chatMessageVisibility, opacity: chatMessageOpacity }}
        >
          <CustomScrollbars
            ref={(r) => (this.messengerScrollComponent = r)}
            className='chat-content-scrollbars-container'
          >
            <div className='chat-content-container'>
              {this.state.messages.map((message) => {
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
                    customToolbarOptions={this.props.customToolbarOptions}
                    content={message.content}
                    scrollToBottom={this.scrollToBottom}
                    dataFormatting={this.props.dataFormatting}
                    response={message.response}
                    type={message.type}
                    onErrorCallback={this.props.onErrorCallback}
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
                  />
                )
              })}
            </div>
          </CustomScrollbars>
          {this.isChataThinking() && (
            <div className='response-loading-container'>
              <LoadingDots />
            </div>
          )}
        </div>
        <div
          style={{ visibility: queryInputVisibility, opacity: queryInputOpacity }}
          className={`chat-bar-container ${!hideQueryInput ? '' : 'react-autoql-content-hidden'}`}
        >
          <div className='watermark'>
            <Icon type='react-autoql-bubbles-outlined' />
            {lang.run}
          </div>
          <QueryInput
            ref={(r) => (this.queryInputRef = r)}
            className='chat-drawer-chat-bar'
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            onSubmit={this.onInputSubmit}
            onResponseCallback={this.onResponse}
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
          />
        </div>
      </ErrorBoundary>
    )
  }
}
