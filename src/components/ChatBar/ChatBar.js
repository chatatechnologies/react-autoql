import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import microphoneIconSVG from '../../images/microphone-voice-interface-symbol.svg'
import styles from './ChatBar.css'

export default class ChatBar extends React.Component {
  static propTypes = {
    enableVoiceRecord: PropTypes.bool
  }

  static defaultProps = {
    enableVoiceRecord: true
  }

  state = {
    inputValue: null
  }

  onKeyPress = e => {
    if (e.key == 'Enter') {
      // enter
      console.log('SUBMITTING QUERY')
      // submit query
      // .then(() => {
      //    process response message and call user callback prop if provided
      //    this.props.onResponseCallback()
      // })
    }
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div className={`chata-bar-container ${this.props.className}`}>
          <input
            className="chata-input"
            placeholder="Type a query"
            value={this.state.inputValue}
            onKeyPress={this.onKeyPress}
          />
          {this.props.enableVoiceRecord && (
            <button className="chat-voice-record-button">
              <img
                className="chat-voice-recor-icon"
                src={microphoneIconSVG}
                alt="voice to text button"
                height="24px"
                width="24px"
              />
            </button>
          )}
        </div>
      </Fragment>
    )
  }
}
