import React, { Fragment } from 'react'
import axios from 'axios'
import {
  Input,
  Button,
  Form,
  message,
  Collapse,
  Switch,
} from 'antd'
import Rating from './components/Rating/Rating'

const { TextArea } = Input
const { Panel } = Collapse

function callback(key) {
  console.log(key);
}

const setStoredProp = (name, value) => {
  localStorage.setItem(name, value)
}

const getStoredProp = (name) => {
  return localStorage.getItem(name)
}

const getBaseUrl = () => {
  return window.location.href.includes('prod')
    ? 'https://backend.chata.io'
    : 'https://backend-staging.chata.io'
}

const getReputationUrl = () => {
  return window.location.href.includes('prod')
    ? 'https://chata.chata.io/autoql'
    : 'https://chata-staging.chata.io/autoql'
}

export default class SentimentAnalysisPage extends React.Component {
  state = {
    sentimentApiKey: getStoredProp('sentimentApiKey'),
    username: getStoredProp('sentimentUsername'),
    password: '',
    isProcessing: false,
    isV2_1Activated: false,
    reviewTextValue: '',
    controlSignals: '',
    hotelName: '',
    title: '',
    rating: undefined,
    name: '',
    responder: '',
    responderTitle: '',
    rankType: '',
  }

  getJWT = async (loginToken) => {
    try {
      if (!loginToken) {
        message.error('Invalid username/password combination')
        return Promise.reject()
      }

      const baseUrl = getBaseUrl()
      let url = `${baseUrl}/gcp/api/v1/reputation/jwt`

      // Use login token to get JWT token
      const jwtResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${loginToken}`,
        },
      })

      // Put jwt token into storage
      const jwtToken = jwtResponse.data
      setStoredProp('sentimentJWT', jwtToken)
      return Promise.resolve()
    } catch (error) {
      this.setState({ isProcessing: false })
      message.error('Invalid API key')
      return Promise.reject()
    }
  }

  login = async () => {
    const formData = new FormData()
    formData.append('username', this.state.email)
    formData.append('password', this.state.password)

    const baseUrl = getBaseUrl()
    const loginResponse = await axios.post(
      `${baseUrl}/gcp/api/v1/login`,
      formData
    )

    const loginToken = loginResponse.data
    setStoredProp('sentimentLoginToken', loginToken)

    return this.getJWT(loginToken)
  }

  onV2Activate = (checked) => {
    this.setState({
      isV2_1Activated: checked,
    })
  }

  getSentiment = () => {
    const reputationUrl = getReputationUrl()
    const url = `${reputationUrl}/reputation-sentiment/postapi_sentiment?key=${this.state.sentimentApiKey}`
    const data = {
      rv_text: this.state.reviewTextValue,
    }

    axios
      .post(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('sentimentJWT')}`,
        },
      })
      .then((response) => {
        this.setState({ sentiment: response.data, isProcessing: false })
      })
      .catch((error) => {
        this.setState({ sentiment: undefined, isProcessing: false })
      })
  }

  getResponseV2 = () => {
    const reputationUrl = getReputationUrl()
    const url = `${reputationUrl}/reputation-responsor/v2/postapi_response?key=${this.state.sentimentApiKey}`
    const rating = this.state.rating ? `${this.state.rating}` : '4.0'
    const data = {
      review_text: this.state.reviewTextValue,
      name_hotel: this.state.hotelName || 'the hotel',
      review_title: this.state.title || 'the trip',
      review_controlSignals: this.state.controlSignals || ' ',
      total_rating: rating,
      name_user: this.state.name || 'the guest',
      responder: this.state.responder || 'john',
      responder_title: this.state.responderTitle || 'general manager',
      rank_type: this.state.rankType || 'len',
    }

    axios
      .post(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('sentimentJWT')}`,
        },
      })
      .then((response) => {
        this.setState({ responseV2: response.data, isProcessing: false })
      })
      .catch((error) => {
        this.setState({ responseV2: undefined, isProcessing: false })
      })
  }

  getResponseV2_1 = () => {
    if (this.state.isV2_1Activated) {
      const reputationUrl = getReputationUrl()
      const url = `${reputationUrl}/reputation-responsor/v2-1/postapi_response?key=${this.state.sentimentApiKey}`
      const rating = this.state.rating ? `${this.state.rating}` : '4.0'
      const data = {
        review_text: this.state.reviewTextValue,
        name_hotel: this.state.hotelName || 'the hotel',
        review_title: this.state.title || 'the trip',
        review_controlSignals: this.state.controlSignals || ' ',
        total_rating: rating,
        name_user: this.state.name || 'the guest',
        responder: this.state.responder || 'john',
        responder_title: this.state.responderTitle || 'general manager',
        rank_type: this.state.rankType || 'len',
      }

      axios
        .post(url, data, {
          headers: {
            Authorization: `Bearer ${getStoredProp('sentimentJWT')}`,
          },
        })
        .then((response) => {
          this.setState({
            responseV2_1: response.data,
            isProcessing: false,
          })
        })
        .catch((error) => {
          this.setState({ responseV2_1: undefined, isProcessing: false })
        })
    }
  }

  submitReview = async () => {
    this.setState({
      isProcessing: true,
      sentiment: undefined,
      response: undefined,
    })
    this.login()
      .then(() => {
        this.getSentiment()
        this.getResponseV2()
        this.getResponseV2_1()
      })
      .catch(() => {
        message.error('Authentication Error')
        this.setState({ isProcessing: false })
      })
  }

  renderReviewResponseV2 = () => {
    if (this.state.responseV2) {
      return (
        <div>
          <h3>Newest Model</h3>
          <Collapse defaultActiveKey="sentiment-responseV2-0">
            {Object.keys(this.state.responseV2['output response']).map(
              (title, index) => {
                let text = `${this.state.responseV2['output response'][title]}`
                text = text.split(' \\n')

                return (
                  <Panel header={title} key={`sentiment-responseV2-${index}`}>
                    {text.map((str, i) => {
                      return (
                        <Fragment key={i}>
                          {str} <br />
                        </Fragment>
                      )
                    })}
                  </Panel>
                )
              }
            )}
          </Collapse>
        </div>
      )
    }

    return null
  }

  renderReviewResponseV2_1 = () => {
    if (this.state.responseV2_1) {
      return (
        <div>
          <br /> <br />
          <h3>Older Model</h3>
          <Collapse defaultActiveKey="sentiment-responseV2-1">
            {Object.keys(this.state.responseV2_1['output response']).map(
              (title, index) => {
                let text = `${this.state.responseV2_1['output response'][title]}`
                text = text.split(' \\n')
                return (
                  <Panel header={title} key={`sentiment-responseV2-1${index}`}>
                    {' '}
                    {text.map((str, i) => {
                      return (
                        <Fragment key={i}>
                          {str} <br />
                        </Fragment>
                      )
                    })}
                  </Panel>
                )
              }
            )}
          </Collapse>
        </div>
      )
    }

    return null
  }

  renderSentiment = () => {
    if (this.state.sentiment) {
      return (
        <p>
          We are{' '}
          <strong>
            <em>
              {(this.state.sentiment['predicted score'][0][1] * 100).toFixed(2)}
              %{' '}
            </em>
          </strong>
          sure this is a{' '}
          <strong>
            <em>{this.state.sentiment['predicted score'][0][0]}</em>
          </strong>{' '}
          review
        </p>
      )
    }

    return null
  }

  onClear = () => {
    this.setState({ rating: undefined })
  }

  render = () => {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 },
    }
    return (
      <div style={{ padding: '20px', display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <h2>Leave a Review</h2>
          
          <span>
            <Input
              type="text"
              onChange={(e) => {
                this.setState({ controlSignals: e.target.value })
              }}
              value={this.state.controlSignals}
              placeholder="Please enter any control words/phrases"
              style={{ marginTop: '5px' }}
            />
          </span>

          <div id="rating-selection">
            {
              <Rating
                rating={this.state.rating}
                onSelectRating={(newRating) => {
                  this.setState({ rating: (newRating + 1) / 2 })
                }}
                onClear={this.onClear.bind(this)}
              />
            }
          </div>
          
          <div id="clear-rating-button">
            <button
              onClick={() => {
                this.setState({ rating: undefined })
              }}
              style={{ cursor: 'pointer', opacity: '0.5', marginLeft: '23px' }}
            >Clear</button> 
          </div>
          <Input
            type="text"
            onChange={(e) => {
              this.setState({ title: e.target.value })
            }}
            value={this.state.title}
            placeholder="Review Title"
            style={{ marginTop: '5px' }}
          />
          <TextArea
            placeholder="Type your review here"
            onChange={(e) => this.setState({ reviewTextValue: e.target.value })}
            value={this.state.reviewTextValue}
            style={{ marginTop: '5px', minHeight: '130px' }}
          />
          
            <Switch 
            id="toggle-switch"
            onChange={this.onV2Activate}
            checkedChildren="OLD ON"
            unCheckedChildren="OLD OFF"
            />
            {/* toggle switches on to show second model*/}
          
            <Form
              {...layout}
              initialValues={{
                sentimentApiKey: this.state.sentimentApiKey,
              }}
              style={{ marginTop: '20px' }}
              onFinish={this.onLogin}
            >

              <div style={{ textAlign: 'right' }}>
                <Button
                  id="submit-form-button" 
                  type="primary"
                  loading={this.state.isProcessing}
                  onClick={this.submitReview}
                  htmlType="submit"
                  disabled={!this.state.reviewTextValue}
                >
                  {this.state.isProcessing ? 'Submitting' : 'Submit Review'}
                </Button>
              </div>
            </Form>

  <Collapse defaultActiveKey={['1']} onChange={callback}>
      <Panel header="Administrative Panel" key="1">
        <Form.Item
              label="API key"
              name="sentimentApiKey"
              rules={[{ required: true, message: 'Please enter your API key' }]}
            >
              <Input
                name="api-key"
                onChange={(e) => {
                  this.setState({ apiKey: e.target.value })
                }}
                onBlur={(e) => setStoredProp('sentimentApiKey', e.target.value)}
                value={this.state.sentimentApiKey}
              />
            </Form.Item>
            <Form.Item
              label="Username"
              name="sentimentUsername"
              rules={[
                { required: true, message: 'Please enter your username' },
              ]}
            >
              <Input
                onChange={(e) => {
                  setStoredProp('sentimentUsername', e.target.value)
                  this.setState({ email: e.target.value })
                }}
                value={this.state.email}
              />
            </Form.Item>
            <Form.Item
              label="Password"
              name="sentimentPassword"
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
            <Form.Item label="Hotel Name" name="hotelName">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ hotelName: e.target.value })
                }}
                value={this.state.hotelName}
              />
            </Form.Item>
            <Form.Item label="Your Name" name="name">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ name: e.target.value })
                }}
                value={this.state.name}
              />
            </Form.Item>
            <Form.Item label="Responder" name="responder">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ responder: e.target.value })
                }}
                value={this.state.responder}
              />
            </Form.Item>
            <Form.Item label="Responder Title" name="responder-title">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ responderTitle: e.target.value })
                }}
                value={this.state.responderTitle}
              />
            </Form.Item>

            <Form.Item label="Rank Type" name="rank-type">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ rankType: e.target.value })
                }}
                value={this.state.rankType}
              />
        </Form.Item>
      </Panel>
    </Collapse>
        
        <br />
        </div>
        <div style={{ flex: 1, marginLeft: '20px' }}>
          <h2>Analysis</h2>

          {this.renderSentiment()}
          {this.renderReviewResponseV2()}
          {this.renderReviewResponseV2_1()}
        </div>
      </div>
    )
  }
}
