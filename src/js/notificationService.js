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
      const fullList = _get(response, 'data.data.notifications')
      const filteredList = fullList
        ? fullList.filter(notification => notification.state !== 'DELETED')
        : []
      return Promise.resolve(filteredList)
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
    state: 'DELETED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications/${notificationId}?key=${apiKey}`

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
    state: 'DISMISSED'
  }

  const url = `${domain}/autoql/api/v1/rules/notifications/${notificationId}?key=${apiKey}`

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
