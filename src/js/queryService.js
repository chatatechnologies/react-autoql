import axios from 'axios'
import uuid from 'uuid'

import { TABLE_TYPES } from './Constants'

// axios.defaults.timeout = 10000

var autoCompleteCall = null
// var queryCall = null
// var safetyNetCall = null
// var drilldownCall = null

export const cancelQuery = () => {
  // if (queryCall) {
  //   queryCall.cancel('Query operation cancelled by the user.')
  // }
  // if (safetyNetCall) {
  //   safetyNetCall.cancel('Safetynet operation cancelled by the user.')
  // }
  // if (drilldownCall) {
  //   drilldownCall.cancel('Drilldown operation cancelled by the user.')
  // }
}

export const runQueryOnly = ({
  query,
  demo,
  debug,
  test,
  domain,
  apiKey,
  customerId,
  userId,
  token
}) => {
  const text = query
  const axiosInstance = axios.create({})

  // if (!queryCall) {
  // queryCall = axios.CancelToken.source()

  const url = demo
    ? `https://backend-staging.chata.ai/api/v1/chata/query`
    : `${domain}/api/v1/chata/query?key=${apiKey}`

  const data = {
    text,
    customer_id: customerId,
    user_id: demo ? 'widget-demo' : userId || 'widget-user',
    debug,
    test
  }

  const config = {}
  // config.cancelToken = queryCall.token
  if (token && !demo) {
    config.headers = {
      // 'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  return axiosInstance
    .post(url, data, config)
    .then(response => {
      if (response.data && typeof response.data === 'string') {
        // There was an error parsing the json
        // queryCall = null
        return Promise.reject({ error: 'parse error' })
      }

      // We don't want to return the detailed table types here because
      // these will not be returned in the response in the future
      // We can delete this when the detailed types are no longer returned
      let queryResponse = { ...response }
      if (
        response &&
        response.data &&
        response.data.data &&
        TABLE_TYPES.includes(response.data.data.display_type)
      ) {
        queryResponse.data.data.display_type = 'table'
      }

      return Promise.resolve(queryResponse)
    })
    .catch(error => {
      if (error.code === 'ECONNABORTED') {
        error.data = { message: 'Request Timed Out' }
      }
      if (axios.isCancel(error)) {
        error.data = { message: 'Query Cancelled' }
      }
      return Promise.reject(error)
    })
  // } else {
  //   queryCall = null
  //   return Promise.reject()
  // }
}

export const runQuery = ({
  query,
  demo,
  debug,
  test,
  useSafetyNet,
  domain,
  apiKey,
  customerId,
  userId,
  token
}) => {
  const axiosInstance = axios.create({})

  if (useSafetyNet) {
    // safetyNetCall = axios.CancelToken.source()

    const url = demo
      ? `https://backend.chata.ai/api/v1/safetynet?q=${encodeURIComponent(
        query
      )}&projectId=1`
      : `${domain}/api/v1/chata/safetynet?text=${encodeURIComponent(
        query
      )}&key=${apiKey}&customer_id=${customerId}&user_id=${userId}`

    const config = {}
    // config.cancelToken = safetyNetCall.token
    if (token && !demo) {
      config.headers = {
        Authorization: `Bearer ${token}`
      }
    }

    return axiosInstance
      .get(url, config)
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
        return runQueryOnly({
          query,
          demo,
          debug,
          test,
          domain,
          apiKey,
          customerId,
          userId,
          token
        })
      })
      .catch(() => {
        return runQueryOnly({
          query,
          demo,
          debug,
          test,
          domain,
          apiKey,
          customerId,
          userId,
          token
        })
      })
  }

  return runQueryOnly({
    query,
    demo,
    debug,
    test,
    domain,
    apiKey,
    customerId,
    userId
  })
}

export const runDrilldown = ({
  queryID,
  groupByObject,
  demo,
  debug,
  test,
  domain,
  apiKey,
  customerId,
  userId,
  token
}) => {
  const axiosInstance = axios.create({})

  // drilldownCall = axios.CancelToken.source()

  const data = {
    customer_id: customerId,
    user_id: userId,
    debug,
    test
  }

  if (demo) {
    data.query_id = queryID
    data.group_bys = groupByObject
  } else {
    data.columns = groupByObject
  }

  const config = {}
  // config.cancelToken = safetyNetCall.token
  if (token && !demo) {
    config.headers = {
      Authorization: `Bearer ${token}`
    }
  }

  const url = demo
    ? `https://backend-staging.chata.ai/api/v1/chata/query/drilldown`
    : `${domain}/api/v1/chata/query/${queryID}/drilldown?key=${apiKey}`

  return axiosInstance
    .post(url, data, config)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}

export const fetchSuggestions = (
  suggestion,
  demo,
  domain,
  api_key,
  customer_id,
  user_id,
  token
) => {
  const axiosInstance = axios.create({})

  // Cancel current autocomplete call if there is one
  if (autoCompleteCall) {
    autoCompleteCall.cancel('Autocomplete operation cancelled by the user.')
  }

  autoCompleteCall = axios.CancelToken.source()

  const url = demo
    ? `https://backend.chata.ai/api/v1/autocomplete?q=${encodeURIComponent(
      suggestion
    )}&projectid=1`
    : `${domain}/api/v1/chata/autocomplete?text=${encodeURIComponent(
      suggestion
    )}&key=${api_key}&customer_id=${customer_id}&user_id=${user_id}`

  const config = {}
  // config.cancelToken = autoCompleteCall.token
  if (token && !demo) {
    config.headers = {
      Authorization: `Bearer ${token}`
    }
  }

  return axiosInstance
    .get(url, config)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
