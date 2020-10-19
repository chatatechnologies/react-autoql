import React, { Fragment } from 'react'
import axios from 'axios'
import { Input, Button, Form, message, InputNumber, Collapse } from 'antd'

const setStoredProp = (name, value) => {
  localStorage.setItem(name, value)
}

const getStoredProp = (name) => {
  return localStorage.getItem(name)
}

export default class SpeechToTextPage extends React.Component {
  state = {
    isAuthenticated: false,
  }
  render = () => {
    return <div>Speech to text</div>
  }
}
