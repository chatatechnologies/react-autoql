import React, { Fragment } from 'react'
import { number, bool, string, func, shape } from 'prop-types'
import uuid from 'uuid'
import Drawer from 'rc-drawer'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import _get from 'lodash.get'
import { Scrollbars } from 'react-custom-scrollbars'
// import { throttle, debounce } from 'throttle-debounce'

import {
  authenticationType,
  autoQLConfigType,
  dataFormattingType,
  themeConfigType
} from '../../props/types'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  themeConfigDefault
} from '../../props/defaults'

import { LIGHT_THEME, DARK_THEME } from '../../js/Themes'
import { setStyleVars } from '../../js/Util'

// Components
import { Icon } from '../Icon'
import { ChatBar } from '../ChatBar'
import { ChatMessage } from '../ChatMessage'
import { Button } from '../Button'
import { QueryTipsTab } from '../QueryTipsTab'
import {
  runDrilldown,
  cancelQuery,
  fetchQueryTips
} from '../../js/queryService'

// Styles
import 'rc-drawer/assets/index.css'
import './DataMessenger.scss'

export default class DataMessenger extends React.Component {
  introMessageObject = {
    id: 'intro',
    isResponse: true,
    type: 'text',
    content: ''
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
    isVisible: bool,
    width: number,
    height: number,
    showHandle: bool,
    handleImage: string,
    handleStyles: shape({}),
    shiftScreen: bool,
    customerName: string,
    clearOnClose: bool,
    enableVoiceRecord: bool,
    title: string,
    maxMessages: number,
    introMessage: string,
    enableQueryTipsTab: bool,
    enableColumnEditor: bool,
    resizable: bool,

    // Callbacks
    onVisibleChange: func,
    onHandleClick: func
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
    customerName: 'there',
    clearOnClose: false,
    enableVoiceRecord: true,
    title: 'Data Messenger',
    maxMessages: undefined,
    introMessage: undefined,
    enableQueryTipsTab: true,
    enableColumnEditor: true,
    resizable: true,

    // Callbacks
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {
    activePage: 'messenger',
    width: this.props.width,
    height: this.props.height,
    isResizing: false,

    stateScrollTop: 0,
    lastMessageId: 'intro',
    isClearMessageConfirmVisible: false,
    messages: [this.introMessageObject],

    queryTipsList: undefined,
    queryTipsLoading: false,
    queryTipsError: false,
    queryTipsPage: 0,
    queryTipsTotalPages: undefined,
    queryTipsCurrentPage: 0
  }

  componentDidMount = () => {
    this.setStyles()
    this.setIntroMessageObject()

    // Listen for esc press to cancel queries while they are running
    document.addEventListener('keydown', this.escFunction, false)

    // There is a bug with react tooltips where it doesnt bind properly right when the component mounts
    setTimeout(() => {
      ReactTooltip.rebuild()
    }, 100)
  }

  componentDidUpdate = prevProps => {
    if (this.props.isVisible && !prevProps.isVisible) {
      if (this.chatBarRef) {
        this.chatBarRef.focus()
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
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.escFunction, false)
  }

  escFunction = event => {
    if (this.props.isVisible && event.keyCode === 27) {
      cancelQuery()
    }
  }

  setIntroMessageObject = () => {
    this.introMessageObject.content = this.props.introMessage
      ? `${this.props.introMessage}`
      : `Hi ${this.props.customerName ||
          'there'}! I'm here to help you access, search and analyze your data.`

    this.setState({ messages: [this.introMessageObject] })
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

    setStyleVars({ themeStyles, prefix: '--chata-drawer-' })
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
            <Icon type="chata-bubbles" />
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
    }, 50)
  }

  onInputSubmit = text => {
    this.addRequestMessage(text)
    this.setState({ isChataThinking: true })
  }

