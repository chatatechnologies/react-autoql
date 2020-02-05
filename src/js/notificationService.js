import axios from 'axios'
import _get from 'lodash.get'

// ----------------- GET --------------------
export const fetchNotificationCount = ({
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve(2)
    }, 100)
  })

  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules/notifications/state-count?key=${apiKey}&user_id=${userId}&customer_id=${customerId}&username=${username}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data.unacknowledged'))
    })
    .catch(error => Promise.reject(error))
}

export const fetchNotificationList = ({
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve({
        notifications: [
          {
            id: 9,
            rule_id: 2,
            title: 'Large Transaction',
            message: 'We detected a transaction over $1000',
            query: 'All bank transactions over 1000 today',
            outcome: 'TRUE',
            state: 'UNACKNOWLEDGED',
            created_at: '2020-02-04T06:25:08.144+0000'
          },
          {
            id: 8,
            rule_id: 2,
            title: 'Low Balance',
            message: 'Your bank balance fell below $50,000',
            query: 'total bank balance per day last 5 days',
            outcome: 'TRUE',
            state: 'ACKNOWLEDGED',
            created_at: '2020-02-03T18:14:05.401+0000'
          },
          {
            id: 7,
            rule_id: 2,
            title: 'Credit Card Limit Exceeded',
            message: 'Your credit card balance has exceeded the limit',
            query: 'Total credit card balance',
            outcome: 'TRUE',
            state: 'DISMISSED',
            created_at: '2020-02-03T18:13:46.892+0000'
          }
        ],
        offset: 0,
        limit: 10,
        page_number: 0,
        total_elements: 3,
        total_pages: 1,
        unacknowledged_count: 1,
        acknowledged_count: 0,
        dismissed_count: 2
      })
    }, 1000)
  })

  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}&offset=0&limit=10&user_id=${userId}&customer_id=${customerId}&username=${username}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch(error => Promise.reject(error))
}

export const fetchNotificationSettings = ({
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      resolve([
        {
          id: '13459185913857',
          customer_id: 'customer-1',
          user_id: 'rschesnuk@chata.ai',
          title: 'Large Transaction',
          message: 'We detected a transaction over $1000',
          query: 'All bank transactions over 1000 today',
          notification_type: 'REPEAT_EVENT',
          status: 'ACTIVE',
          cycle: 'WEEK',
          reset_period: 'MONTH',
          day_numbers: [1, 2, 3, 4, 5, 6, 7],
          month_number: [],
          run_times: [],
          expression: [
            {
              id: '11',
              term_type: 'group',
              condition: 'TERMINATOR',
              term_value: [
                {
                  id: '111',
                  term_type: 'group',
                  condition: 'TERMINATOR',
                  term_value: [
                    {
                      id: '111',
                      term_type: 'query',
                      condition: 'EXISTS',
                      term_value: 'All bank transactions over 1000'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ])
    }, 1000)
  })

  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}&user_id=${userId}&customer_id=${customerId}&username=${username}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data'))
    })
    .catch(error => Promise.reject(error))
}

// ----------------- PUT --------------------
export const resetNotificationCount = ({
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    notification_id: null,
    state: 'ACKNOWLEDGED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch(error => Promise.reject(error))
}

export const deleteNotification = ({
  notificationId,
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!notificationId) {
    return Promise.reject(new Error('No ID provided'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    notification_id: notificationId,
    state: 'DELETED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}

export const dismissAllNotifications = ({
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    notification_id: null,
    state: 'DISMISSED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}

export const dismissNotification = ({
  notificationId,
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!notificationId) {
    return Promise.reject(new Error('No ID provided'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    notification_id: notificationId,
    state: 'DISMISSED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}

export const updateNotificationStatus = ({
  notificationId,
  status,
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!notificationId) {
    return Promise.reject(new Error('No ID provided'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    status
  }

  const url = `${domain}/autoql/api/v1/rules/${notificationId}?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}

// ----------------- POST --------------------
export const createNotificationRule = ({
  notification,
  customerId,
  userId,
  username,
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !userId || !customerId || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    customer_id: customerId,
    user_id: userId,
    username,
    ...notification
  }

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}`

  return axiosInstance
    .post(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}
