import React from 'react'
import ReactTooltip from 'react-tooltip'
import PropTypes from 'prop-types'
import _get from 'lodash.get'

import { Icon } from '../../Icon'
import { NotificationItem } from '../NotificationItem'
import {
  fetchNotificationList,
  dismissAllNotifications
} from '../../../js/notificationService'

import './NotificationList.scss'

export default class NotificationList extends React.Component {
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {
    apiKey: PropTypes.string,
    token: PropTypes.string,
    domain: PropTypes.string,
    onCollapseCallback: PropTypes.func,
    onExpandCallback: PropTypes.func,
    expandedContent: PropTypes.element
  }

  static defaultProps = {
    apiKey: undefined,
    token: undefined,
    domain: undefined,
    expandedContent: undefined,
    onCollapseCallback: () => {},
    onExpandCallback: () => {}
  }

  state = {
    isFetchingFirstNotifications: true,
    notificationList: []
  }

  componentDidMount = () => {
    this.getNotifications()
  }

  getNotifications = () => {
    const { apiKey, token, domain } = this.props
    fetchNotificationList({
      apiKey,
      token,
      domain
    })
      .then(response => {
        this.setState({
          notificationList: response.notifications,
          isFetchingFirstNotifications: false
        })
      })
      .catch(() => {
        this.setState({
          isFetchingFirstNotifications: false
        })
      })
  }

  refreshNotifications = () => {
    this.getNotifications()
  }

  onItemClick = notification => {
    // fetch data stored in integrators DB and display
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

  onDismissAllClick = () => {
    const newList = this.state.notificationList.map(n => {
      return {
        ...n,
        state: 'DISMISSED'
      }
    })

    this.setState({ notificationList: newList })

    const { apiKey, token, domain } = this.props
    dismissAllNotifications({
      apiKey,
      token,
      domain
    }).catch(error => console.error(error))
  }

  onDismissClick = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          state: 'DISMISSED'
        }
      }
      return n
    })
    this.setState({ notificationList: newList })
  }

  onDeleteClick = notification => {
    const newList = this.state.notificationList.filter(
      n => n.id !== notification.id
    )
    this.setState({ notificationList: newList })
  }

  renderDismissAllButton = () => (
    <div className="chata-notification-dismiss-all">
      <span onClick={this.onDismissAllClick}>
        <Icon type="notification-off" style={{ verticalAlign: 'middle' }} />{' '}
        Dismiss All
      </span>
    </div>
  )

  render = () => {
    if (this.state.isFetchingFirstNotifications) {
      return (
        <div
          data-test="notification-list"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          Loading...
        </div>
      )
    } else if (!_get(this.state.notificationList, 'length')) {
      return (
        <div
          data-test="notification-list"
          style={{ textAlign: 'center', marginTop: '100px' }}
        >
          No notifications to display
        </div>
      )
    }

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
              domain={this.props.domain}
              apiKey={this.props.apiKey}
              token={this.props.token}
              notification={notification}
              onClick={this.onItemClick}
              onDismissCallback={this.onDismissClick}
              onDeleteCallback={this.onDeleteClick}
              onExpandCallback={this.props.onExpandCallback}
              onCollapseCallback={this.props.onCollapseCallback}
              expandedContent={this.props.expandedContent}
            />
          )
        })}
      </div>
    )
  }
}
