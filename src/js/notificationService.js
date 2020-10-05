import axios from 'axios'
import _get from 'lodash.get'

// ----------------- GET --------------------
export const isExpressionQueryValid = ({ query, domain, apiKey, token }) => {
  const url = `${domain}/autoql/api/v1/query?key=${apiKey}`

  const data = {
    text: query,
    translation: 'exclude',
  }

  if (!query || !query.trim()) {
    return Promise.reject({ error: 'No query supplied' })
  }

  if (!apiKey || !domain || !token) {
    return Promise.reject({ error: 'Unauthenticated' })
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios.post(url, data, config)
}

export const fetchNotificationCount = ({
  domain,
  apiKey,
  token,
  unacknowledged = 0,
}) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules/notifications/summary/poll?key=${apiKey}&unacknowledged=${unacknowledged}`

  const config = {
    timeout: 180000,
  }

  return axiosInstance
    .get(url, config)
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
      return Promise.reject(error)
    })
}

export const fetchNotificationsList = ({
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
    .then((response) => {
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
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const fetchNotificationChannels = ({
  domain,
  apiKey,
  token,
  channelType,
}) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/notifications/channels?key=${apiKey}&type=${channelType}`
  return axiosInstance
    .get(url)
    .then((response) => {
      return Promise.resolve(_get(response, 'data'))
    })
    .catch((error) => {
      if (_get(error, 'response.status') === 404) {
        return Promise.resolve({ data: [] })
      }

      return Promise.reject(_get(error, 'response.data'))
    })
}

export const fetchDataAlerts = ({ domain, apiKey, token, type = 'user' }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/rules?key=${apiKey}&type=${type}`

  return axiosInstance
    .get(url)
    .then((response) => {
      return Promise.resolve(_get(response, 'data.data.rules'))
    })
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const fetchRule = ({ domain, apiKey, token, ruleId }) => {
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
    .get(url)
    .then((response) => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(_get(response, 'data.data'))
    })
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const updateNotificationRuleStatus = ({
  ruleId,
  status,
  type,
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

  if (type === 'PROJECT') {
    return toggleProjectRuleStatus({ ruleId, status, token, domain, apiKey })
  } else {
    return toggleUserRuleStatus({ ruleId, status, token, domain, apiKey })
  }
}

export const toggleUserRuleStatus = ({
  ruleId,
  status,
  token,
  domain,
  apiKey,
}) => {
  const data = {
    status,
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/rules/${ruleId}?key=${apiKey}`

  return axios
    .put(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const removeUserFromProjectRule = ({
  ruleId,
  token,
  domain,
  apiKey,
}) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/rules/${ruleId}/user?key=${apiKey}`

  return axios
    .delete(url, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}
export const addUserToProjectRule = ({ ruleId, token, domain, apiKey }) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/rules/${ruleId}/user?key=${apiKey}`

  return axios
    .post(url, {}, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const createNotificationChannel = ({
  token,
  domain,
  apiKey,
  channelType,
  channelName,
  channelEmail,
  userName,
  userEmail,
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const data = {
    channel_type: channelType,
    channel_name: channelName,
    channel_email: channelEmail,
    sender_name: userName,
    sender_email: userEmail,
  }

  const url = `${domain}/autoql/api/v1/notifications/channels?key=${apiKey}`

  return axios
    .post(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const sendDataToChannel = ({
  token,
  domain,
  apiKey,
  channelId,
  fileName,
  base64Data,
}) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const data = {
    attachment_name: fileName,
    attachment: base64Data,
  }

  const url = `${domain}/autoql/api/v1/notifications/channels/${channelId}/send?key=${apiKey}`

  return axios
    .post(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const toggleProjectRuleStatus = ({
  ruleId,
  status,
  token,
  domain,
  apiKey,
}) => {
  if (status === 'INACTIVE') {
    return removeUserFromProjectRule({
      ruleId,
      token,
      domain,
      apiKey,
    })
  } else {
    return addUserToProjectRule({
      ruleId,
      token,
      domain,
      apiKey,
    })
  }
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
    .then((response) => Promise.resolve(response))
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
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
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const removeNotificationChannel = ({
  channelId,
  domain,
  apiKey,
  token,
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

  const url = `${domain}/autoql/api/v1/notifications/channels/${channelId}?key=${apiKey}`

  return axiosInstance
    .delete(url)
    .then(() => {
      return Promise.resolve()
    })
    .catch((error) => {
      return Promise.reject(_get(error, 'response.data'))
    })
}
