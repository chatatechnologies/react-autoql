import axios from 'axios'
import _cloneDeep from 'lodash.clonedeep'

const generalErrorMessage =
  "Uh oh, Our system is experiencing an unexpected error. We're aware of this issue and are working to fix it as soon as possible."

// ----------------- GET --------------------
export const fetchNotificationData = ({ id, domain, apiKey, token }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/notifications/${id}?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then((response) => {
      const queryResult = response?.data?.data?.query_result
      if (queryResult) {
        return Promise.resolve({ data: queryResult })
      }

      return Promise.reject({ response: { data: { message: generalErrorMessage } } })
    })
    .catch((error) => Promise.reject({ data: error?.response?.data }))
}

export const isExpressionQueryValid = ({ query, domain, apiKey, token }) => {
  if (!query || !query.trim()) {
    return Promise.reject({ error: 'No query supplied' })
  }

  if (!apiKey || !domain || !token) {
    return Promise.reject({ error: 'Unauthenticated' })
  }

  return axios.post(
    `${domain}/autoql/api/v1/query?key=${apiKey}`,
    {
      text: query,
      translation: 'exclude',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
}

export const fetchNotificationCount = ({ domain, apiKey, token, unacknowledged = 0 }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/notifications/summary?key=${apiKey}&unacknowledged=${unacknowledged}`

  const config = {
    timeout: 180000,
  }

  return axiosInstance.get(url, config)
}

export const fetchNotificationFeed = ({ domain, apiKey, token, offset, limit }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/notifications?key=${apiKey}&offset=${offset}&limit=${limit}`

  return axiosInstance
    .get(url)
    .then((response) => Promise.resolve(response?.data?.data))
    .catch((error) => Promise.reject(error?.response?.data))
}

export const fetchNotificationChannels = ({ domain, apiKey, token, channelType }) => {
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
    .then((response) => Promise.resolve(response?.data))
    .catch((error) => {
      if (error?.response?.status === 404) {
        return Promise.resolve({ data: [] })
      }

      return Promise.reject(error?.response?.data)
    })
}

export const fetchDataAlerts = ({ domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then((response) => Promise.resolve(response?.data))
    .catch((error) => Promise.reject(error?.response.data))
}

export const fetchRule = ({ domain, apiKey, token, dataAlertId }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlertId}?key=${apiKey}`

  return axiosInstance
    .get(url)
    .then((response) => Promise.resolve(response?.data?.data))
    .catch((error) => Promise.reject(error?.response?.data))
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

  const url = `${domain}/autoql/api/v1/data-alerts/notifications?key=${apiKey}`

  return axiosInstance
    .put(url, data)
    .then((response) => Promise.resolve(response?.data?.data))
    .catch((error) => Promise.reject(error?.response?.data))
}

export const initializeAlert = ({ id, domain, apiKey, token }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  if (!id) {
    return Promise.reject(new Error('No ID provided'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/${id}/initialize?key=${apiKey}`

  return axiosInstance
    .put(url)
    .then((response) => Promise.resolve(response?.data?.data))
    .catch((error) => Promise.reject(error?.response?.data))
}

export const deleteNotification = ({ notificationId, domain, apiKey, token }) => {
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

  const url = `${domain}/autoql/api/v1/data-alerts/notifications/${notificationId}?key=${apiKey}`

  return axiosInstance.delete(url).catch((error) => {
    return Promise.reject(error?.response?.data)
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

  const url = `${domain}/autoql/api/v1/data-alerts/notifications?key=${apiKey}`

  return axiosInstance.put(url, data).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const markNotificationAsUnread = ({ notificationId, domain, apiKey, token }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  if (!notificationId) {
    return Promise.reject(new Error('No ID provided'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    state: 'ACKNOWLEDGED',
  }

  const url = `${domain}/autoql/api/v1/data-alerts/notifications/${notificationId}?key=${apiKey}`

  return axiosInstance.put(url, data).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const dismissNotification = ({ notificationId, domain, apiKey, token }) => {
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

  const url = `${domain}/autoql/api/v1/data-alerts/notifications/${notificationId}?key=${apiKey}`

  return axiosInstance.put(url, data).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const removeUserFromProjectRule = ({ dataAlertId, token, domain, apiKey }) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlertId}/user?key=${apiKey}`

  return axios.delete(url, config).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const addUserToProjectRule = ({ dataAlertId, token, domain, apiKey }) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlertId}/user?key=${apiKey}`

  return axios.post(url, {}, config).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const toggleProjectDataAlertStatus = ({ dataAlertId, status, token, domain, apiKey }) => {
  if (status === 'INACTIVE') {
    return removeUserFromProjectRule({
      dataAlertId,
      token,
      domain,
      apiKey,
    })
  } else {
    return addUserToProjectRule({
      dataAlertId,
      token,
      domain,
      apiKey,
    })
  }
}

export const toggleCustomDataAlertStatus = ({ dataAlertId, status, token, domain, apiKey }) => {
  const data = {
    status,
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlertId}?key=${apiKey}`

  return axios.put(url, data, config).catch((error) => {
    return Promise.reject(error?.response?.data)
  })
}

export const updateDataAlertStatus = ({ dataAlertId, status, type, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!dataAlertId) {
    return Promise.reject(new Error('No rule to update'))
  }

  if (type === 'PROJECT') {
    return toggleProjectDataAlertStatus({
      dataAlertId,
      status,
      token,
      domain,
      apiKey,
    })
  } else {
    return toggleCustomDataAlertStatus({
      dataAlertId,
      status,
      token,
      domain,
      apiKey,
    })
  }
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

  return axios.post(url, data, config).catch((error) => Promise.reject(error?.response?.data))
}

export const sendDataToChannel = ({ token, domain, apiKey, channelId, fileName, base64Data }) => {
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

  return axios.post(url, data, config).catch((error) => Promise.reject(error?.response?.data))
}

export const updateDataAlert = ({ dataAlert, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  // Make sure there is an id, or it will batch all notifications
  if (!dataAlert) {
    return Promise.reject(new Error('No rule to update'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlert.id}?key=${apiKey}`

  return axiosInstance.put(url, dataAlert).catch((error) => Promise.reject(error?.response?.data))
}

// ----------------- POST --------------------
export const createDataAlert = ({ dataAlert, domain, apiKey, token }) => {
  // If there is missing data, dont bother making the call
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = _cloneDeep(dataAlert)
  delete data.id

  const url = `${domain}/autoql/api/v1/data-alerts?key=${apiKey}`

  return axiosInstance.post(url, data).catch((error) => Promise.reject(error?.response?.data))
}

export const validateExpression = ({ expression, domain, apiKey, token }) => {
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = { expression }

  const url = `${domain}/autoql/api/v1/data-alerts/validate?key=${apiKey}`

  return axiosInstance.post(url, data).catch((error) => Promise.reject(error?.response?.data))
}

// DELETE
export const deleteDataAlert = (dataAlertId, authObject) => {
  // If there is missing data, dont bother making the call
  const { domain, apiKey, token } = authObject
  if (!token || !apiKey || !domain) {
    return Promise.reject(new Error('UNAUTHORIZED'))
  }

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const url = `${domain}/autoql/api/v1/data-alerts/${dataAlertId}?key=${apiKey}`

  return axiosInstance.delete(url).catch((error) => Promise.reject(error?.response?.data))
}

export const removeNotificationChannel = ({ channelId, domain, apiKey, token }) => {
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

  return axiosInstance.delete(url).catch((error) => Promise.reject(error?.response?.data))
}
