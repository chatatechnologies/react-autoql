import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'
import _get from 'lodash.get'

import { Icon } from '../../Icon'
import { LoadingDots } from '../../LoadingDots'
import { QueryOutput } from '../../QueryOutput'
import {
  dismissNotification,
  deleteNotification,
} from '../../../js/notificationService'
import dayjs from '../../../js/dayjsWithPlugins'

import { authenticationType } from '../../../props/types'
import { authenticationDefault } from '../../../props/defaults'

import './NotificationItem.scss'

dayjs.extend(advancedFormat)

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    authentication: authenticationType,
    notification: PropTypes.shape({}).isRequired,
    onExpandCallback: PropTypes.func,
    onDismissCallback: PropTypes.func,
    onDeleteCallback: PropTypes.func,
    activeNotificationData: PropTypes.shape({}),
    onErrorCallback: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    activeNotificationData: undefined,
    onExpandCallback: () => {},
    onDismissCallback: () => {},
    onDeleteCallback: () => {},
    onErrorCallback: () => {},
  }

  state = {
    notification: this.props.notification,
  }

  getIsTriggered = state => {
    return ['ACKNOWLEDGED', 'UNACKNOWLEDGED'].includes(state)
  }

  onClick = notification => {
    if (notification.expanded) {
      this.props.onCollapseCallback(notification)
    } else {
      this.props.onExpandCallback(notification)
    }

    this.props.onClick(notification)
  }

  onDismissClick = (e, notification) => {
    e.stopPropagation()
    this.props.onDismissCallback(notification)

    dismissNotification({
      ...this.props.authentication,
      notificationId: notification.id,
    }).catch(error => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  onDeleteClick = (e, notification) => {
    e.stopPropagation()
    this.props.onDeleteCallback(notification)

    deleteNotification({
      ...this.props.authentication,
      notificationId: notification.id,
    }).catch(error => {
      console.error(error)
      this.props.onErrorCallback(error)
    })
  }

  formatTimestamp = timestamp => {
    const time = dayjs.unix(timestamp).format('h:mma')
    const day = dayjs.unix(timestamp).format('MM-DD-YY')
    const today = dayjs().format('MM-DD-YY')
    const yesterday = dayjs()
      .subtract(1, 'd')
      .format('MM-DD-YY')

    if (day === today) {
      return `Today at ${time}`
    } else if (day === yesterday) {
      return `Yesterday at ${time}`
    } else if (dayjs().isSame(timestamp, 'year')) {
      return `${dayjs.unix(timestamp).format('MMMM Do')} at ${time}`
    }
    return `${dayjs.unix(timestamp).format('MMMM Do, YYYY')} at ${time}`
  }

  renderAlertColorStrip = () => (
    <div className="chata-notification-alert-strip" />
  )

  render = () => {
    const { notification } = this.props

    return (
      <div
        key={`chata-notification-item-${this.COMPONENT_KEY}`}
        className={`chata-notification-list-item
          ${this.getIsTriggered(notification.state) ? ' triggered' : ''}
          ${notification.expanded ? ' expanded' : ''}`}
      >
        <div
          className="chata-notification-list-item-header"
          onClick={() => {
            this.onClick(notification)
          }}
        >
          {
            //   <div className="chata-notification-img-container">
            //   <div className="chata-notification-img">A</div>
            // </div>
          }
          <div className="chata-notification-display-name-container">
            <div className="chata-notification-display-name">
              {notification.title}
            </div>
            <div className="chata-notification-description">
              {notification.message}
            </div>
            <div className="chata-notification-timestamp">
              <Icon type="calendar" />{' '}
              {this.formatTimestamp(notification.created_at)}
            </div>
          </div>
          {this.getIsTriggered(notification.state) ? (
            <div className="chata-notification-dismiss-btn">
              <Icon
                type="notification-off"
                className="chata-notification-dismiss-icon"
                data-tip="Dismiss"
                data-for="chata-notification-tooltip"
                onClick={e => {
                  this.onDismissClick(e, notification)
                  ReactTooltip.hide()
                }}
              />
            </div>
          ) : (
            <div className="chata-notification-dismiss-btn">
              <Icon
                type="close"
                className="chata-notification-delete-icon"
                data-tip="Delete"
                data-for="chata-notification-tooltip"
                onClick={e => {
                  this.onDeleteClick(e, notification)
                  ReactTooltip.hide()
                }}
              />
            </div>
          )}
        </div>
        <div
          className={`chata-notification-expanded-content ${
            notification.expanded ? ' visible' : ''
          }`}
        >
          {
            // notification.expanded && (
            <Fragment>
              <div
                className="chata-notification-data-container"
                onClick={e => e.stopPropagation()}
              >
                {this.props.activeNotificationData ? (
                  <QueryOutput
                    queryResponse={{
                      data: this.props.activeNotificationData,
                    }}
                    displayType="table"
                  />
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <LoadingDots />
                  </div>
                )}
              </div>
              {<div className="chata-notification-extra-content"></div>}
            </Fragment>
            // )
          }
        </div>
        {this.renderAlertColorStrip()}
      </div>
    )
  }
}
