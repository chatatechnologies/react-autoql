import React from 'react'
import ReactTooltip from 'react-tooltip'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'

import notificationList from '../NotificationSettings/sampleNotifications'

import './NotificationList.scss'

export default class NotificationList extends React.Component {
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {}

  state = {
    notificationList: notificationList
  }

  componentDidMount = () => {
    document.documentElement.style.setProperty('--accent-color', 'rgb(255,0,0)')
  }

  onItemClick = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          expanded: !n.expanded
        }
      }
      return {
        ...n,
        expanded: false
      }
    })
    this.setState({ notificationList: newList })
  }

  onDismissAllclick = () => {
    const newList = this.state.notificationList.map(n => {
      return {
        ...n,
        triggered: false
      }
    })
    this.setState({ notificationList: newList })
  }

  onDismissClick = (e, notification) => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          triggered: false
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  renderDismissAllButton = () => (
    <div className="chata-notification-dismiss-all">
      <span onClick={this.onDismissAllclick}>
        <Icon type="notification-off" style={{ verticalAlign: 'middle' }} />{' '}
        Dismiss All
      </span>
    </div>
  )

  render = () => {
    return (
      <div
        className="chata-notification-list-container"
        data-test="notification-list"
      >
        <ReactTooltip
          className="chata-drawer-tooltip"
          id="chata-notification-tooltip"
          effect="solid"
          delayShow={500}
          html
        />
        {this.renderDismissAllButton()}
        {this.state.notificationList.map((notification, i) => {
          return (
            <NotificationItem
              notification={notification}
              onClick={this.onItemClick}
              onDismissClick={this.onDismissClick}
            />
          )
        })}
      </div>
    )
  }
}
