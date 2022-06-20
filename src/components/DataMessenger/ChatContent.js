import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
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
  getAutoQLConfig,
  getThemeConfig,
} from '../../props/defaults'

import { setCSSVars } from '../../js/Util'
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
import { fetchQueryTips, fetchTopics } from '../../js/queryService'
import { FilterLockPopover } from '../FilterLockPopover'
import { CustomScrollbars } from '../CustomScrollbars'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'
import { LoadingDots } from '../LoadingDots'

export default class ChatContent extends React.Component {
  constructor(props) {
    super(props)

    this.messageRefs = {}

    this.state = {
      messages: [],
    }
  }

  static propTypes = {
    authentication: authenticationType.isRequired,
    autoQLConfig: autoQLConfigType.isRequired,
    dataFormatting: dataFormattingType.isRequired,
    themeConfig: themeConfigType.isRequired,
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
    onCSVDownloadProgress: PropTypes.func,
    csvProgressLog: PropTypes.shape({}),
    onRTValueLabelClick: PropTypes.func,
    disableMaxMessageHeight: PropTypes.bool,
    enableAjaxTableData: PropTypes.bool,
  }

  static defaultProps = {
    csvProgressLog: {},
    disableMaxMessageHeight: false,
    enableAjaxTableData: false,
    onCSVDownloadProgress: () => {},
    onRTValueLabelClick: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    if (!!this.props.introMessages?.length) {
      this.addIntroMessages(this.props.introMessages)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.feedbackTimeout)
  }

  escFunction = (event) => {
    if (this.state.isVisible && event.keyCode === 27) {
      // todo: add this functionality back
      // cancelQuery()
    }
  }

  scrollToBottom = () => {
    if (this.messengerScrollComponent) {
      this.messengerScrollComponent.scrollToBottom()
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
            <div className="feedback-message">
              Thank you for your feedback!
              <br />
              To continue, try asking another query.
            </div>
          ),
        })
      }
    }, 1000)
  }

  onCSVDownloadProgress = ({ id, progress }) => {
    this.props.onCSVDownloadProgress({ id, progress })
    if (this.messageRefs[id]?._isMounted) {
      this.messageRefs[id]?.setState({
        csvDownloadProgress: progress,
      })
    }
  }

  onDrilldownStart = () => {
    this.setState({ isChataThinking: true })
  }

  onDrilldownEnd = ({ response, error } = {}) => {
    if (this._isMounted) {
      this.setState({ isChataThinking: false })

      if (response) {
        this.addResponseMessage({ response })
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

  deleteMessage = (key) => {
    const messagesToDelete = [key]
    const messageIndex = this.state.messages.findIndex(
      (message) => key === message.key
    )

    // If there is a query message right above it (not a drilldown), delete the query message also
    const messageAbove = this.state.messages[messageIndex - 1]

    // If the messageAbove is not undefined
    if (messageAbove) {
      if (!messageAbove.isResponse) {
        messagesToDelete.push(messageAbove.key)
      }
    }

    const newMessages = this.state.messages.filter(
      (message) => !messagesToDelete.includes(message.key)
    )

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
      })
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
      })
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

  onInputSubmit = (text) => {
    this.addRequestMessage(text)
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
              Looks like you’re trying to query a Microsoft Dynamics data
              source.
              <a href={response.data.data.authorization_url} target="_blank">
                Click here to authorize access then try querying again.
              </a>
            </span>
          ),
        })
      } else {
        this.addResponseMessage({ response, query })
      }

      this.setState({ isChataThinking: false })
      if (this.queryInputRef?._isMounted) {
        this.queryInputRef.focus()
      }
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

    return (
      <ChatMessage
        key={uniqueId}
        id={uniqueId}
        ref={(r) => (this.messageRefs[uniqueId] = r)}
        isIntroMessage={params.isIntroMessage}
        authentication={getAuthentication(this.props.authentication)}
        autoQLConfig={getAutoQLConfig(this.props.autoQLConfig)}
        themeConfig={getThemeConfig(this.props.themeConfig)}
        isCSVProgressMessage={params.isCSVProgressMessage}
        initialCSVDownloadProgress={this.props.csvProgressLog[uniqueId]}
        onCSVDownloadProgress={this.onCSVDownloadProgress}
        queryId={params.queryId}
        queryText={params.query}
        scrollRef={this.messengerScrollComponent}
        isDataMessengerOpen={this.props.isDataMessengerOpen}
        isActive={this.state.activeMessageId === uniqueId}
        addMessageToDM={this.addResponseMessage}
        onDrilldownStart={this.onDrilldownStart}
        onDrilldownEnd={this.onDrilldownEnd}
        isResponse={params.isResponse}
        isChataThinking={this.state.isChataThinking}
        onSuggestionClick={this.animateInputTextAndSubmit}
        content={params.content}
        scrollToBottom={this.scrollToBottom}
        onQueryOutputUpdate={this.rebuildTooltips}
        dataFormatting={this.props.dataFormatting}
        displayType={
          params.displayType || params.response?.data?.data?.display_type
        }
        onResponseCallback={this.onResponse}
        response={params.response}
        type={params.response?.data?.data?.display_type}
        onErrorCallback={this.props.onErrorCallback}
        onSuccessAlert={this.props.onSuccessAlert}
        deleteMessageCallback={this.deleteMessage}
        scrollContainerRef={this.messengerScrollComponent}
        isResizing={this.state.isResizing || this.state.isWindowResizing}
        enableDynamicCharting={this.props.enableDynamicCharting}
        onNoneOfTheseClick={this.onNoneOfTheseClick}
        autoChartAggregations={this.props.autoChartAggregations}
        onRTValueLabelClick={this.props.onRTValueLabelClick}
        appliedFilters={params.appliedFilters}
        disableMaxHeight={this.props.disableMaxMessageHeight}
        enableAjaxTableData={this.props.enableAjaxTableData}
      />
    )
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

      if (!Array.isArray(persistedFilters)) persistedFilters = []
      if (!Array.isArray(sessionFilters)) sessionFilters = []

      return [...persistedFilters, ...sessionFilters]
    } catch (error) {
      return []
    }
  }

  render = () => {
    if (!this.props.shouldRender || !this.props.isDataMessengerOpen) {
      return null
    }

    return (
      <ErrorBoundary>
        <CustomScrollbars
          innerRef={(c) => {
            this.messengerScrollComponent = c
          }}
          className="chat-message-container"
          renderView={(props) => (
            <div {...props} className="custom-scrollbar-container" />
          )}
        >
          {this.state.messages}
        </CustomScrollbars>
        {this.state.isChataThinking && (
          <div className="response-loading-container">
            <LoadingDots />
          </div>
        )}
        <div className="chat-bar-container">
          <div className="watermark">
            <Icon type="react-autoql-bubbles-outlined" />
            {lang.run}
          </div>
          <QueryInput
            ref={(r) => (this.queryInputRef = r)}
            className="chat-drawer-chat-bar"
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            themeConfig={getThemeConfig(this.props.themeConfig)}
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
            source={this.props.source}
            queryFilters={this.props.queryFilters}
          />
        </div>
      </ErrorBoundary>
    )
  }
}
