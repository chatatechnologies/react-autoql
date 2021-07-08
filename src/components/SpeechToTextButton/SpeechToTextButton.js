import React, { Fragment } from 'react'
import ReactTooltip from 'react-tooltip'
import _cloneDeep from 'lodash.clonedeep'
import _isEqual from 'lodash.isequal'
import RecordRTC, { StereoAudioRecorder } from 'recordrtc'
import axios from 'axios'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import PropTypes from 'prop-types'
import { setCSSVars } from '../../js/Util'
import {
  authenticationDefault,
  themeConfigDefault,
  getAuthentication,
  getThemeConfig,
} from '../../props/defaults'
import { authenticationType, themeConfigType } from '../../props/types'
import Popover, { ArrowContainer } from 'react-tiny-popover'
import './SpeechToTextButton.scss'

export default class SpeechToTextBtn extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
    transcript: PropTypes.string,
    interimTranscript: PropTypes.string,
    finalTranscript: PropTypes.string,
    resetTranscript: PropTypes.func,
    onTranscriptChange: PropTypes.func,
    onFinalTranscript: PropTypes.func,
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
    showPopoverMessage: false,
    errorMessage: '',
  }

  componentDidMount = () => {
    setCSSVars(getThemeConfig(this.props.themeConfig))
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
    this.setState(
      {
        //  isConfirmingRecording: true,
        currentFile: file,
        currentBlob: blob,
        //hasPlayedBack: false,
      },
      () => {
        this.sendWavFile(file)
      }
    )
  }

  stopRecording = () => {
    this.setState({ isRecording: false })
    this.recordAudio.stopRecording(() => {
      let blob = this.recordAudio.getBlob()
      this.onRecordStop(this.blobToFile(blob), blob)
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

  sendWavFile = (file) => {
    const url = `${this.props.authentication.domain}/autoql/api/v1/query/speech-to-text?key=${this.props.authentication.apiKey}`
    const data = new FormData()
    data.append('file', file, 'speech.wav')
    const config = {
      headers: {
        Authorization: `Bearer ${this.props.authentication.token}`,
      },
      timeout: 30000,
    }
    axios
      .post(url, data, config)
      .then((res) => {
        this.props.onTranscriptChange(res.data.data.transcription)
      })
      .catch((error) => {
        if (error.response.status === 404) {
          this.setState(
            {
              errorMessage:
                'Oops! Speech-to-text has not been enabled. Try typing a query instead.',
            },
            () => {
              this.setState({ showPopoverMessage: true })
            }
          )
        } else {
          this.setState(
            { errorMessage: 'Oops! Something wrong with your account' },
            () => {
              this.setState({ showPopoverMessage: true })
            }
          )
        }
      })
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Popover
          isOpen={this.state.showPopoverMessage}
          padding={20}
          content={() => (
            <div
              style={{
                backgroundColor: '#FFD2D2',
                opacity: 1,
                paddingLeft: '10px',
                paddingRight: '10px',
              }}
            >
              <Icon type="warning-triangle" /> {this.state.errorMessage}
            </div>
          )}
          onClickOutside={() => this.setState({ showPopoverMessage: false })}
        >
          <button
            id="react-autoql-voice-record-button"
            data-test="speech-to-text-btn"
            className={`chat-voice-record-button${
              this.state.isRecording ? ' listening' : ''
            }`}
            onMouseDown={this.onMouseDown}
            onMouseUp={this.stopRecording}
            onMouseLeave={
              this.state.isRecording ? this.stopRecording : undefined
            }
            data-tip="Hold for voice-to-text"
            data-for="react-autoql-speech-to-text-tooltip"
            data-tip-disable={this.state.isRecording}
          >
            <Icon type="microphone" />
          </button>
        </Popover>
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
