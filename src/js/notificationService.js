import axios from 'axios'
import _get from 'lodash.get'

// ----------------- GET --------------------
export const fetchNotificationCount = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules/notifications/state-count?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data.unacknowledged'))
    })
    .catch(error => Promise.reject(error))
}

export const fetchNotificationList = ({ domain, apiKey, token }) => {
  // return new Promise((resolve, reject) => {
  //   return setTimeout(() => {
  //     resolve({
  //       notifications: [
  //         {
  //           id: 9,
  //           rule_id: 2,
  //           title: 'Large Transaction',
  //           message: 'We detected a transaction over $1000',
  //           query: 'All bank transactions over 1000 today',
  //           outcome: 'TRUE',
  //           state: 'UNACKNOWLEDGED',
  //           created_at: '2020-02-04T06:25:08.144+0000'
  //         },
  //         {
  //           id: 8,
  //           rule_id: 2,
  //           title: 'Low Balance',
  //           message: 'Your bank balance fell below $50,000',
  //           query: 'total bank balance per day last 5 days',
  //           outcome: 'TRUE',
  //           state: 'ACKNOWLEDGED',
  //           created_at: '2020-02-03T18:14:05.401+0000'
  //         },
  //         {
  //           id: 7,
  //           rule_id: 2,
  //           title: 'Credit Card Limit Exceeded',
  //           message: 'Your credit card balance has exceeded the limit',
  //           query: 'Total credit card balance',
  //           outcome: 'TRUE',
  //           state: 'DISMISSED',
  //           created_at: '2020-02-03T18:13:46.892+0000'
  //         }
  //       ],
  //       offset: 0,
  //       limit: 10,
  //       page_number: 0,
  //       total_elements: 3,
  //       total_pages: 1,
  //       unacknowledged_count: 1,
  //       acknowledged_count: 0,
  //       dismissed_count: 2
  //     })
  //   }, 1000)
  // })

  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}&offset=0&limit=10`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch(error => Promise.reject(error))
}

export const fetchNotificationSettings = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then(response => {
      const fullList = _get(response, 'data.data.rules')
      const filteredList = fullList
        ? fullList.filter(rule => rule.status !== 'DELETED')
        : []
      return Promise.resolve(filteredList)
    })
    .catch(error => Promise.reject(error))
}

// ----------------- PUT --------------------
export const resetNotificationCount = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
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
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
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

export const dismissAllNotifications = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
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
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
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

export const updateNotificationRule = ({ rule, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!rule) {
    return Promise.reject(new Error('No rule to update'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
    ...rule
  }

  const url = `${domain}/autoql/api/v1/rules/${rule.id}?key=${apiKey}`

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
  domain,
  apiKey,
  token
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = {
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

// DELETE
export const deleteNotificationRule = ({ ruleId, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const url = `${domain}/autoql/api/v1/rules/${ruleId}?key=${apiKey}`

  return axiosInstance
    .delete(url)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => Promise.reject(error))
}
