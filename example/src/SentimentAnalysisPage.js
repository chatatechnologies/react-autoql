import React, { Fragment } from 'react'
import axios from 'axios'
import { Input, Button, Form, message, InputNumber, Collapse } from 'antd'
import Ratings from 'react-ratings-declarative'

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
    reviewTextValue: '',
    sentimentApiKey: getStoredProp('sentimentApiKey'),
    username: getStoredProp('sentimentUsername'),
    password: '',
    rating: undefined,
    title: '',
    name: '',
    hotelName: '',
    isProcessing: false,
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

  getResponse = () => {
    const url = `https://reputation-staging.chata.io/reputation-responsor/postapi_response?key=${this.state.sentimentApiKey}`
    const data = {
      rv_text: this.state.reviewTextValue,
      rv_hotel: this.state.hotelName,
      rv_title: this.state.title,
      rv_rate: `${this.state.rating || ''}`,
      rv_name: this.state.name,
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
      })
      .catch(() => {
        message.error('Authentication Error')
        this.setState({ isProcessing: false })
      })
  }

  renderReviewResponse = () => {
    if (this.state.response) {
      return (
        <div>
          <h3>Recommended Responses</h3>
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

          <Ratings
            rating={this.state.rating}
            widgetRatedColors="#ffdd15"
            widgetHoverColors="#ffdd1599"
            widgetDimensions="25px"
            changeRating={(newRating) =>
              this.setState({
                rating: newRating,
              })
            }
          >
            <Ratings.Widget />
            <Ratings.Widget />
            <Ratings.Widget />
            <Ratings.Widget />
            <Ratings.Widget />
          </Ratings>
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
            <Form.Item label="Rouge Score" name="score">
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
          {this.renderReviewResponse()}
        </div>
      </div>
    )
  }
}
