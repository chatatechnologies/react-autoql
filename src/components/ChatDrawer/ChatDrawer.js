import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import Drawer from 'rc-drawer'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'
import _get from 'lodash.get'
import { Scrollbars } from 'react-custom-scrollbars'

// Icons
import { MdClose } from 'react-icons/md'
import { MdLightbulbOutline } from 'react-icons/md'
import { FaRegTrashAlt } from 'react-icons/fa'
import { MdError } from 'react-icons/md'
import { IoIosSearch } from 'react-icons/io'
import chataBubblesSVG from '../../images/chata-bubbles.svg'
import { bubblesIcon } from '../../svgIcons.js'

// Components
import { ChatBar } from '../ChatBar'
import { ChatMessage } from '../ChatMessage'
import { Button } from '../Button'
import {
  runQuery,
  runQueryOnly,
  runDrilldown,
  cancelQuery
} from '../../js/queryService'

import { formatElement } from '../../js/Util'

// Styles
import rcStyles from 'rc-drawer/assets/index.css'
import chataTableStyles from '../ChataTable/ChataTable.css'
import messageStyles from '../ChatMessage/ChatMessage.css'
import styles from './ChatDrawer.css'

export default class ChatDrawer extends React.Component {
  LIGHT_THEME = {
    '--chata-drawer-accent-color': '#28a8e0',
    '--chata-drawer-background-color': '#fff',
    '--chata-drawer-border-color': '#d3d3d352',
    '--chata-drawer-hover-color': '#ececec',
    '--chata-drawer-text-color-primary': '#5d5d5d',
    '--chata-drawer-text-color-placeholder': '#0000009c',
    '--chata-drawer-font-family': 'sans-serif'
  }

  DARK_THEME = {
    '--chata-drawer-accent-color': '#525252', // dark gray
    // '--chata-drawer-accent-color': '#193a48', // dark blue
    '--chata-drawer-background-color': '#636363',
    '--chata-drawer-border-color': '#d3d3d329',
    '--chata-drawer-hover-color': '#5a5a5a',
    '--chata-drawer-text-color-primary': '#fff',
    '--chata-drawer-text-color-placeholder': '#ffffff9c',
    '--chata-drawer-font-family': 'sans-serif'
  }

  introMessageObject = {
    id: 'intro',
    isResponse: true,
    type: 'text',
    content: ''
  }

  static propTypes = {
    token: PropTypes.string,
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    username: PropTypes.string,
    domain: PropTypes.string,
    placement: PropTypes.string,
    maskClosable: PropTypes.bool,
    onVisibleChange: PropTypes.func,
    isVisible: PropTypes.bool,
    showHandle: PropTypes.bool,
    // customHandle: PropTypes.ReactElement,
    handleImage: PropTypes.string,
    theme: PropTypes.string,
    handleStyles: PropTypes.shape({}),
    shiftScreen: PropTypes.bool,
    disableDrilldowns: PropTypes.bool,
    customerName: PropTypes.string,
    enableAutocomplete: PropTypes.bool,
    clearOnClose: PropTypes.bool,
    accentColor: PropTypes.string,
    enableSafetyNet: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    enableVoiceRecord: PropTypes.bool,
    title: PropTypes.string,
    maxMessages: PropTypes.number,
    demo: PropTypes.bool,
    debug: PropTypes.bool,
    test: PropTypes.bool,
    currencyCode: PropTypes.string,
    languageCode: PropTypes.string,
    currencyDecimals: PropTypes.number,
    quantityDecimals: PropTypes.number,
    comparisonDisplay: PropTypes.string,
    enableQueryTipsTab: PropTypes.bool,
    enableColumnEditor: PropTypes.bool,
    chartColors: PropTypes.arrayOf(PropTypes.string)
  }

