import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { ResponseRenderer } from '../../ResponseRenderer'
import { Icon } from '../../Icon'

import './NotificationItem.scss'

dayjs.extend(advancedFormat)

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

export default class NotificationItem extends React.Component {
  COMPONENT_KEY = uuid.v4()

  static propTypes = {
    notification: PropTypes.shape({}).isRequired,
    onClick: PropTypes.func.isRequired,
    onDismissClick: PropTypes.func.isRequired
  }

  state = {
    notification: this.props.notification
  }

  onClick = notification => {
    this.props.onClick(notification)
  }

  onDismissClick = (e, notification) => {
    e.stopPropagation()
    this.props.onDismissClick(e, notification)
    // this.setState({ triggered: false })
    // Make backend call to acknowledge notification
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
      return `${dayjs(timestamp).format('MMMM Do')} at ${time}`
    }
    return `${dayjs(timestamp).format('MMMM Do, YYYY')} at ${time}`
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
          ${notification.triggered ? ' triggered' : ''}
          ${notification.expanded ? ' expanded' : ''}`}
        onClick={() => this.onClick(notification)}
      >
        <div className="chata-notification-list-item-header">
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
          <div className="chata-notification-data-container">
            <ResponseRenderer
              response={sampleNotificationData}
              displayType="column"
            />
          </div>
        )}
        {this.renderAlertColorStrip()}
      </div>
    )
  }
}
