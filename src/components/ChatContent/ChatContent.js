import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _has from 'lodash.has'
import _isEmpty from 'lodash.isempty'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import errorMessages from '../../js/errorMessages'
import { lang } from '../../js/Localization'

// Components
import { Icon } from '../Icon'
import { QueryInput } from '../QueryInput'
import { ChatMessage } from '../ChatMessage'
import { CustomScrollbars } from '../CustomScrollbars'
import { LoadingDots } from '../LoadingDots'

// Styles
import './ChatContent.scss'

export default class ChatContent extends React.Component {
  constructor(props) {
    super(props)

    this.messageRefs = {}
    this.csvProgressLog = {}

    this.state = {
      messages: [],
    }
  }

  static propTypes = {
    authentication: authenticationType.isRequired,
    autoQLConfig: autoQLConfigType.isRequired,
    dataFormatting: dataFormattingType.isRequired,
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
    enableAjaxTableData: PropTypes.bool,
    dataPageSize: PropTypes.number,
    sessionId: PropTypes.string,
    isResizing: PropTypes.bool,
    source: PropTypes.arrayOf(PropTypes.string),
  }

  static defaultProps = {
    disableMaxMessageHeight: false,
    enableAjaxTableData: false,
    isResizing: false,
    dataPageSize: undefined,
    source: [],
    onRTValueLabelClick: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.introMessages?.length) {
      this.addIntroMessages(this.props.introMessages)
    }
    if (this.props.shouldRender) {
      this.focusInput()
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.shouldRender && !prevProps.shouldRender) {
      this.focusInput()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.feedbackTimeout)
  }

  focusInput = () => {
    if (this.queryInputRef?._isMounted) {
      this.queryInputRef.focus()
    }
  }

  escFunction = (event) => {
    if (this.state.isVisible && event.keyCode === 27) {
      // todo: add this functionality back
      // cancelQuery()
    }
  }

  scrollToBottom = () => {
    this.messengerScrollComponent?.ref?.scrollToBottom()
  }

  onCSVDownloadProgress = ({ id, progress }) => {
    this.csvProgressLog[id] = progress
    if (this.messageRefs[id]) {
      this.messageRefs[id].setState({
        csvDownloadProgress: progress,
      })
    }
  }

  clearMessages = () => {
    this.setState({ messages: this.getIntroMessages(this.props.introMessages) })
  }

  animateInputTextAndSubmit = (...params) => {
    if (this.queryInputRef?._isMounted) {
      this.queryInputRef?.animateInputTextAndSubmit(...params)
    }
  }

  onNoneOfTheseClick = () => {
    this.addRequestMessage('None of these')
    this.setState({ isChataThinking: true })

    clearTimeout(this.feedbackTimeout)
    this.feedbackTimeout = setTimeout(() => {
      if (this._isMounted) {
        this.setState({ isChataThinking: false })
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
    this.setState({ isChataThinking: true })
  }

  onDrilldownEnd = ({ response, error, originalQueryID } = {}) => {
    if (this._isMounted) {
      this.setState({ isChataThinking: false })

      if (response) {
        this.addResponseMessage({ response, originalQueryID })
      } else if (error) {
        this.addResponseMessage({
          content: error,
        })
      }
    }
  }

  getIsSuggestionResponse = (response) => {
    return !!response?.data?.data?.items
  }

  deleteMessage = (id) => {
    const messagesToDelete = [id]
    const messageIndex = this.state.messages.findIndex((message) => id === message.id)

    // If there is a query message right above it (not a drilldown), delete the query message also
    const messageAbove = this.state.messages[messageIndex - 1]

    // If the messageAbove is not undefined
    if (messageAbove) {
      if (!messageAbove.isResponse) {
        messagesToDelete.push(messageAbove.id)
      }
    }

    const newMessages = this.state.messages.filter((message) => !messagesToDelete.includes(message.id))

    this.setState({
      messages: newMessages,
    })
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

  addIntroMessage = (message) => {
    this.addIntroMessages([message])
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

    this.setState({
      messages: newMessages,
    })
  }

  addRequestMessage = (text) => {
    this.addMessage(
      this.createMessage({
        content: text,
        isResponse: false,
      }),
    )
  }

  addResponseMessage = (params = {}) => {
    let message
    params.isResponse = true

    if (params?.response?.error === 'Unauthenticated') {
      message = this.createErrorMessage(errorMessages.UNAUTHENTICATED)
    } else if (params?.response?.error === 'Parse error') {
      message = this.createErrorMessage(errorMessages.GENERAL_QUERY)
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

  onInputSubmit = (query) => {
    this.addRequestMessage(query)
    this.setState({ isChataThinking: true })
  }

  onResponse = (response, query) => {
    if (this._isMounted) {
      if (this.getIsSuggestionResponse(response)) {
        this.addResponseMessage({
          content: 'I want to make sure I understood your query. Did you mean:',
        })
      }

      // Keep around in case we want to use authorization_url
      if (_has(response?.data?.data, 'authorization_url')) {
        this.addResponseMessage({
          content: (
            <span>
              Looks like you’re trying to query a Microsoft Dynamics data source.
              <a href={response.data.data.authorization_url} target='_blank' rel="noreferrer">
                Click here to authorize access then try querying again.
              </a>
            </span>
          ),
        })
      } else {
        this.addResponseMessage({ response, query })
      }

      this.setState({ isChataThinking: false })
      this.focusInput()
    }
  }

  createIntroMessage = ({ type, content }) => {
    return {
      id: uuid(),
      isResponse: true,
      type: type || 'text',
      content: content || '',
      isIntroMessage: true,
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

  createErrorMessage = (content) => {
    return this.createMessage({
      content: content || errorMessages.GENERAL_QUERY,
      isResponse: true,
      type: 'error',
    })
  }

  getAppliedFilters = (response) => {
    try {
      let persistedFilters = response?.data?.data?.persistent_locked_conditions
      let sessionFilters = response?.data?.data?.session_locked_conditions

      if (!Array.isArray(persistedFilters)) {persistedFilters = []}
      if (!Array.isArray(sessionFilters)) {sessionFilters = []}

      return [...persistedFilters, ...sessionFilters]
    } catch (error) {
      return []
    }
  }

  render = () => {
    let display
    if (!this.props.shouldRender) {
      display = 'none'
    }

    return (
      <ErrorBoundary>
        <div ref={(r) => (this.chatContentRef = r)} className='chat-content-scroll-container' style={{ display }}>
          <CustomScrollbars ref={(r) => (this.messengerScrollComponent = r)}>
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
                  scrollRef={this.messengerScrollComponent?.ref}
                  isDataMessengerOpen={this.props.isDataMessengerOpen}
                  isActive={this.state.activeMessageId === message.id}
                  addMessageToDM={this.addResponseMessage}
                  onDrilldownStart={this.onDrilldownStart}
                  onDrilldownEnd={this.onDrilldownEnd}
                  isResponse={message.isResponse}
                  isChataThinking={this.state.isChataThinking}
                  onSuggestionClick={this.animateInputTextAndSubmit}
                  content={message.content}
                  scrollToBottom={this.scrollToBottom}
                  dataFormatting={this.props.dataFormatting}
                  response={message.response}
                  type={message.type}
                  onErrorCallback={this.props.onErrorCallback}
                  onSuccessAlert={this.props.onSuccessAlert}
                  deleteMessageCallback={this.deleteMessage}
                  scrollContainerRef={this.messengerScrollComponent?.ref}
                  isResizing={this.props.isResizing}
                  enableDynamicCharting={this.props.enableDynamicCharting}
                  onNoneOfTheseClick={this.onNoneOfTheseClick}
                  autoChartAggregations={this.props.autoChartAggregations}
                  onRTValueLabelClick={this.props.onRTValueLabelClick}
                  appliedFilters={message.appliedFilters}
                  disableMaxHeight={this.props.disableMaxMessageHeight}
                  enableAjaxTableData={this.props.enableAjaxTableData}
                  rebuildTooltips={this.props.rebuildTooltips}
                  queryRequestData={message.queryRequestData}
                  popoverParentElement={this.chatContentRef}
                  isVisibleInDOM={this.props.shouldRender}
                  source={this.props.source}
                />
              )
            })}
          </CustomScrollbars>
          {this.state.isChataThinking && (
            <div className='response-loading-container'>
              <LoadingDots />
            </div>
          )}
        </div>
        <div style={{ display }} className='chat-bar-container'>
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
            isDisabled={this.state.isChataThinking}
            enableVoiceRecord={this.props.enableVoiceRecord}
            autoCompletePlacement='above'
            showChataIcon={false}
            showLoadingDots={false}
            placeholder={this.props.inputPlaceholder}
            onErrorCallback={this.props.onErrorCallback}
            hideInput={this.props.hideInput}
            source={this.props.source}
            queryFilters={this.props.queryFilters}
            sessionId={this.props.sessionId}
            dataPageSize={this.props.dataPageSize}
            isResizing={this.props.isResizing}
            shouldRender={this.props.shouldRender}
          />
        </div>
      </ErrorBoundary>
    )
  }
}