  static defaultProps = {
    token: undefined,
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    username: undefined,
    placement: 'right',
    maskClosable: true,
    isVisible: true,
    width: 500,
    height: 350,
    customHandle: undefined, // not working atm
    handleImage: undefined,
    showHandle: true,
    theme: 'light',
    handleStyles: {},
    shiftScreen: false,
    disableDrilldowns: false,
    customerName: 'there',
    enableAutocomplete: true,
    clearOnClose: false,
    accentColor: undefined,
    enableSafetyNet: true,
    enableAutocomplete: true,
    enableVoiceRecord: true,
    title: 'Data Messenger',
    maxMessages: undefined,
    demo: false,
    debug: false,
    test: false,
    introMessage: undefined,
    currencyCode: undefined,
    languageCode: undefined,
    currencyDecimals: undefined,
    quantityDecimals: undefined,
    chartColors: undefined,
    enableQueryTipsTab: true,
    enableColumnEditor: true,
    comparisonDisplay: 'ratio',
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {
    stateScrollTop: 0,
    messages: [this.introMessageObject],
    lastMessageId: 'intro',
    isClearMessageConfirmVisible: false,
    activePage: 'messenger',
    queryTipResults: []
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
    if (this.props.theme && this.props.theme !== prevProps.theme) {
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
    const themeStyles =
      this.props.theme === 'light' ? this.LIGHT_THEME : this.DARK_THEME
    for (let property in themeStyles) {
      document.documentElement.style.setProperty(
        property,
        themeStyles[property]
      )
    }
    if (this.props.accentColor) {
      document.documentElement.style.setProperty(
        '--chata-drawer-accent-color',
        this.props.accentColor
      )
    }
    if (this.props.fontFamily) {
      document.documentElement.style.setProperty(
        '--chata-drawer-font-family',
        this.props.fontFamily
      )
    }
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
          <img
            className="chata-bubbles-icon"
            src={this.props.handleImage || chataBubblesSVG}
            alt="chata.ai"
            height="22px"
            width="22px"
            draggable="false"
          />
        </div>
      )
    }
    return false
  }

