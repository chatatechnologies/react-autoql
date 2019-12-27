import React from 'react'
import PropTypes from 'prop-types'
import { IoMdNotificationsOutline } from 'react-icons/io'

import {
  fetchNotificationCount,
  resetNotificationCount
} from '../../js/queryService'

import './NotificationButton.scss'

export default class NotificationButton extends React.Component {
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    overflowCount: PropTypes.number,
    token: PropTypes.string,
    apiKey: PropTypes.string,
    customerId: PropTypes.string,
    userId: PropTypes.string,
    username: PropTypes.string,
    domain: PropTypes.string
  }

  static defaultProps = {
    overflowCount: 99,
    token: undefined,
    apiKey: undefined,
    customerId: undefined,
    userId: undefined,
    username: undefined,
    domain: undefined
  }

  state = {
    count: 0
  }

  componentDidMount = async () => {
    const { token, apiKey, customerId, userId, username, domain } = this.props
    // Fetch initial existing notifications from the BE
    fetchNotificationCount({
      token,
      apiKey,
      customerId,
      userId,
      username,
      domain
    }).then(response => {
      this.setState({
        count: response.data.count
      })
    })

    // Listen for new notification SSE's and update real-time
    // this.notificationEventSource.onmessage = e =>
    //   this.updateNotificationsCountAndList(JSON.parse(e.data))
  }

  updateNotificationsCountAndList = data => {
    console.log(data)
  }

  resetCount = () => {
    const { token, apiKey, customerId, userId, username, domain } = this.props

    resetNotificationCount({
      token,
      apiKey,
      customerId,
      userId,
      username,
      domain
    }).then(() => {
      this.setState({ count: 0 })
    })
  }

  renderBadge = () => {
    const { overflowCount } = this.props
    const { count } = this.state

    if (!count) {
      return null
    }

    let finalCount = count
    if (count > overflowCount) {
      finalCount = `${overflowCount}+`
    }

    return <div className="chata-notifications-badge">{finalCount}</div>
  }

  render = () => {
    return (
      <div className="chata-notifications-button-container">
        <IoMdNotificationsOutline className="chata-notifications-button" />
        {this.renderBadge()}
      </div>
    )
  }
}
