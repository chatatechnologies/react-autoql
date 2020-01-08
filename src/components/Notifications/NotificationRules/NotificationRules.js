import React, { Fragment } from 'react'
import uuid from 'uuid'

import { Group } from '../Group'

import './NotificationRules.scss'

export default class NotificationRules extends React.Component {
  static propTypes = {}

  static defaultProps = {}

  state = {}

  render = () => {
    return (
      <div data-test="notification-rules">
        <Group groupId="first-group" />
      </div>
    )
  }
}
