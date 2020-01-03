import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

import { Checkbox } from '../../Checkbox'
import { ResponseRenderer } from '../../ResponseRenderer'
import { Icon } from '../../Icon'

import './NotificationList.scss'

const sampleNotificationData = {
  data: {
    message: '',
    data: {
      columns: [
        {
          type: 'DATE',
          name: 'transaction__transaction_date__month',
          groupable: true,
          active: false
        },
        {
          type: 'DOLLAR_AMT',
          name: 'transaction___sum',
          groupable: false,
          active: false
        }
      ],
      display_type: 'data',
      rows: [
        [1527724800, 202.52],
        [1530316800, 221.55],
        [1532995200, 228.21],
        [1535673600, 252.14],
        [1538265600, 252.12],
        [1540944000, 299.05],
        [1543536000, 271.28],
        [1546214400, 297.41],
        [1548892800, 341.56],
        [1551312000, 241.74],
        [1553990400, 330.45],
        [1556582400, 444.06],
        [1559260800, 501.55],
        [1561852800, 621.61],
        [1564531200, 993.41],
        [1567209600, 891.82],
        [1569801600, 807.31],
        [1572480000, 920.89],
        [1575072000, 1504.98]
      ],
      sql: [
        'select distinct qbo57.txndatemonth transaction__transaction_date__month, sum(qbo57.hometotalamt) transaction___sum from transactions qbo57 group by qbo57.txndatemonth'
      ],
      query_id: 'q_BZV5JAS5Q4i0A2iqff5nnA',
      interpretation: 'total transactions by transaction month'
    },
    reference_id: '1.1.0'
  }
}

const notificationList = [
  {
    id: 1,
    displayName: 'Transactions exceeded $1000',
    triggered: true,
    expanded: false,
    enabled: true,
    last_triggered: new Date()
  },
  {
    id: 2,
    displayName: 'Over budget this month',
    triggered: true,
    expanded: false,
    enabled: true,
    last_triggered: new Date()
  },
  {
    id: 3,
    displayName: 'Balance fell below $500',
    triggered: false,
    expanded: false,
    enabled: true,
    last_triggered: new Date()
  }
]

export default class NotificationList extends React.Component {
  // Open event source http connection here to receive SSE
  // notificationEventSource = new EventSource(
  //   'https://backend.chata.io/notifications'
  // )

  static propTypes = {}

  state = {
    notificationList: notificationList
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

  onDismissClick = (e, notification) => {
    e.stopPropagation()
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

  onDismissAllclick = () => {
    const newList = this.state.notificationList.map(n => {
      return {
        ...n,
        triggered: false
      }
    })
    this.setState({ notificationList: newList })
  }

  onEnableSwitchChange = notification => {
    const newList = this.state.notificationList.map(n => {
      if (notification.id === n.id) {
        return {
          ...n,
          enabled: !n.enabled
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

  renderAlertColorStrip = () => (
    <div className="chata-notification-alert-strip" />
  )

  render = () => {
    return (
      <div className="chata-notification-list-container">
        {this.renderDismissAllButton()}
        {this.state.notificationList.map((notification, i) => {
          return (
            <div
              key={`chata-notification-item-${i}`}
              className={`chata-notification-list-item
                ${notification.triggered ? ' triggered' : ''}
                ${notification.expanded ? ' expanded' : ''}`}
              onClick={() => this.onItemClick(notification)}
            >
              <div className="chata-notification-list-item-header">
                <div className="chata-notification-display-name">
                  {notification.displayName}
                </div>
                {notification.triggered ? (
                  // <div className="chata-notification-dismiss-btn">
                  //   Dismiss
                  // </div>
                  <Icon
                    type="notification-off"
                    className="chata-notification-dismiss-icon"
                    onClick={e => this.onDismissClick(e, notification)}
                  />
                ) : (
                  <Checkbox
                    type="switch"
                    checked={notification.enabled}
                    className="chata-notification-enable-checkbox"
                    onChange={() => this.onEnableSwitchChange(notification)}
                  />
                )}
              </div>
              {notification.expanded && (
                <Fragment>
                  <div className="chata-notification-data-title">
                    <Icon type="calendar" />{' '}
                    <em>
                      Triggered on {dayjs(notification.last_triggered).format()}
                    </em>
                  </div>
                  <div className="chata-notification-data-container">
                    <ResponseRenderer
                      response={sampleNotificationData}
                      displayType="column"
                    />
                  </div>
                </Fragment>
              )}
              {this.renderAlertColorStrip()}
              {
                // notification.triggered && (
                //   <div className="chata-notification-click-to-dismiss">
                //     Click to Dismiss
                //   </div>
                // )
              }
              {
                //   notification.triggered && (
                //   <div className="chata-notification-alert-icon">
                //     <FaExclamationCircle />
                //   </div>
                // )
              }
            </div>
          )
        })}
      </div>
    )
  }
}
