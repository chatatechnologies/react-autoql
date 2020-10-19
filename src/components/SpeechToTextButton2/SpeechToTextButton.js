import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import Recorder from 'recorder-js'

import { Icon } from '../Icon'

import './SpeechToTextButton.scss'

export default class SppechToTextBtn extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  state = {
    isRecording: false,
  }

  componentDidMount = () => {
    this.initializeRecorder()
    // navigator.mediaDevices
    //   .getUserMedia({ audio: true })
    //   .then((stream) => this.recorder.init(stream))
    //   .catch((err) => console.error('Uh oh... unable to get stream...', err))
  }

  componentDidUpdate = (prevProps) => {
    // if (this.props.finalTranscript !== prevProps.finalTranscript) {
    //   this.props.onFinalTranscript(this.props.finalTranscript)
    // } else if (this.props.transcript !== prevProps.transcript) {
    //   this.props.onTranscriptChange(this.props.transcript)
    // } else if (this.props.interimTranscript !== prevProps.interimTranscript) {
    //   this.props.onTranscriptChange(this.props.interimTranscript)
    // }
  }

  initializeRecorder = () => {
    if (!this.audioContext) {
      // Do not open any new audio contexts is one already exists. Only allowed a certain amount at a time
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)()
    }

    if (!this.recorder) {
      this.recorder = new Recorder(this.audioContext, {
        // An array of 255 Numbers
        // You can use this to visualize the audio stream
        // If you use react, check out react-wave-stream
        // onAnalysed: (data) => console.log(data),
      })
    } else {
      this.recorder.audioContext = this.audioContext
    }
  }

  startRecording = () => {
    const self = this

    console.log('recorder object', this.recorder)
    console.log('media devices', navigator.mediaDevices)

    this.checkMicrophonePermission().then((isMicAllowed) => {
      if (isMicAllowed) {
        setTimeout(() => {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              self.setState({ isRecording: true })
              self.initializeRecorder()
              self.recorder
                .init(stream)
                .then(() => {
                  self.recorder.start().then(() => {})
                })
                .catch((error) => {
                  console.log('couldnt start recording for some reason:', error)
                })
            })
            .catch(function(err) {
              console.log('getusermedia exception caught:', err)
            })
        }, 1000)
      } else {
        console.error('User denied microphone permission')
        alert(
          "You have denied access to your microphone for this site. Please go to your browser's preferences and allow access to the microphone."
        )
      }
    })

    // this.getMediaPermissionStatus().then((status) => {
    //   if (status === 'denied') {
    //   } else {
    //     this.recorder.start().then(() => {
    //       this.setState({ isRecording: true })
    //     })
    //   }
    // })
  }

  stopRecording = () => {
    this.setState({ isRecording: false })
    if (this.recorder.audioRecorder) {
      this.recorder
        .stop()
        .then(({ blob, buffer }) => {
          this.download(blob)
        })
        .catch((error) => console.error(error))
    } else {
      console.log('nothing to stop, there was no recording')
    }
  }

  checkMicrophonePermission = () => {
    return navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        return Promise.resolve(true)
      })
      .catch(function(err) {
        return Promise.resolve(false)
      })
  }

  getMediaPermissionStatus = () => {
    return navigator.permissions
      .query({ name: 'microphone' })
      .then(function(permissionStatus) {
        console.log(permissionStatus.state) // granted, denied, prompt
        return permissionStatus.state

        // permissionStatus.onchange = function() {
        //   console.log('Permission changed to ' + this.state)
        // }
      })
  }

  download = (blob) => {
    Recorder.download(blob, 'my-audio-file') // downloads a .wav file
  }

  onMouseDown = () => {
    ReactTooltip.hide()
    this.startRecording()
  }

  render = () => {
    return (
      <Fragment>
        <button
          id="chata-voice-record-button"
          data-test="speech-to-text-btn"
          className={`chat-voice-record-button${
            this.state.isRecording ? ' listening' : ''
          }`}
          onMouseDown={this.onMouseDown}
          onMouseUp={this.stopRecording}
          onMouseLeave={this.state.isRecording ? this.stopRecording : undefined}
          data-tip="Hold for voice-to-text"
          data-for="chata-speech-to-text-tooltip"
          data-tip-disable={this.state.isRecording}
        >
          <Icon type="microphone" />
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
