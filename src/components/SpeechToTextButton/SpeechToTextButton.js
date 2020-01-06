import React, { Fragment } from 'react'

import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import SpeechRecognition from 'react-speech-recognition'

import microphoneIconSVG from '../../images/microphone-voice-interface-symbol.svg'

import './SpeechToTextButton.scss'

const options = {
  autoStart: false,
  continuous: false
}

class Dictaphone extends React.Component {
  static propTypes = {
    transcript: PropTypes.string,
    interimTranscript: PropTypes.string,
    finalTranscript: PropTypes.string,
    resetTranscript: PropTypes.func,
    browserSupportsSpeechRecognition: PropTypes.bool,
    startListening: PropTypes.func,
    stopListening: PropTypes.func,
    listening: PropTypes.bool,
    onTranscriptChange: PropTypes.func,
    onFinalTranscript: PropTypes.func
  }

  static defaultProps = {}

  componentDidUpdate = prevProps => {
    if (this.props.finalTranscript !== prevProps.finalTranscript) {
      this.props.onFinalTranscript(this.props.finalTranscript)
    } else if (this.props.transcript !== prevProps.transcript) {
      this.props.onTranscriptChange(this.props.transcript)
    } else if (this.props.interimTranscript !== prevProps.interimTranscript) {
      this.props.onTranscriptChange(this.props.interimTranscript)
    }
  }

  onMouseDown = () => {
    ReactTooltip.hide()
    this.props.startListening()
  }

  render = () => {
    const {
      transcript,
      interimTranscript,
      resetTranscript,
      browserSupportsSpeechRecognition,
      startListening,
      stopListening,
      listening
    } = this.props

    if (!browserSupportsSpeechRecognition) {
      return null
    }

    return (
      <Fragment data-test="speech-to-text-btn">
        <button
          id="chata-voice-record-button"
          className={`chat-voice-record-button${listening ? ' listening' : ''}`}
          onMouseDown={this.onMouseDown}
          onMouseUp={stopListening}
          onMouseLeave={this.props.listening ? stopListening : undefined}
          data-tip="Hold to Use Voice"
          data-for="chata-speech-to-text-tooltip"
          data-tip-disable={this.props.listening}
        >
          <img
            className="chat-voice-record-icon"
            src={microphoneIconSVG}
            alt="speech to text button"
            height="22px"
            width="22px"
            draggable="false"
          />
        </button>
        <ReactTooltip
          className="chata-tooltip"
          id="chata-speech-to-text-tooltip"
          effect="solid"
          delayShow={800}
        />
      </Fragment>
    )
  }
}

export default SpeechRecognition(options)(Dictaphone)
