import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import Recorder from 'recorder-js'
import _cloneDeep from 'lodash.clonedeep'
// import linear16 from 'linear16'

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
    this.initializeRecorder()
  }

  componentWillUnmount = () => {
    // if (this.timer) {
    //   clearTimeout(this.timer)
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
        numChannels: 1,
        mimeType: 'audio/webm',
        // An array of 255 Numbers
        // You can use this to visualize the audio stream
        // If you use react, check out react-wave-stream
        // onAnalysed: (data) => console.log(data),
      })

      // this.recorder.microphoneConfig.numChannels = 1
      console.log('recorder object', this.recorder)
    } else {
      this.recorder.audioContext = this.audioContext
    }
  }

  convertoFloat32ToInt16 = (buffer) => {
    let length = buffer.length //Buffer
    const buf = new Int16Array(length / 3)

    while (length--) {
      if (length == -1) break

      if (buffer[length] * 0xffff > 32767) buf[length] = 32767
      else if (buffer[length] * 0xffff < -32768) buf[length] = -32768
      else buf[length] = buffer[length] * 0xffff
    }
    return buf.buffer
  }

  // encodeLinear16 = (blob) => {
  //   linear16(blob, './output.wav')
  // }

  startRecording = () => {
    this.setState({ isRecording: true })
    const self = this
    // this.timer = setTimeout(() => {
    //   this.stopRecording()
    // }, 10000)

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
        })
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

  blobToFile = (theBlob) => {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date()
    theBlob.name = 'speech.wav'
    return theBlob
  }

  stopRecording = () => {
    // if (this.timer) {
    //   clearTimeout(this.timer)
    // }

    this.setState({ isRecording: false })
    if (this.recorder.audioRecorder) {
      this.recorder
        .stop()
        .then(({ blob, buffer }) => {
          this.download(blob)
          // const linear16Buffer = this.convertoFloat32ToInt16(buffer)
          // console.log('linear 16 buffer', linear16Buffer)
          console.log('original buffer', _cloneDeep(buffer))

          // const downsampledBuffer = this.downSample(buffer, 16000)

          console.log('downsampled buffer', downsampledBuffer)

          this.props.onRecordStop(this.blobToFile(blob))
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

  downSample = (buffer, rate) => {
    const sampleRate = this.audioContext.sampleRate
    if (rate == sampleRate) {
      return buffer
    }
    if (rate > sampleRate) {
      throw 'downsampling rate show be smaller than original sample rate'
    }
    var sampleRateRatio = sampleRate / rate
    var newLength = Math.round(buffer.length / sampleRateRatio)
    var result = new Float32Array(newLength)
    var offsetResult = 0
    var offsetBuffer = 0
    while (offsetResult < result.length) {
      var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
      // Use average value of skipped samples
      var accum = 0,
        count = 0
      for (
        var i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i]
        count++
      }
      result[offsetResult] = accum / count
      // Or you can simply get rid of the skipped samples:
      // result[offsetResult] = buffer[nextOffsetBuffer];
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return result
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
