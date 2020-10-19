import React, { Fragment } from 'react'
import axios from 'axios'
import _ from 'lodash'
import { Input, Button, Form } from 'antd'
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
  }

  componentDidMount = () => {
    fetchQueryTips({
      ...this.props.authentication,
      keywords: '',
      pageSize: 200,
      pageNumber: 1,
    }).then((response) => {
      if (_.get(response, 'data.data.items.length')) {
        const random10 = _.shuffle(response.data.data.items).slice(0, 10)
        this.setState({ queryList: random10 })
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

  sendWavFile = (blob) => {
    const url = 'https://backend-staging.chata.io/gcp/api/v1/wav_upload'
    const data = new FormData()
    data.append('file', blob, 'speech.wav')
    console.log(data)
    const config = {
      headers: {
        Authorization: `Bearer ${this.state.token}`,
        // 'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        // 'Referrer-Policy': 'unsafe-url',
      },
      timeout: 30000,
    }
    axios.post(url, data, config).then((response) => {
      this.setState({
        lastResult: response.data['translated text'],
        currentQuery: this.state.currentQuery + 1,
      })
    })
  }

  render = () => {
    const tailLayout = {
      wrapperCol: { offset: 8, span: 16 },
    }

    return (
      <div style={{ padding: '20px' }}>
        {this.state.isAuthenticated && this.state.queryList.length ? (
          <Fragment>
            <div style={{ padding: '5px', textAlign: 'center' }}>
              <SpeechToTextBtn
                themeConfig={this.props.themeConfig}
                onRecordStop={this.sendWavFile}
              />
              <div>{this.state.queryList[this.state.currentQuery]}</div>
              <Button
                onClick={() => {
                  this.setState({ currentQuery: this.state.currentQuery + 1 })
                }}
              >
                Skip
              </Button>
            </div>
            {this.state.currentQuery > 0 && (
              <div>
                <div>
                  Query: {this.state.queryList[this.state.currentQuery - 1]}
                </div>
                <div>Result: {this.state.lastResult}</div>
              </div>
            )}
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
