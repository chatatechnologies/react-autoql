import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import ReactTooltip from 'react-tooltip'

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
    timestamp: new Date()
  },
  {
    id: 2,
    displayName: 'Over budget this month',
    triggered: true,
    expanded: false,
    timestamp: dayjs().subtract(1, 'd')
  },
  {
    id: 3,
    displayName: 'Balance fell below $500',
    triggered: false,
    expanded: false,
    timestamp: dayjs().subtract(2, 'd')
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

  componentDidUpdate = () => {
    // setTimeout(() => {
    //   ReactTooltip.hide()
    // }, 100)
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

  formatTimestamp = timestamp => {
    const time = dayjs(timestamp).format('h:mma')
    const day = dayjs(timestamp).format('MM-DD-YY')
    const today = dayjs().format('MM-DD-YY')
    const yesterday = dayjs()
      .subtract(1, 'd')
      .format('MM-DD-YY')

    if (day === today) {
      return `Today at ${time}`
    } else if (day === yesterday) {
      return `Yesterday at ${time}`
    } else if (dayjs().isSame(timestamp, 'year')) {
      return `${dayjs(timestamp).format('MMMM D')} at ${time}`
    }
    return `${dayjs(timestamp).format('MMMM D, YYYY')} at ${time}`
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
            <div
              key={`chata-notification-item-${i}`}
              className={`chata-notification-list-item
                ${notification.triggered ? ' triggered' : ''}
                ${notification.expanded ? ' expanded' : ''}`}
              onClick={() => this.onItemClick(notification)}
            >
              <div className="chata-notification-list-item-header">
                <div className="chata-notification-display-name-container">
                  <div className="chata-notification-display-name">
                    {notification.displayName}
                  </div>
                  <div className="chata-notification-timestamp">
                    <Icon type="calendar" />{' '}
                    {this.formatTimestamp(notification.timestamp)}
                  </div>
                </div>
                {notification.triggered && (
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
                )}
              </div>
              {notification.expanded && (
                <Fragment>
                  {
                    // <div className="chata-notification-data-title">
                    //   <Icon type="calendar" />{' '}
                    //   <em>
                    //     Triggered on {dayjs(notification.last_triggered).format()}
                    //   </em>
                    // </div>
                  }
                  <div className="chata-notification-data-container">
                    <ResponseRenderer
                      response={sampleNotificationData}
                      displayType="column"
                    />
                  </div>
                </Fragment>
              )}
              {this.renderAlertColorStrip()}
            </div>
          )
        })}
      </div>
    )
  }
}
