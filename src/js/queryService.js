import axios from 'axios'
import uuid from 'uuid'

var unifiedQueryId = uuid.v4()

var autoCompleteCall = axios.CancelToken.source()
var queryCall = axios.CancelToken.source()
var safetyNetCall = axios.CancelToken.source()
var drilldownCall = axios.CancelToken.source()

export const cancelQuery = () => {
  if (queryCall) {
    queryCall.cancel('Query operation cancelled by the user.')
  }
  if (safetyNetCall) {
    safetyNetCall.cancel('Safetynet operation cancelled by the user.')
  }
  if (drilldownCall) {
    drilldownCall.cancel('Drilldown operation cancelled by the user.')
  }
}

export const runQueryOnly = (query, token, projectId = 1) => {
  const queryString = query
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  if (!queryCall) {
    queryCall = axios.CancelToken.source()

    const url = `https://backend-staging.chata.ai/api/v1/query?q=${queryString}&project=${projectId}&unified_query_id=${unifiedQueryId}`

    return axiosInstance
      .get(url, {
        cancelToken: queryCall.token
      })
      .then(response => {
        return Promise.resolve(response)
      })
      .catch(error => {
        if (axios.isCancel(error)) {
          return Promise.reject('cancelled')
        }
        return Promise.reject(error)
      })
  } else {
    queryCall = null
    return Promise.reject('cancelled')
  }
}

export const runQuery = (
  query,
  token,
  projectId = 1,
  useSafetyNet,
  skipSafetyNetCallback
) => {
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  // Reset unified query ID
  unifiedQueryId = uuid.v4()

  if (useSafetyNet) {
    safetyNetCall = axios.CancelToken.source()
    const url = `https://backend-staging.chata.ai/api/v1/safetynet?q=${encodeURIComponent(
      query
    )}&projectId=${projectId}&unified_query_id=${unifiedQueryId}`
    return axiosInstance
      .get(url, { cancelToken: safetyNetCall.token })
      .then(response => {
        if (
          response &&
          response.data &&
          response.data.full_suggestion &&
          response.data.full_suggestion.length > 0
          // && !this.state.skipSafetyNet
        ) {
          return Promise.resolve(response)
        }
        return runQueryOnly(query, token, projectId)
      })
      .catch(() => {
        return runQueryOnly(query, token, projectId)
      })
  }

  return runQueryOnly(query, token, projectId)
}

export const runDrilldown = (data, token, projectId = 1) => {
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  drilldownCall = axios.CancelToken.source()

  const url = `https://backend-staging.chata.ai/api/v1/query${
    projectId === 1 ? '/demo' : ''
  }/drilldown?&project=${projectId}&unified_query_id=${unifiedQueryId}`
  return axiosInstance
    .post(url, data, { cancelToken: drilldownCall.token })
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}

export const fetchSuggestions = (suggestion, token, projectId = 1) => {
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  // Cancel current autocomplete call if there is one
  if (autoCompleteCall) {
    autoCompleteCall.cancel('Autocomplete operation cancelled by the user.')
  }

  autoCompleteCall = axios.CancelToken.source()

  const url = `https://backend-staging.chata.ai/api/v1/autocomplete?q=${encodeURIComponent(
    suggestion
  )}&projectid=${projectId}`

  return axiosInstance
    .get(url, {
      cancelToken: autoCompleteCall.token
    })
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
