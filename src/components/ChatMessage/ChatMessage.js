import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import styles from './ChatMessage.css'

export default class ChatBar extends React.Component {
  static propTypes = {
    isResponse: PropTypes.bool.isRequired,
    text: PropTypes.string
  }

  static defaultProps = {
    text: null
  }

  state = {}

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div
          className={`chat-single-message-container ${
            this.props.isResponse ? 'response' : 'request'
          }`}
        >
          <div className="chat-message-bubble">{this.props.text}</div>
        </div>
      </Fragment>
    )
  }
}
