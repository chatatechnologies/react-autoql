import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import uuid from 'uuid'

import Drawer from 'rc-drawer'

import { Scrollbars } from 'react-custom-scrollbars'

import { ChatBar } from '../ChatBar'
import { ChatMessage } from '../ChatMessage'
import { ResponseRenderer } from '../ResponseRenderer'
import { runQuery, runDrilldown } from '../../js/queryService'

import rcStyles from 'rc-drawer/assets/index.css'
import chataTableStyles from '../ChataTable/ChataTable.css'
import styles from './ChatDrawer.css'

export default class ChatDrawer extends React.Component {
  LIGHT_THEME = {
    '--accent-color': '#28a8e0',
    '--background-color': '#fff',
    '--border-color': '#d3d3d352',
    '--text-color-primary': '#5d5d5d',
    '--text-color-placeholder': '#0009c'
  }

  DARK_THEME = {
    '--accent-color': '#527788',
    '--background-color': '#636363',
    '--border-color': '#d3d3d329',
    '--text-color-primary': '#fff',
    '--text-color-placeholder': '#ffffff9c'
  }

  static propTypes = {
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
    token: PropTypes.string.isRequired,
    enableAutocomplete: PropTypes.bool,
    clearOnClose: PropTypes.bool,
    accentColor: PropTypes.bool
  }

  static defaultProps = {
    placement: 'right',
    maskClosable: true,
    isVisible: false,
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
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {
    messages: [
      {
        id: uuid.v4(),
        isResponse: true,
        type: 'text',
        content: `Hi ${this.props.customerName}! I'm here to help you access, search and analyze your data.`
      }
    ]
  }

  componentDidMount = () => {
    const themeStyles =
      this.props.theme === 'light' ? this.LIGHT_THEME : this.DARK_THEME
    this.setStyles(themeStyles)
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
  }

  setStyles = themeStyles => {
    for (let property in themeStyles) {
      document.documentElement.style.setProperty(
        property,
        themeStyles[property]
      )
    }
    if (this.props.accentColor) {
      document.documentElement.style.setProperty(
        '--accent-color',
        this.props.accentColor
      )
    }
  }

  getHandlerProp = () => {
    if (this.props.customHandle !== undefined) {
      return this.props.customHandle
    } else if (this.props.showHandle) {
      return (
        <div className="drawer-handle" style={this.props.handleStyles}>
          <i className="drawer-handle-icon" />
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

  // Required to make animation smooth
  scrollToBottom = () => {
    const self = this
    setTimeout(() => {
      self.scrollComponent.scrollToBottom()
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
        this.addResponseMessage('Thank you for your feedback.')
        this.setState({ isChataThinking: false })
      }, 1000)
      return
    }

    runQuery(suggestion, this.props.token)
      .then(response => {
        this.onResponse(response)
      })
      .catch(error => {
        this.onResponse(error)
      })
  }

  onResponse = response => {
    this.addResponseMessage(response)
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

  processDrilldown = (origRowData, columns, queryID) => {
    if (this.props.isDrilldownEnabled) {
      const rowData = origRowData.getData()
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

      runDrilldown(bodyJSON, this.props.token)
        .then(response => {
          this.addResponseMessage({ ...response, isDrilldownDisabled: true })
          this.setState({ isChataThinking: false })
        })
        .catch(() => {
          this.setState({ isChataThinking: false })
        })
    }
  }

  clearMessages = () => {
    this.setState({ messages: [] })
  }

  createErrorMessage = () => {
    return {
      content: 'This is an error message.',
      id: uuid.v4(),
      type: 'error',
      isResponse: true
    }
  }

  createDrilldownMessage = () => {
    return {
      content: 'Drilldown Response goes here.',
      id: uuid.v4(),
      type: 'drilldown',
      isResponse: true
    }
  }

  createMessage = response => {
    let content
    if (typeof response === 'string') {
      content = response
    } else {
      content = (
        <ResponseRenderer
          processDrilldown={this.processDrilldown}
          response={response}
          isDrilldownDisabled={!!response.isDrilldownDisabled}
          onSuggestionClick={suggestion => this.onSuggestionClick(suggestion)}
          isQueryRunning={this.state.isChataThinking}
        />
      )
    }
    return {
      content,
      id: uuid.v4(),
      type: response && response.data && response.data.display_type,
      isResponse: true
    }
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

  addResponseMessage = response => {
    if (this.state.messages.length > 10) {
      // shift item from beginning of messages array
    }
    let message = {}
    if (!response) {
      console.log(
        'something went wrong.... probably a network error displaying general error message'
      )
      message = this.createErrorMessage()
    } else {
      message = this.createMessage(response)
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
      <button
        onClick={() => {
          this.clearMessages()
          if (this.chatBarRef) {
            this.chatBarRef.focus()
          }
        }}
        className="chata-button"
      >
        Clear All
      </button>
    )
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${rcStyles}`}</style>
        <style>{`${styles}`}</style>
        <style>{`${chataTableStyles}`}</style>
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
              {!!this.state.activeMessageId && (
                <Fragment>
                  <button className="chata-drawer-header-button">A</button>
                  <button className="chata-drawer-header-button">B</button>
                  <button className="chata-drawer-header-button">C</button>
                  <button className="chata-drawer-header-button">D</button>
                </Fragment>
              )}
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
                      setActiveMessage={this.setActiveMessage}
                      isActive={this.state.activeMessageId === message.id}
                      isResponse={message.isResponse}
                      content={message.content}
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
              <ChatBar
                ref={this.setChatBarRef}
                className="chat-drawer-chat-bar"
                onSubmit={this.onInputSubmit}
                onResponseCallback={this.onResponse}
                isDisabled={this.state.isChataThinking}
                token={this.props.token}
                enableAutocomplete={this.props.enableAutocomplete}
                enableVoiceRecord
              />
            </div>
          </div>
        </Drawer>
      </Fragment>
    )
  }
}
