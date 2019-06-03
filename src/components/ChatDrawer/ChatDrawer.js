import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import Drawer from 'rc-drawer'

import { ChatBar } from '../ChatBar'
import { ChatMessage } from '../ChatMessage'

import rcStyles from 'rc-drawer/assets/index.css'
import styles from './ChatDrawer.css'

export default class ChatDrawer extends React.Component {
  static propTypes = {
    placement: PropTypes.string,
    maskClosable: PropTypes.bool,
    onVisibleChange: PropTypes.func,
    isVisible: PropTypes.bool,
    showHandle: PropTypes.bool,
    // customHandle: PropTypes.ReactElement,
    theme: PropTypes.string,
    handleStyles: PropTypes.shape({})
  }

  static defaultProps = {
    placement: 'right',
    maskClosable: true,
    isVisible: false,
    width: '500px',
    height: '300px',
    // customHandle: undefined, // not working atm
    showHandle: true,
    theme: 'light',
    handleStyles: {},
    onHandleClick: () => {},
    onVisibleChange: () => {}
  }

  state = {
    messages: [
      {
        isResponse: true,
        text:
          "Hi there! I'm here to help you access, search and analyze your data."
      },
      {
        isResponse: false,
        text: 'What is my current cash balance?'
      }
    ]
  }

  getHandlerProp = () => {
    if (this.props.customHandle !== undefined) {
      console.log('using custom handle')
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
    this.props.onHandleClick()
  }

  addMessage = newMessage => {
    this.setState({
      messages: [...this.state.messages, newMessage]
    })
  }

  clearMessages = () => {
    this.setState({ messages: [] })
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${rcStyles}`}</style>
        <style>{`${styles}`}</style>
        <Drawer
          // prefixCls={prefixCls}
          // style={this.getRcDrawerStyle()}
          // className={classNames(wrapClassName, className, haveMask)}
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
        >
          <div className="chat-drawer-content-container">
            <div className="chat-header-container" />
            <div className="chat-message-container">
              {this.state.messages.length > 0 &&
                this.state.messages.map(message => {
                  return (
                    <ChatMessage
                      isResponse={message.isResponse}
                      text={message.text}
                    />
                  )
                })}
            </div>
            <div className="chat-bar-container">
              <ChatBar className="chat-drawer-chat-bar" />
            </div>
          </div>
        </Drawer>
      </Fragment>
    )
  }
}

export const closeDrawer = () => {}
