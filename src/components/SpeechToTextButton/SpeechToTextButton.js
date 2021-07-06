import React, { Fragment } from 'react'
import ReactTooltip from 'react-tooltip'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import RecordRTC, { StereoAudioRecorder } from 'recordrtc'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { setCSSVars } from '../../js/Util'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../props/defaults'
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
    currentQuery: 0,
    resultHistory: [],
    currentFile: '',
    currentBlob: '',
  }

  componentDidMount = () => {
    setCSSVars(getThemeConfig(this.props.themeConfig))
  }

  startRecording = () => {
    this.setState({ isRecording: true })

    navigator.getUserMedia(
      { audio: true },
      (stream) => {
        this.stream = stream
        this.recordAudio = RecordRTC(this.stream, {
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

  onRecordStop = (file, blob) => {
    this.setState({
      //  isConfirmingRecording: true,
      currentFile: file,
      currentBlob: blob,
      //hasPlayedBack: false,
    })
  }

  stopRecording = () => {
    this.setState({ isRecording: false })
    this.recordAudio.stopRecording(() => {
      let blob = this.recordAudio.getBlob()
      this.onRecordStop(this.blobToFile(blob), blob)
      console.log(blob)
      try {
        this.stream.getTracks().forEach((track) => track.stop())
      } catch (error) {
        console.error(error)
      }
    })
  }

  blobToFile = (theBlob) => {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date()
    theBlob.name = 'speech.wav'
    return theBlob
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

  sendWavFile = (file, blob, query) => {
    // this.setState({
    //   isConfirmingRecording: false,
    //   currentQuery: this.state.currentQuery + 1,
    // })

    const url = `https://backend-staging.chata.io/gcp/api/v1/wav_upload`
    const data = new FormData()
    data.append('file', file, 'speech.wav')
    const config = {
      headers: {
        Authorization: `Bearer ${this.state.token}`,
      },
      timeout: 30000,
    }
    axios.post(url, data, config).then((res) => {
      console.log(res)
    })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <button
          id="react-autoql-voice-record-button"
          data-test="speech-to-text-btn"
          className={`chat-voice-record-button${
            this.state.isRecording ? ' listening' : ''
          }`}
          onMouseDown={this.onMouseDown}
          onMouseUp={this.stopRecording}
          onMouseLeave={this.state.isRecording ? this.stopRecording : undefined}
          data-tip="Hold for voice-to-text"
          data-for="react-autoql-speech-to-text-tooltip"
          data-tip-disable={this.state.isRecording}
        >
          <Icon type="microphone" />
        </button>
        <ReactTooltip
          className="react-autoql-tooltip"
          id="react-autoql-speech-to-text-tooltip"
          effect="solid"
          delayShow={800}
        />
      </ErrorBoundary>
    )
  }
}
