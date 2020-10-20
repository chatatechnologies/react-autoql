import React, { Fragment } from 'react'
import ReactTooltip from 'react-tooltip'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import RecordRTC, { StereoAudioRecorder } from 'recordrtc'

import { Icon } from '../Icon'

import { setCSSVars } from '../../js/Util'
import { authenticationDefault, themeConfigDefault } from '../../props/defaults'
import { authenticationType, themeConfigType } from '../../props/types'

import './SpeechToTextButton.scss'

export default class SpeechToTextBtn extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
  }

  state = {
    isRecording: false,
  }

  componentDidMount = () => {
    setCSSVars(this.props.themeConfig)
  }

  startRecording = () => {
    const self = this
    this.setState({ isRecording: true })

    navigator.getUserMedia(
      { audio: true },
      (stream) => {
        this.recordAudio = RecordRTC(stream, {
          type: 'audio',
          mimeType: 'audio/webm',
          desiredSampRate: 16000,
          recorderType: StereoAudioRecorder,
          numberOfAudioChannels: 1,
        })

        this.recordAudio.startRecording()
      },
      function(error) {
        console.error(JSON.stringify(error))
      }
    )
  }

  stopRecording = () => {
    this.setState({ isRecording: false })
    this.recordAudio.stopRecording(() => {
      let blob = this.recordAudio.getBlob()
      this.props.onRecordStop(this.blobToFile(blob), blob)
    })
  }

  blobToFile = (theBlob) => {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date()
    theBlob.name = 'speech.wav'
    return theBlob
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
        return permissionStatus.state
      })
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
