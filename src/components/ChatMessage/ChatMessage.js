import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import styles from './ChatMessage.css'

export default class ChatMessage extends React.Component {
  static propTypes = {
    isResponse: PropTypes.bool.isRequired,
    setActiveMessage: PropTypes.func,
    isActive: PropTypes.bool,
    type: PropTypes.string,
    text: PropTypes.string,
    id: PropTypes.string.isRequired
  }

  static defaultProps = {
    setActiveMessage: () => {},
    isActive: false,
    type: 'text',
    text: null
  }

  state = {}

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          className={`chat-single-message-container
          ${this.props.isResponse ? ' response' : ' request'}`}
        >
          <div
            className={`chat-message-bubble
            ${this.props.type !== 'text' ? ' full-width' : ''}
            ${this.props.isActive ? ' active' : ''}`}
            // onClick={() => this.props.setActiveMessage(this.props.id)}
          >
            {this.props.content}
          </div>
          {
            // <div className="toolbar">
            //   <button className="hover-toolbar-options">A</button>
            //   <button className="hover-toolbar-options">B</button>
            //   <button className="hover-toolbar-options">C</button>
            //   <button className="hover-toolbar-options">D</button>
            // </div>
          }
        </div>
      </Fragment>
    )
  }
}
