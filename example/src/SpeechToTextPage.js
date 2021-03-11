import React, { Fragment } from 'react'
import axios from 'axios'
import _ from 'lodash'
import { Input, Button, Form, Table } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { SpeechToTextBtn, fetchQueryTips } from 'react-autoql'

export default class SpeechToTextPage extends React.Component {
  state = {
    isAuthenticated: false,
    isAuthenticating: false,
    username: undefined,
    password: undefined,
    token: undefined,
    queryList: [],
    currentQuery: 0,
    resultHistory: [],
  }

  componentDidMount = () => {
    fetchQueryTips({
      ...this.props.authentication,
      keywords: '',
      pageSize: 200,
      pageNumber: 1,
    }).then((response) => {
      if (_.get(response, 'data.data.items.length')) {
        const randomized = _.shuffle(response.data.data.items)
        this.setState({ queryList: randomized })
      }
    })
  }

  login = async () => {
    this.setState({ isAuthenticating: true })
    const url = 'https://backend-staging.chata.io/gcp/api/v1/login'
    const data = new FormData()
    data.append('username', this.state.username)
    data.append('password', this.state.password)
    const loginToken = await axios.post(url, data)
    if (loginToken.data) {
      this.setState({
        token: loginToken.data,
        isAuthenticated: true,
        isAuthenticating: false,
      })
    } else {
      this.setState({ isAuthenticated: false, isAuthenticating: false })
    }
  }

  replayBlob = (blob, isCurrentPlayback) => {
    const blobURL = window.URL.createObjectURL(blob)
    const audio0 = new Audio(blobURL)
    audio0.play()

    audio0.addEventListener(
      'ended',
      () => {
        if (isCurrentPlayback) {
          this.setState({ hasPlayedBack: true })
        }
      },
      false
    )
  }

  sendWavFile = (file, blob, query) => {
    this.setState({
      isConfirmingRecording: false,
      currentQuery: this.state.currentQuery + 1,
    })

    const url = 'https://backend-staging.chata.io/gcp/api/v1/wav_upload'
    const data = new FormData()

    data.append('file', file, 'speech.wav')
    data.append('eng', query)
    data.append('user_email', this.props.userEmail)
    data.append('project_id', this.props.projectID)

    const config = {
      headers: {
        Authorization: `Bearer ${this.state.token}`,
      },
      timeout: 30000,
    }
    axios.post(url, data, config).then((response) => {
      const newResultHistory = [
        {
          query,
          audio: (
            <Button
              shape="circle"
              type="primary"
              onClick={() => {
                this.replayBlob(blob)
              }}
              icon={<PlayCircleOutlined />}
            ></Button>
          ),
          librispeech:
            response.data[
              'translated text from checkpoint librispeech_pretrained_model.pth'
            ],
          ted:
            response.data[
              'translated text from checkpoint ted_pretrained_model.pth'
            ],
        },
        ...this.state.resultHistory,
      ]
      this.setState({
        resultHistory: newResultHistory,
      })
    })
  }

  renderS2TButtonAndQuery = () => {
    return (
      <Fragment>
        <SpeechToTextBtn
          themeConfig={this.props.themeConfig}
          onRecordStop={(file, blob) => {
            this.setState({
              isConfirmingRecording: true,
              currentFile: file,
              currentBlob: blob,
              hasPlayedBack: false,
            })
          }}
        />
        <div>
          {this.state.queryList[this.state.currentQuery] || 'Say anything!'}
        </div>
        {!!this.state.queryList.length && (
          <Button
            style={{ marginTop: '20px' }}
            onClick={() => {
              this.setState({ currentQuery: this.state.currentQuery + 1 })
            }}
          >
            Skip
          </Button>
        )}
      </Fragment>
    )
  }

  renderConfirmRecording = () => {
    return (
      <Fragment>
        <Button
          style={{ margin: '10px' }}
          shape="circle"
          type="primary"
          onClick={() => {
            this.replayBlob(this.state.currentBlob, true)
          }}
          size="large"
          icon={<PlayCircleOutlined />}
        ></Button>
        <div>{this.state.queryList[this.state.currentQuery] || ''}</div>
        <Button
          style={{ marginTop: '20px' }}
          type="primary"
          disabled={!this.state.hasPlayedBack}
          onClick={() =>
            this.sendWavFile(
              this.state.currentFile,
              this.state.currentBlob,
              this.state.queryList[this.state.currentQuery]
            )
          }
        >
          Approve Recording
        </Button>
        {!this.state.hasPlayedBack && (
          <div style={{ fontSize: '12px' }}>
            To approve this recording, you must listen to it first
          </div>
        )}
        <br />
        <Button
          style={{ marginTop: '5px' }}
          onClick={() => {
            this.setState({ isConfirmingRecording: false })
          }}
        >
          Retry
        </Button>
        <br />
        <Button
          style={{ marginTop: '5px' }}
          onClick={() => {
            this.setState({
              isConfirmingRecording: false,
              currentQuery: this.state.currentQuery + 1,
            })
          }}
        >
          Skip
        </Button>
      </Fragment>
    )
  }

  render = () => {
    const tailLayout = {
      wrapperCol: { offset: 8, span: 16 },
    }

    const columns = [
      {
        title: 'Query Text',
        dataIndex: 'query',
        key: 'query',
      },
      {
        title: 'WAV',
        dataIndex: 'audio',
        key: 'audio',
      },
      {
        title: 'librispeech pretrained model',
        dataIndex: 'librispeech',
        key: 'librispeech',
      },
      {
        title: 'ted pretrained model',
        dataIndex: 'ted',
        key: 'ted',
      },
    ]

    return (
      <div style={{ padding: '20px' }}>
        {this.state.isAuthenticated ? (
          <Fragment>
            <div style={{ padding: '5px', textAlign: 'center' }}>
              {this.state.isConfirmingRecording
                ? this.renderConfirmRecording()
                : this.renderS2TButtonAndQuery()}
            </div>
            {
              <div style={{ marginTop: '50px' }}>
                <Table
                  dataSource={this.state.resultHistory}
                  columns={columns}
                  pagination={false}
                />
              </div>
            }
          </Fragment>
        ) : (
          <Form
            onFinish={this.login}
            style={{ width: '300px', padding: '20px' }}
          >
            <Form.Item
              label="Username"
              name="username"
              rules={[
                { required: true, message: 'Please enter your username' },
              ]}
            >
              <Input
                onChange={(e) => {
                  this.setState({ username: e.target.value })
                }}
                value={this.state.username}
              />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please enter your password' },
              ]}
            >
              <Input
                type="password"
                onChange={(e) => {
                  this.setState({ password: e.target.value })
                }}
                value={this.state.password}
              />
            </Form.Item>
            <Form.Item {...tailLayout}>
              <Button
                type="primary"
                htmlType="submit"
                loading={this.state.isAuthenticating}
              >
                Authenticate
              </Button>
            </Form.Item>
          </Form>
        )}
      </div>
    )
  }
}