  onSuggestionClick = (suggestion, isButtonClick, skipSafetyNet, source) => {
    if (this.chatBarRef) {
      this.chatBarRef.animateInputTextAndSubmit(
        suggestion,
        skipSafetyNet,
        source
      )
    }
  }

  onResponse = response => {
    this.addResponseMessage({ response })
    this.setState({ isChataThinking: false })
    if (this.chatBarRef) {
      this.chatBarRef.focus()
    }
  }

  processDrilldown = (groupByObject, queryID, singleValueResponse) => {
    if (!this.props.autoQLConfig.disableDrilldowns) {
      // We only want to allow empty groupByObjects for single value responses
      if (
        !singleValueResponse &&
        (!groupByObject || JSON.stringify(groupByObject) === JSON.stringify({}))
      ) {
        return
      }

      // // This is a hack.
      // // How do we get the right text?? Can we make an api call to get the text first?
      // const drilldownText = `Drill down on ${columns[0].title} "${formatElement(
      //   rowData[0],
      //   columns[0],
      //   config: this.props.dataFormatting
      // )}"`
      // this.addRequestMessage('drilldown')

      this.setState({ isChataThinking: true })

      runDrilldown({
        ...this.props.authentication,
        queryID,
        groupByObject
      })
        .then(response => {
          this.addResponseMessage({
            response: { ...response, disableDrilldowns: true }
          })
          this.setState({ isChataThinking: false })
        })
        .catch(() => {
          this.setState({ isChataThinking: false })
        })
    }
  }

  clearMessages = () => {
    if (this.chatBarRef) {
      this.chatBarRef.focus()
    }

    this.setState({
      messages: [this.introMessageObject],
      lastMessageId: 'intro',
      isClearMessageConfirmVisible: false
    })
  }

  createErrorMessage = content => {
    return {
      content:
        content ||
        'Oops... Something went wrong with this query. Please try again. If the problem persists, please contact the customer success team.',
      id: uuid.v4(),
      type: 'error',
      isResponse: true
    }
  }

  createMessage = (response, content) => {
    const id = uuid.v4()
    this.setState({ lastMessageId: id })

    return {
      content,
      response,
      id,
      type: _get(response, 'data.data.display_type'),
      isResponse: true
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
      isResponse: false
    }
    this.setState({
      messages: [...currentMessages, message]
    })
    this.scrollToBottom()
  }

