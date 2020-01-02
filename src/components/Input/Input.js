import React from 'react'
import PropTypes from 'prop-types'

import './Input.scss'

export default class Input extends React.Component {
  static propTypes = {}

  state = {}

  render = () => {
    return <input {...this.props} />
  }
}
