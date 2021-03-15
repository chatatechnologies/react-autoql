import React, { Fragment } from 'react'
import axios from 'axios'
import { Input, Button, Form, message, InputNumber, Collapse } from 'antd'

// replace 'react-ratings-declarative'
// Also initializing transition from ant design to material ui
import Rating from '@material-ui/lab/Rating'

const { TextArea } = Input
const { Panel } = Collapse

const setStoredProp = (name, value) => {
  localStorage.setItem(name, value)
}

const getStoredProp = (name) => {
  return localStorage.getItem(name)
}

export default class SentimentAnalysisPage extends React.Component {
  state = {
    sentimentApiKey: getStoredProp('sentimentApiKey'),
    username: getStoredProp('sentimentUsername'),
    password: '',
    isProcessing: false,

    reviewTextValue: '',
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

      let url = 'https://backend-staging.chata.io/gcp/api/v1/reputation/jwt'

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

    const loginResponse = await axios.post(
      'https://backend-staging.chata.io/gcp/api/v1/login',
      formData
    )

    const loginToken = loginResponse.data
    setStoredProp('sentimentLoginToken', loginToken)

    return this.getJWT(loginToken)
  }

  getSentiment = () => {
    const url = `https://reputation-staging.chata.io/reputation-sentiment/postapi_sentiment?key=${this.state.sentimentApiKey}`
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
    const url = `https://reputation-staging.chata.io/reputation-responsor/v2/postapi_response?key=${this.state.sentimentApiKey}`
    const rating = this.state.rating ? `${this.state.rating}` : '4.0'
    const data = {
      review_text: this.state.reviewTextValue,
      name_hotel: this.state.hotelName || 'the hotel',
      review_title: this.state.title || 'the trip',
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

  getResponse = () => {
    const url = `https://reputation-staging.chata.io/reputation-responsor/postapi_response?key=${this.state.sentimentApiKey}`
    const data = {
      rv_text: this.state.reviewTextValue,
      rv_hotel: this.state.hotelName || 'the hotel',
      rv_title: this.state.title || 'the trip',
      rv_rate: `${this.state.rating || '4'}`,
      rv_name: this.state.name || 'the guest',
      rouge_score: `${this.state.score || ''}`,
    }

    axios
      .post(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('sentimentJWT')}`,
        },
      })
      .then((response) => {
        this.setState({ response: response.data, isProcessing: false })
      })
      .catch((error) => {
        this.setState({ response: undefined, isProcessing: false })
      })
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
        this.getResponse()
        this.getResponseV2()
      })
      .catch(() => {
        message.error('Authentication Error')
        this.setState({ isProcessing: false })
      })
  }

  renderReviewResponseV1 = () => {
    if (this.state.response) {
      return (
        <div>
          <h3>Recommended Responses (V1)</h3>
          <Collapse defaultActiveKey="sentiment-response-0">
            {Object.keys(this.state.response['output response']).map(
              (title, index) => {
                let text = `${this.state.response['output response'][title]}`
                text = text.split(' \\n')

                return (
                  <Panel header={title} key={`sentiment-response-${index}`}>
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

  renderReviewResponseV2 = () => {
    if (this.state.responseV2) {
      return (
        <div>
          <h3>Recommended Responses (V2)</h3>
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

  render = () => {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 },
    }

    return (
      <div style={{ padding: '20px', display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <h2>Leave a Review</h2>
          <Rating
            name="review-rating"
            size="large"
            defaultValue={4}
            precision={0.5}
            value={this.state.rating ? this.state.rating : '4.0'}
            onChange={(event, newRating) =>
              this.setState({
                rating: newRating.toFixed(1),
              })
            }
          />
          <span
            onClick={() => {
              this.setState({ rating: undefined })
            }}
            style={{ cursor: 'pointer', opacity: '0.5', marginLeft: '23px' }}
          >
            clear
          </span>
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

          <br />
          <Form
            {...layout}
            initialValues={{
              sentimentApiKey: this.state.sentimentApiKey,
            }}
            style={{ marginTop: '20px' }}
            onFinish={this.onLogin}
          >
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
            <Form.Item label="Rouge Score (v1 only)" name="score">
              <InputNumber
                step={0.1}
                min={0}
                max={1}
                onChange={(e) => {
                  this.setState({ score: e })
                }}
                value={this.state.score}
              />
            </Form.Item>
            <Form.Item label="Responder (v2 only)" name="responder">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ responder: e.target.value })
                }}
                value={this.state.responder}
              />
            </Form.Item>
            <Form.Item label="Responder Title (v2 only)" name="responder-title">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ responderTitle: e.target.value })
                }}
                value={this.state.responderTitle}
              />
            </Form.Item>
            <Form.Item label="Rank Type (v2 only)" name="rank-type">
              <Input
                type="text"
                onChange={(e) => {
                  this.setState({ rankType: e.target.value })
                }}
                value={this.state.rankType}
              />
            </Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Button
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
        </div>
        <div style={{ flex: 1, marginLeft: '20px' }}>
          <h2>Analysis</h2>
          {this.renderSentiment()}
          {this.renderReviewResponseV1()}
          {this.renderReviewResponseV2()}
        </div>
      </div>
    )
  }
}
