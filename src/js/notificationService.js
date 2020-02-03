import axios from 'axios'
import _get from 'lodash.get'

import { TABLE_TYPES } from './Constants'

import sampleNotifications from '../components/Notifications/NotificationSettings/sampleNotifications'

export const fetchNotificationCount = ({
  customerId,
  userId,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve({ data: { count: 2 } })
    })
  }, 2000)
}

export const resetNotificationCount = ({
  customerId,
  userId,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve()
    })
  }, 2000)
}

export const fetchNotificationList = ({
  customerId,
  userId,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve(sampleNotifications)
    }, 2000)
  })
}