  getHeightProp = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
      return null
    }
    return this.props.height
  }

  getWidthProp = () => {
    if (
      this.getPlacementProp() === 'right' ||
      this.getPlacementProp() === 'left'
    ) {
      return this.props.width
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

  onSuggestionClick = suggestion => {
    this.addRequestMessage(suggestion)
    this.setState({ isChataThinking: true })

    if (suggestion === 'None of these') {
      setTimeout(() => {
        this.addResponseMessage({ content: 'Thank you for your feedback.' })
        this.setState({ isChataThinking: false })
      }, 1000)
      return
    }

    runQueryOnly({
      query: suggestion,
      demo: this.props.demo,
      debug: this.props.debug,
      test: this.props.test,
      domain: this.props.domain,
      apiKey: this.props.apiKey,
      customerId: this.props.customerId,
      userId: this.props.userId,
      username: this.props.username,
      token: this.props.token
    })
      .then(response => {
        this.onResponse(response)
      })
      .catch(error => {
        this.onResponse(error)
      })
  }

  onResponse = response => {
    this.addResponseMessage({ response })
    this.setState({ isChataThinking: false })
    if (this.chatBarRef) {
      this.chatBarRef.focus()
    }
  }

  processDrilldown = (groupByObject, queryID, singleValueResponse) => {
    if (!this.props.disableDrilldowns) {
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
      //   this.props.currencyCode,
      //   this.props.languageCode
      // )}"`
      // this.addRequestMessage('drilldown')

      this.setState({ isChataThinking: true })

      runDrilldown({
        queryID,
        groupByObject,
        demo: this.props.demo,
        debug: this.props.debug,
        test: this.props.test,
        domain: this.props.domain,
        apiKey: this.props.apiKey,
        customerId: this.props.customerId,
        userId: this.props.userId,
        username: this.props.username,
        token: this.props.token
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
      type:
        response &&
        response.data &&
        response.data.data &&
        response.data.data.display_type,
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
              {bubblesIcon}
            </div>
            <div
              className={`tab${page === 'tips' ? ' active' : ''}`}
              onClick={() => this.setState({ activePage: 'tips' })}
              data-tip="Query Tips"
              data-for="chata-header-tooltip"
              data-delay-show={1000}
              // style={{ ...tabStyles.tabStyle, ...tabStyles.tipsTabStyle }}
            >
              <MdLightbulbOutline size={22} />
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
                <MdError className="chata-confirm-icon" />
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
            <FaRegTrashAlt />
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
            <MdClose />
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

  renderDataMessengerContent = () => {
    return (
      <Fragment>
        <Scrollbars
          ref={c => {
            this.messengerScrollComponent = c
          }}
          className="chat-message-container"
        >
          <div
            style={{
              // height: 'calc(100% - 20px)'
              height: 'calc(100% - 20px)'
              // width: '100%',
              // position: 'relative'
            }}
          >
            {this.state.messages.length > 0 &&
              this.state.messages.map(message => {
                return (
                  <ChatMessage
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
                    currencyCode={this.props.currencyCode}
                    languageCode={this.props.languageCode}
                    currencyDecimals={this.props.currencyDecimals}
                    quantityDecimals={this.props.quantityDecimals}
                    chartColors={this.props.chartColors}
                    comparisonDisplay={this.props.comparisonDisplay}
                    enableColumnEditor={this.props.enableColumnEditor}
                    tableBorderColor={
                      this.props.theme === 'light'
                        ? this.LIGHT_THEME['--chata-drawer-border-color']
                        : this.DARK_THEME['--chata-drawer-border-color']
                    }
                    tableHoverColor={
                      this.props.theme === 'light'
                        ? this.LIGHT_THEME['--chata-drawer-hover-color']
                        : this.DARK_THEME['--chata-drawer-hover-color']
                    }
                    displayType={
                      message.displayType ||
                      (message.response &&
                        message.response.data &&
                        message.response.data.data &&
                        message.response.data.data.display_type)
                    }
                    response={message.response}
                    type={message.type}
                    key={message.id}
                    id={message.id}
                    debug={this.props.debug}
                    demo={this.props.demo}
                    apiKey={this.props.apiKey}
                    userId={this.props.userId}
                    token={this.props.token}
                    domain={this.props.domain}
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
          <div className="watermark">{bubblesIcon} We run on chata</div>
          <ChatBar
            ref={this.setChatBarRef}
            token={this.props.token}
            apiKey={this.props.apiKey}
            customerId={this.props.customerId}
            userId={this.props.userId}
            username={this.props.username}
            domain={this.props.domain}
            demo={this.props.demo}
            debug={this.props.debug}
            test={this.props.test}
            className="chat-drawer-chat-bar"
            onSubmit={this.onInputSubmit}
            onResponseCallback={this.onResponse}
            isDisabled={this.state.isChataThinking}
            enableAutocomplete={this.props.enableAutocomplete}
            enableSafetyNet={this.props.enableSafetyNet}
            enableVoiceRecord={this.props.enableVoiceRecord}
            autoCompletePlacement="top"
            showChataIcon={false}
            showLoadingDots={false}
          />
        </div>
      </Fragment>
    )
  }

  onQueryTipsInputKeyPress = e => {
    if (e.key == 'Enter') {
      console.log('submit topic')
    }
  }

  renderQueryTipsContent = () => (
    <Scrollbars
      ref={c => {
        this.queryTipsScrollComponent = c
      }}
    >
      <div className="query-tips-page-container">
        <div
          className="chata-input-container"
          style={{ animation: 'slideDown 0.5s ease' }}
        >
          <input
            className="chata-input left-padding"
            placeholder="Enter a Topic..."
            value={this.state.queryTipsInputValue}
            onChange={e =>
              this.setState({ queryTipsInputValue: e.target.value })
            }
            onKeyPress={this.onQueryTipsInputKeyPress}
            ref={ref => (this.queryTipsInputRef = ref)}
            autoFocus
          />
          <div className="chat-bar-input-icon">
            <IoIosSearch
              style={{ width: '19px', height: '20px', color: '#999' }}
            />
          </div>
        </div>
        <div className="query-tips-result-container">
          {!_get(this.state.queryTipResults, 'length') ? (
            <div>
              <p>Your query suggestions will show up here.</p>
              <p>
                You can copy them for later use or execute them in the data
                messenger by hitting the “execute” button
              </p>
            </div>
          ) : (
            <div></div>
          )}
        </div>
      </div>
    </Scrollbars>
  )

  render = () => {
    let drawerContent
    switch (this.state.activePage) {
      case 'messenger': {
        drawerContent = this.renderDataMessengerContent()
        break
      }
      case 'tips': {
        drawerContent = this.renderQueryTipsContent()
        break
      }
    }

    return (
      <Fragment>
        <style>{`${chataTableStyles}`}</style>
        <style>{`${messageStyles}`}</style>
        <style>{`${styles}`}</style>
        <style>{`${rcStyles}`}</style>
        <Drawer
          data-test="chata-drawer-test"
          className="chata-drawer"
          open={this.props.isVisible}
          showMask={this.props.showMask}
          placement={this.getPlacementProp()}
          width={this.getWidthProp()}
          height={this.getHeightProp()}
          onMaskClick={this.handleMaskClick}
          onHandleClick={this.props.onHandleClick}
          afterVisibleChange={this.props.onVisibleChange}
          handler={this.getHandlerProp()}
          level={this.props.shiftScreen ? 'all' : null}
          keyboard={false}
          // onKeyDown={this.escFunction}
        >
          {this.props.enableQueryTipsTab && this.renderPageSwitcher()}
          <div className="chata-drawer-content-container">
            <div className="chat-header-container">
              {this.renderHeaderContent()}
            </div>
            {drawerContent}
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
      </Fragment>
    )
  }
}
