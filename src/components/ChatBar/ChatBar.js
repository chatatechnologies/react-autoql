import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import { reviewData } from '../../testData/reviews.js'
import { runQuery } from '../../js/queryService'

import SpeechToTextButton from '../SpeechToTextButton/SpeechToTextButton.js'

import styles from './ChatBar.css'

const speechRecognitionOptions = {
  autoStart: false,
  continuous: false
}

export default class ChatBar extends React.Component {
  static propTypes = {
    // apiKey: PropTypes.string.isRequired,
    // dataSourceKey: PropTypes.string.isRequired,
    enableVoiceRecord: PropTypes.bool,
    isDisabled: PropTypes.bool,
    onSubmit: PropTypes.func,
    onResponseCallback: PropTypes.func,
    className: PropTypes.string,
    token: PropTypes.string.isRequired
  }

  static defaultProps = {
    enableVoiceRecord: false,
    isDisabled: false,
    onSubmit: () => {},
    onResponseCallback: () => {},
    className: null
  }

  state = {
    inputValue: ''
  }

  // setS2TRef = ref => {
  //   this.S2TRef = ref
  // }

  submitQuery = () => {
    if (this.state.inputValue.trim()) {
      this.props.onSubmit(this.state.inputValue)
      this.processQuery()
        .then(response => {
          this.props.onResponseCallback(response)
        })
        .catch(error => {
          this.props.onResponseCallback(error)
        })
    }
    this.setState({ inputValue: '' })
  }

  processQuery = () => {
    // send this.state.inputValue to query endpoint
    // along with this.props.apiKey and this.props.dataSourceKey
    return runQuery(this.state.inputValue, this.props.token)
      .then(response => {
        return Promise.resolve(response)
      })
      .catch(() => {
        return Promise.reject()
      })
    // return new Promise((resolve, reject) =>
    //   setTimeout(() => {
    //     resolve(reviewData)
    //   }, 500)
    // )
  }

  onKeyPress = e => {
    if (e.key == 'Enter') {
      this.submitQuery()
    }
  }

  onTranscriptChange = newTranscript => {
    this.setState({ inputValue: newTranscript })
  }

  onFinalTranscript = newTranscript => {
    this.submitQuery()
  }

  setInputRef = ref => {
    this.inputRef = ref
  }

  focus = () => {
    if (this.inputRef) {
      this.inputRef.focus()
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
            onChange={e => this.setState({ inputValue: e.target.value })}
            onKeyPress={this.onKeyPress}
            disabled={this.props.isDisabled}
            ref={this.setInputRef}
            autoFocus
          />
          {this.props.enableVoiceRecord && (
            <SpeechToTextButton
              // ref={this.setS2TRef}
              onTranscriptChange={this.onTranscriptChange}
              onFinalTranscript={this.onFinalTranscript}
            />
          )}
        </div>
      </Fragment>
    )
  }
}
