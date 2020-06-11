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
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules/notifications/state-count?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data.unacknowledged'))
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const fetchNotificationList = ({
  domain,
  apiKey,
  token,
  offset,
  limit,
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}&offset=${offset}&limit=${limit}`

  return axiosInstance
    .get(url)
    .then(response => {
      const formattedResponse = {
        notifications: _get(response, 'data.data.notifications'),
        pagination: {
          offset: _get(response, 'data.data.offset'),
          limit: _get(response, 'data.data.limit'),
          page_number: _get(response, 'data.data.page_number'),
          total_elements: _get(response, 'data.data.total_elements'),
          total_pages: _get(response, 'data.data.total_pages'),
        },
      }
      return Promise.resolve(formattedResponse)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const fetchNotificationSettings = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data.rules'))
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

// ----------------- PUT --------------------
export const resetNotificationCount = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    notification_id: null,
    state: 'ACKNOWLEDGED',
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const deleteNotification = ({
  notificationId,
  domain,
  apiKey,
  token,
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
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules/notifications/${notificationId}?key=${apiKey}`

  return axiosInstance
    .delete(url)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const dismissAllNotifications = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    state: 'DISMISSED',
  }

  const url = `${domain}/autoql/api/v1/rules/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const dismissNotification = ({
  notificationId,
  domain,
  apiKey,
  token,
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
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    state: 'DISMISSED',
  }

  const url = `${domain}/autoql/api/v1/rules/notifications/${notificationId}?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const updateNotificationRuleStatus = ({
  ruleId,
  status,
  domain,
  apiKey,
  token,
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!ruleId) {
    return Promise.reject(new Error('No rule to update'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    status,
  }

  const url = `${domain}/autoql/api/v1/rules/${ruleId}?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => Promise.resolve(response))
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
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
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    ...rule,
  }

  const url = `${domain}/autoql/api/v1/rules/${rule.id}?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then(response => Promise.resolve(response))
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

// ----------------- POST --------------------
export const createNotificationRule = ({ rule, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    ...rule,
  }

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}`

  return axiosInstance
    .post(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

// DELETE
export const deleteNotificationRule = ({ ruleId, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules/${ruleId}?key=${apiKey}`

  return axiosInstance
    .delete(url)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject(_get(error, 'response.data'))
    })
}