  addResponseMessage = ({ response, content }) => {
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
      message = this.createErrorMessage(
        `Uh oh.. It looks like you don't have access to this resource. 

        Please double check that all the required authentication fields are provided.`
      )
    } else if (_get(response, 'error') === 'parse error') {
      // Invalid response JSON
      message = this.createErrorMessage()
    } else if (!response && !content) {
      message = this.createErrorMessage()
    } else {
      message = this.createMessage(response, content)
    }
    this.setState({
      messages: [...currentMessages, message]
    })
    this.scrollToBottom()
  }

  setActiveMessage = id => {
    this.setState({ activeMessageId: id })
  }

  setChatBarRef = ref => {
    this.chatBarRef = ref
  }

  renderPageSwitcher = () => {
    const page = this.state.activePage

    if (this.props.isVisible) {
      return (
        <div
          className={`page-switcher-shadow-container  ${this.props.placement}`}
          // style={tabStyles.tabShadowContainerStyle}
        >
          <div className={`page-switcher-container ${this.props.placement}`}>
            <div
              className={`tab${page === 'messenger' ? ' active' : ''}`}
              onClick={() => this.setState({ activePage: 'messenger' })}
              data-tip="Data Messenger"
              data-for="chata-header-tooltip"
              data-delay-show={1000}
              // style={{ ...tabStyles.tabStyle, ...tabStyles.messengerTabStyle }}
            >
              <Icon type="chata-bubbles-outlined" />
            </div>
            <div
              className={`tab${page === 'tips' ? ' active' : ''} tips`}
              onClick={() => this.setState({ activePage: 'tips' })}
              data-tip="Query Inspiration"
              data-for="chata-header-tooltip"
              data-delay-show={1000}
              // style={{ ...tabStyles.tabStyle, ...tabStyles.tipsTabStyle }}
            >
              <Icon type="light-bulb" size={22} />
            </div>
          </div>
        </div>
      )
    }
  }

  renderClearMessagesButton = () => {
    if (this.state.activePage === 'messenger') {
      return (
        <Popover
          isOpen={this.state.isClearMessageConfirmVisible}
          onClickOutside={() =>
            this.setState({ isClearMessageConfirmVisible: false })
          }
          position={'bottom'} // preferred position
          content={
            <div className="clear-messages-confirm-popover">
              <div className="chata-confirm-text">
                <Icon className="chata-confirm-icon" type="warning" />
                Clear all messages?
              </div>
              <Button
                type="default"
                size="small"
                onClick={() =>
                  this.setState({ isClearMessageConfirmVisible: false })
                }
              >
                No
              </Button>
              <Button
                type="primary"
                size="small"
                onClick={() => this.clearMessages()}
              >
                Yes
              </Button>
            </div>
          }
        >
          <button
            onClick={() =>
              this.setState({ isClearMessageConfirmVisible: true })
            }
            className="chata-button clear-all"
            data-tip="Clear Messages"
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
    if (this.state.activePage === 'messenger') {
      title = this.props.title
    }
    if (this.state.activePage === 'tips') {
      title = 'What Can I Ask?'
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
            data-tip="Close Drawer"
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
      case 'messenger': {
        return this.renderDataMessengerContent()
      }
      case 'tips': {
        return this.renderQueryTipsContent()
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
          <div style={{ height: 'calc(100% - 20px)' }}>
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
                    processDrilldown={this.processDrilldown}
                    isResponse={message.isResponse}
                    isChataThinking={this.state.isChataThinking}
                    onSuggestionClick={this.onSuggestionClick}
                    content={message.content}
                    scrollToBottom={this.scrollToBottom}
                    lastMessageId={this.state.lastMessageId}
                    dataFormatting={this.props.dataFormatting}
                    enableColumnEditor={this.props.enableColumnEditor}
                    displayType={
                      message.displayType ||
                      _get(message, 'response.data.data.display_type')
                    }
                    response={message.response}
                    type={message.type}
                  />
                )
              })}
          </div>
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
          <ChatBar
            authentication={this.props.authentication}
            autoQLConfig={this.props.autoQLConfig}
            ref={this.setChatBarRef}
            test={this.props.autoQLConfig.test}
            className="chat-drawer-chat-bar"
            onSubmit={this.onInputSubmit}
            onResponseCallback={this.onResponse}
            isDisabled={this.state.isChataThinking}
            enableVoiceRecord={this.props.enableVoiceRecord}
            autoCompletePlacement="top"
            showChataIcon={false}
            showLoadingDots={false}
          />
        </div>
      </Fragment>
    )
  }

  fetchQueryTipsList = (keywords, offset, skipSafetyNet) => {
    this.setState({ queryTipsLoading: true, queryTipsKeywords: keywords })

    const containerElement = document.querySelector(
      '.query-tips-page-container'
    )
    const limit = Math.floor((containerElement.clientHeight - 150) / 50)

    fetchQueryTips({
      ...this.props.authentication,
      keywords,
      limit,
      offset,
      skipSafetyNet
    })
      .then(response => {
        // if caught by safetynet...
        if (_get(response, 'data.full_suggestion')) {
          this.setState({
            queryTipsLoading: false,
            queryTipsSafetyNetResponse: response
          })
        } else {
          const totalQueries = Number(_get(response, 'data.data.total'))
          const offset = Number(_get(response, 'data.data.offset'))

          this.setState({
            queryTipsList: _get(response, 'data.data.queries'),
            queryTipsLoading: false,
            queryTipsError: false,
            queryTipsTotalPages: totalQueries
              ? Math.ceil(totalQueries / limit)
              : 0,
            queryTipsCurrentPage: offset ? offset / limit : 0,
            queryTipsSafetyNetResponse: undefined
          })
        }
      })
      .catch(() =>
        this.setState({
          queryTipsLoading: false,
          queryTipsError: true,
          queryTipsSafetyNetResponse: undefined
        })
      )
  }

  onQueryTipsInputKeyPress = e => {
    if (e.key == 'Enter') {
      this.fetchQueryTipsList(e.target.value, 0)
    } else {
      this.setState({ queryTipsInputValue: e.target.value })
    }
  }

  onQueryTipsPageChange = ({ selected }) => {
    const containerElement = document.querySelector(
      '.query-tips-page-container'
    )
    const limit = Math.floor((containerElement.clientHeight - 150) / 50)
    const nextOffset = limit * selected
    this.fetchQueryTipsList(this.state.queryTipsKeywords, nextOffset, true)
  }

  onQueryTipsSafetyNetSuggestionClick = keywords => {
    this.setState({ queryTipsInputValue: keywords })
    this.fetchQueryTipsList(keywords, 0, true)
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
        this.setState({ activePage: 'messenger' })
        setTimeout(() => {
          this.onSuggestionClick(query, undefined, undefined, 'inspirations')
        }, 500)
      }}
    />
  )

  resizeDrawer = e => {
    const self = this
    const placement = this.getPlacementProp()

    if (placement === 'right') {
      const offset = _get(self.state.startingResizePosition, 'x') - e.pageX
      const newWidth = _get(self.state.startingResizePosition, 'width') + offset
      if (Number(newWidth)) {
        self.setState({
          width: newWidth
        })
      }
    } else if (placement === 'left') {
      const offset = e.pageX - _get(self.state.startingResizePosition, 'x')
      const newWidth = _get(self.state.startingResizePosition, 'width') + offset
      if (Number(newWidth)) {
        self.setState({
          width: newWidth
        })
      }
    } else if (placement === 'bottom') {
      const offset = _get(self.state.startingResizePosition, 'y') - e.pageY
      const newHeight =
        _get(self.state.startingResizePosition, 'height') + offset
      if (Number(newHeight)) {
        self.setState({
          height: newHeight
        })
      }
    } else if (placement === 'top') {
      const offset = e.pageY - _get(self.state.startingResizePosition, 'y')
      const newHeight =
        _get(self.state.startingResizePosition, 'height') + offset
      if (Number(newHeight)) {
        self.setState({
          height: newHeight
        })
      }
    }
  }

  stopResizingDrawer = () => {
    this.setState({
      isResizing: false
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
                height: this.state.height
              }
            })
            window.addEventListener('mousemove', self.resizeDrawer)
            window.addEventListener('mouseup', self.stopResizingDrawer)
          }}
        />
      )
    }
    return null
  }

  render = () => {
    return (
      <Fragment>
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
          // onKeyDown={this.escFunction}
        >
          {this.props.resizable && this.renderResizeHandle()}
          {this.props.enableQueryTipsTab && this.renderPageSwitcher()}
          <div className="chata-drawer-content-container">
            <div className="chat-header-container">
              {this.renderHeaderContent()}
            </div>
            {this.renderBodyContent()}
          </div>
        </Drawer>
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-header-tooltip"
          effect="solid"
          delayShow={500}
        />
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-toolbar-btn-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
        <ReactTooltip
          className="interpretation-tooltip"
          id="interpretation-tooltip"
          effect="solid"
          delayShow={500}
          delayHide={200}
          clickable
          html
        />
        <ReactTooltip
          className="chata-chart-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
        <ReactTooltip
          id="select-tooltip"
          className="chata-drawer-tooltip"
          effect="solid"
          delayShow={500}
        />
      </Fragment>
    )
  }
}
