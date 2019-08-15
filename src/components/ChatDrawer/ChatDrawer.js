import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import Drawer from 'rc-drawer'

// import * as d3 from 'd3'

import ReactTooltip from 'react-tooltip'

import { Scrollbars } from 'react-custom-scrollbars'
import { MdClearAll, MdClose } from 'react-icons/md'

import chataBubblesSVG from '../../images/chata-bubbles.svg'

import { ChatBar } from '../ChatBar'
import { ChatMessage } from '../ChatMessage'
import { runQuery, runDrilldown } from '../../js/queryService'

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
    '--chata-drawer-text-color-placeholder': '#0000009c'
  }

  DARK_THEME = {
    '--chata-drawer-accent-color': '#525252', // dark gray
    // '--chata-drawer-accent-color': '#193a48', // dark blue
    '--chata-drawer-background-color': '#636363',
    '--chata-drawer-border-color': '#d3d3d329',
    '--chata-drawer-hover-color': '#5a5a5a',
    '--chata-drawer-text-color-primary': '#fff',
    '--chata-drawer-text-color-placeholder': '#ffffff9c'
  }

  // move this to new file
  bubblesIcon = (
    <svg x="0px" y="0px" width="14px" height="13px" viewBox="0 0 16 14">
      <path
        className="chata-icon-svg-0"
        d="M15.1,13.5c0,0-0.5-0.3-0.5-1.7V9.6c0-1.9-1.1-3.7-2.9-4.4C11.5,5.1,11.3,5,11,5c-0.1-0.3-0.2-0.5-0.3-0.7l0,0
C9.9,2.5,8.2,1.4,6.3,1.4c0,0,0,0-0.1,0C5,1.4,3.8,1.9,2.8,2.8C1.9,3.6,1.4,4.8,1.4,6.1c0,0.1,0,0.1,0,0.2v2.2
c0,1.3-0.4,1.7-0.4,1.7h0l-1,0.7l1.2,0.1c0.8,0,1.7-0.2,2.3-0.7c0.2,0.2,0.5,0.3,0.8,0.4c0.2,0.1,0.5,0.2,0.8,0.2
c0.1,0.2,0.1,0.5,0.2,0.7c0.8,1.7,2.5,2.8,4.4,2.8c0,0,0.1,0,0.1,0c1,0,2-0.3,2.7-0.7c0.7,0.5,1.6,0.8,2.4,0.7l1.1-0.1L15.1,13.5z
M10.4,6.2c0,0.9-0.3,1.8-0.9,2.5C9.2,9,8.9,9.3,8.6,9.5C8.3,9.6,8.1,9.7,7.9,9.8C7.6,9.9,7.3,10,7.1,10c-0.3,0.1-0.6,0.1-0.8,0.1
c-0.1,0-0.3,0-0.4,0c0,0-0.1,0-0.1,0c0,0,0-0.1,0-0.1c0-0.1,0-0.2,0-0.4c0-0.8,0.2-1.6,0.7-2.2C6.5,7.2,6.7,7,6.9,6.8
C7,6.7,7.1,6.6,7.2,6.5c0.2-0.2,0.4-0.3,0.7-0.4C8.1,6,8.3,5.9,8.6,5.8C9,5.7,9.4,5.6,9.8,5.6c0.1,0,0.3,0,0.4,0c0,0,0.1,0,0.1,0
C10.4,5.8,10.4,6,10.4,6.2z M3.8,9.3L3.5,9.1L3.2,9.3C2.9,9.7,2.4,9.9,2,10c0.1-0.4,0.2-0.8,0.2-1.5l0-2.2c0,0,0-0.1,0-0.1
c0-1.1,0.5-2,1.2-2.8c0.7-0.7,1.7-1.1,2.7-1.1c0,0,0.1,0,0.1,0c1.6,0,3.1,0.9,3.8,2.3c0,0.1,0.1,0.2,0.1,0.3c-0.1,0-0.2,0-0.3,0
c-0.5,0-1,0.1-1.5,0.2C8.1,5.1,7.8,5.2,7.5,5.4C7.2,5.5,6.9,5.7,6.7,5.9C6.6,6,6.4,6.1,6.3,6.2C6.1,6.4,5.9,6.7,5.7,6.9
C5.2,7.7,4.9,8.6,4.9,9.6c0,0.1,0,0.2,0,0.3c-0.1,0-0.2-0.1-0.3-0.1C4.3,9.7,4,9.5,3.8,9.3z M12.8,12.7l-0.3-0.3l-0.3,0.3
c-0.5,0.5-1.4,0.8-2.4,0.8c-1.6,0.1-3.1-0.9-3.8-2.3c0-0.1-0.1-0.2-0.1-0.3c0.1,0,0.2,0,0.3,0c0.3,0,0.7,0,1-0.1
c0.3-0.1,0.6-0.1,0.9-0.3c0.3-0.1,0.6-0.3,0.8-0.4C9.4,9.9,9.7,9.6,10,9.2c0.7-0.8,1.1-1.9,1.1-3c0-0.1,0-0.3,0-0.4
c0.1,0,0.2,0.1,0.3,0.1c1.5,0.6,2.4,2.1,2.4,3.7v2.2c0,0.7,0.1,1.2,0.3,1.6C13.6,13.3,13.2,13.1,12.8,12.7z"
      />
    </svg>
  )

  static propTypes = {
    token: PropTypes.string,
    projectId: PropTypes.number,
    placement: PropTypes.string,
    maskClosable: PropTypes.bool,
    onVisibleChange: PropTypes.func,
    isVisible: PropTypes.bool,
    showHandle: PropTypes.bool,
    // customHandle: PropTypes.ReactElement,
    theme: PropTypes.string,
    handleStyles: PropTypes.shape({}),
    shiftScreen: PropTypes.bool,
    isDrilldownEnabled: PropTypes.bool,
    customerName: PropTypes.string,
    enableAutocomplete: PropTypes.bool,
    clearOnClose: PropTypes.bool,
    accentColor: PropTypes.bool,
    enableSafetyNet: PropTypes.bool,
    enableAutocomplete: PropTypes.bool,
    enableVoiceRecord: PropTypes.bool,
    title: PropTypes.string
  }

  static defaultProps = {
    token: undefined,
    projectId: undefined,
    placement: 'right',
    maskClosable: true,
    isVisible: true,
    width: 500,
    height: 350,
    // customHandle: undefined, // not working atm
    showHandle: true,
    theme: 'light',
    handleStyles: {},
    shiftScreen: false,
    isDrilldownEnabled: true,
    customerName: 'there',
    enableAutocomplete: true,
    clearOnClose: false,
    accentColor: undefined,
    enableSafetyNet: true,
    enableAutocomplete: true,
    enableVoiceRecord: true,
    title: 'chata.ai',
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {
    messages: [
      {
        id: 'intro',
        isResponse: true,
        type: 'text',
        content: `Hi ${this.props.customerName}! I'm here to help you access, search and analyze your data.`
      }
    ],
    lastMessageId: 'intro'
  }

  componentDidMount = () => {
    this.setStyles()
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
      // Do we want to do this? Or just clear all?
      this.setState({
        messages: [
          {
            id: uuid.v4(),
            isResponse: true,
            type: 'text',
            content: `Hi ${this.props.customerName}! I'm here to help you access, search and analyze your data.`
          }
        ]
      })
    }
    if (this.props.theme && this.props.theme !== prevProps.theme) {
      this.setStyles()
    }
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
            src={chataBubblesSVG}
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
    this.props.onMaskClick()
    this.props.onHandleClick()
  }

  scrollToBottom = () => {
    // Required to make animation smooth
    setTimeout(() => {
      if (this.scrollComponent) {
        this.scrollComponent.scrollToBottom()
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

    runQuery(
      suggestion,
      this.props.token,
      this.props.projectId,
      this.props.enableSafetyNet
    )
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

  getgroupByObjectFromTable = (rowData, origColumns, forceDateAxis) => {
    const jsonData = {}
    let columns = [...origColumns]

    if (!columns[0] || !columns[1]) {
      return
    }

    if (forceDateAxis) {
      // Swap first two columns if second one is DATE and first is not
      // rowData is already swapped here if necessary so don't swap again.
      if (
        (columns[0].type !== 'DATE' && columns[1].type === 'DATE') ||
        (columns[0].type !== 'DATE_STRING' && columns[1].type === 'DATE_STRING')
      ) {
        columns = [columns[1], columns[0], ...columns.slice(2)]
      }
    }

    columns.forEach((column, index) => {
      if (column.groupable) {
        const columnName = column.name
        if (column.type === 'DATE') {
          jsonData[columnName] = rowData[index]
        } else {
          jsonData[columnName.toLowerCase()] = rowData[index]
        }
      }
    })
    return jsonData
  }

  processDrilldown = (rowData, columns, queryID) => {
    if (this.props.isDrilldownEnabled) {
      const groupByObject = this.getgroupByObjectFromTable(
        rowData,
        columns,
        true
      )

      if (
        !groupByObject ||
        JSON.stringify(groupByObject) === JSON.stringify({})
      ) {
        return
      }

      const bodyJSON = {
        id: queryID,
        group_bys: groupByObject
      }

      // This is a hack.
      // How do we get the right text?? Can we make an api call to get the text first?
      const drilldownText = `Drill down on ${columns[0].title} "${rowData[0]}"`

      this.addRequestMessage(drilldownText)
      this.setState({ isChataThinking: true })

      runDrilldown(bodyJSON, this.props.token, this.props.projectId)
        .then(response => {
          this.addResponseMessage({
            response: { ...response, isDrilldownDisabled: true }
          })
          this.setState({ isChataThinking: false })
        })
        .catch(() => {
          this.setState({ isChataThinking: false })
        })
    }
  }

  clearMessages = () => {
    this.setState({
      messages: [this.state.messages[0]],
      lastMessageId: 'intro'
    })
  }

  createErrorMessage = () => {
    return {
      content: 'Network Error',
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
      type: response && response.data && response.data.display_type,
      isResponse: true,
      supportedDisplayTypes:
        response && response.data && response.data.supported_display_types
    }
  }

  updateMessageDisplayType = (id, displayType) => {
    const newMessages = this.state.messages.map(message => {
      if (message.id === id) {
        return {
          ...message,
          displayType
        }
      }
      return message
    })
    this.setState({ messages: newMessages })
  }

  addRequestMessage = text => {
    if (this.state.messages.length > 10) {
      // shift item from beginning of messages array
    }

    const message = {
      content: text,
      id: uuid.v4(),
      isResponse: false
    }
    this.setState({
      messages: [...this.state.messages, message]
    })
    this.scrollToBottom()
  }

  addResponseMessage = ({ response, content }) => {
    if (this.state.messages.length > 10) {
      // shift item from beginning of messages array
    }
    let message = {}
    if (!response && !content) {
      message = this.createErrorMessage()
    } else {
      message = this.createMessage(response, content)
    }
    this.setState({
      messages: [...this.state.messages, message]
    })
    this.scrollToBottom()
  }

  setActiveMessage = id => {
    this.setState({ activeMessageId: id })
  }

  setChatBarRef = ref => {
    this.chatBarRef = ref
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
        <div className="chata-header-center-container">{this.props.title}</div>
        <div className="chata-header-right-container">
          <button
            onClick={() => {
              this.clearMessages()
              if (this.chatBarRef) {
                this.chatBarRef.focus()
              }
            }}
            className="chata-button clear-all"
            data-tip="Clear Messages"
            data-for="chata-header-tooltip"
          >
            <MdClearAll />
          </button>
        </div>
      </Fragment>
    )
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${rcStyles}`}</style>
        <style>{`${styles}`}</style>
        <style>{`${chataTableStyles}`}</style>
        <style>{`${messageStyles}`}</style>
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
        >
          <div className="chata-drawer-content-container">
            <div className="chat-header-container">
              {this.renderHeaderContent()}
            </div>
            <Scrollbars
              ref={c => {
                this.scrollComponent = c
              }}
              className="chat-message-container"
            >
              {this.state.messages.length > 0 &&
                this.state.messages.map(message => {
                  return (
                    <ChatMessage
                      supportedDisplayTypes={message.supportedDisplayTypes}
                      setActiveMessage={this.setActiveMessage}
                      isActive={this.state.activeMessageId === message.id}
                      processDrilldown={this.processDrilldown}
                      isResponse={message.isResponse}
                      isChataThinking={this.state.isChataThinking}
                      onSuggestionClick={this.onSuggestionClick}
                      content={message.content}
                      scrollToBottom={this.scrollToBottom}
                      lastMessageId={this.state.lastMessageId}
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
                          message.response.data.display_type)
                      }
                      response={message.response}
                      type={message.type}
                      key={message.id}
                      id={message.id}
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
                {this.bubblesIcon} We run on Chata
              </div>
              <ChatBar
                ref={this.setChatBarRef}
                token={this.props.token}
                projectId={this.props.projectId}
                className="chat-drawer-chat-bar"
                onSubmit={this.onInputSubmit}
                onResponseCallback={this.onResponse}
                isDisabled={this.state.isChataThinking}
                enableAutocomplete={this.props.enableAutocomplete}
                enableSafetyNet={this.props.enableSafetyNet}
                enableVoiceRecord={this.props.enableVoiceRecord}
                autoCompletePlacement="top"
                showChataIcon={false}
              />
            </div>
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
      </Fragment>
    )
  }
}
