import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { FaExclamationCircle } from 'react-icons/fa'
import { FiBellOff, FiCalendar } from 'react-icons/fi'
import { IoMdNotificationsOff } from 'react-icons/io'
import dayjs from 'dayjs'

import { Checkbox } from '../Checkbox'
import { fetchNotificationList } from '../../js/queryService'
import { ResponseRenderer } from '../ResponseRenderer'

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
        [1483142400, 12500],
        [1488240000, 48617.35],
        [1490918400, 31353.87],
        [1493510400, 33004.02],
        [1496188800, 29622.42],
        [1498780800, 40084.5],
        [1501459200, 41478.14],
        [1504137600, 37658.56],
        [1506729600, 63409.32],
        [1509408000, 78697.55],
        [1512000000, 99994.38],
        [1514678400, 113957.57],
        [1517356800, 165525.81],
        [1519776000, 156044.04],
        [1522454400, 198731.02],
        [1525046400, 182790.45],
        [1527724800, 202701.52],
        [1530316800, 221529.55],
        [1532995200, 228440.21],
        [1535673600, 252521.14],
        [1538265600, 252050.12],
        [1540944000, 299770.05],
        [1543536000, 271606.28],
        [1546214400, 297926.41],
        [1548892800, 341052.56],
        [1551312000, 241761.74],
        [1553990400, 330255.45],
        [1556582400, 344230.06],
        [1559260800, 301566.55],
        [1561852800, 321731.61],
        [1564531200, 293436.41],
        [1567209600, 291910.82],
        [1569801600, 307279.31],
        [1572480000, 320530.89],
        [1575072000, 89835.44]
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
    <div
      className="chata-notification-dismiss-all"
      onClick={this.onDismissAllclick}
    >
      <FiBellOff style={{ verticalAlign: 'middle' }} /> Dismiss All
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
                  <FiBellOff
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
                    <FiCalendar />{' '}
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
