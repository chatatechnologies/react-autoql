import React, { Component } from 'react'
import axios from 'axios'

import { ChatDrawer } from '@chata-ai/core'

import './index.css'

export default class App extends Component {
  state = {
    token: '',
    isVisible: false
  }

  componentDidMount = async () => {
    // ------------- This should be done on the BE -----------------
    try {
      // Login to get login token
      const loginFormData = new FormData()
      loginFormData.append('username', 'admin')
      loginFormData.append('password', 'admin123')

      const loginResponse = await axios.post(
        'https://backend-staging.chata.io/api/v1/login',
        loginFormData
      )

      // Use login token to get JWT token
      const jwtResponse = await axios.get(
        'https://backend-staging.chata.io/api/v1/jwt',
        {
          headers: {
            Authorization: `Bearer ${loginResponse.data}`
          }
        }
      )
      // ------------------------------------------------------------
      // Use your own REST call to get the token
      // const jwtResponse = await axios.get(
      //   'your-own-backend-url',
      //   {
      //     headers: {
      //       Authorization: `Bearer ${someToken}`
      //     }
      //   }
      // )

      // Set state with jwt token
      this.setState({ token: jwtResponse.data })
    } catch (error) {
      console.error(error)
    }
  }

  render = () => {
    return (
      <ChatDrawer
        token={this.state.token}
        apiKey="AIzaSyD_CVuP8l980M1dzUFjaoeLo8_EcL9aDa4"
        customerId="locate-demo1"
        userId="nmoore@chata.ai"
        domain="https://locate-staging.chata.io"
        demo
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
      />
    )
  }
}
