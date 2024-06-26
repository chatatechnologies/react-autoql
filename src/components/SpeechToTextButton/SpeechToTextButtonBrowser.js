import React from 'react'

import PropTypes from 'prop-types'
import { Tooltip } from '../Tooltip'
import SpeechRecognition from 'react-speech-recognition'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './SpeechToTextButton.scss'

const options = {
  autoStart: false,
  continuous: false,
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
    onFinalTranscript: PropTypes.func,
    onTranscriptStart: PropTypes.func,
  }

  static defaultProps = {
    onTranscriptStart: () => {},
    onTranscriptChange: () => {},
    onFinalTranscript: () => {},
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.finalTranscript !== prevProps.finalTranscript) {
      this.props.onFinalTranscript(this.props.finalTranscript)
    } else if (this.props.transcript !== prevProps.transcript) {
      this.props.onTranscriptChange(this.props.transcript)
    } else if (this.props.interimTranscript !== prevProps.interimTranscript) {
      this.props.onTranscriptChange(this.props.interimTranscript)
    }
  }

  onMouseDown = () => {
    this.props.onTranscriptStart()
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
      listening,
    } = this.props

    if (!browserSupportsSpeechRecognition) {
      return null
    }

    return (
      <ErrorBoundary>
        <button
          id='react-autoql-voice-record-button'
          data-test='speech-to-text-btn'
          className={`chat-voice-record-button${listening ? ' listening' : ''}`}
          onMouseDown={this.onMouseDown}
          onMouseUp={stopListening}
          onMouseLeave={this.props.listening ? stopListening : undefined}
          data-tooltip-content='Hold for voice-to-text'
          data-tooltip-id={this.props.tooltipID ?? 'react-autoql-speech-to-text-tooltip'}
          data-tooltip-content-disable={this.props.listening}
        >
          <Icon type='microphone' />
        </button>
        {!this.props.tooltipID && <Tooltip tooltipId='react-autoql-speech-to-text-tooltip' delayShow={800} />}
      </ErrorBoundary>
    )
  }
}

export default SpeechRecognition(options)(Dictaphone)
