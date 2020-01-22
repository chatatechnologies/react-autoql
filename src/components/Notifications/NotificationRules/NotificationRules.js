import React, { Fragment } from 'react'
import uuid from 'uuid'
import PropTypes from 'prop-types'

import { Group } from '../Group'

import './NotificationRules.scss'

export default class NotificationRules extends React.Component {
  static propTypes = {
    notificationData: PropTypes.shape({})
  }

  static defaultProps = {
    notificationData: undefined
  }

  state = {}

  render = () => {
    return (
      <div data-test="notification-rules">
        <Group groupId="first-group" />
      </div>
    )
  }
}
