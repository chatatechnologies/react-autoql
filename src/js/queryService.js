import axios from 'axios'
import uuid from 'uuid'

import { TABLE_TYPES } from './Constants'

var unifiedQueryId = uuid.v4()

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

export const runQueryOnly = (
  query,
  demo,
  domain,
  apiKey,
  customerId,
  userId
) => {
  const text = query
  const axiosInstance = axios.create({})

  // if (!queryCall) {
  // queryCall = axios.CancelToken.source()

  const url = demo
    ? `https://backend-staging.chata.ai/api/v1/chata/query`
    : `${domain}/api/v1/chata/query?key=${apiKey}`

  const data = {
    text,
    customerId,
    userId
  }

  return axiosInstance
    .post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
      // cancelToken: queryCall.token
    })
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
        TABLE_TYPES.includes(response.data.data.displayType)
      ) {
        queryResponse.data.data.displayType = 'table'
      }

      return Promise.resolve(queryResponse)
    })
    .catch(error => {
      if (axios.isCancel(error)) {
        return Promise.reject({ error: 'cancelled' })
      }
      return Promise.reject(error)
    })
  // } else {
  //   queryCall = null
  //   return Promise.reject()
  // }
}

export const runQuery = (
  query,
  demo,
  useSafetyNet,
  domain,
  apiKey,
  customerId,
  userId
) => {
  const axiosInstance = axios.create({})

  // Reset unified query ID
  unifiedQueryId = uuid.v4()

  if (useSafetyNet) {
    // safetyNetCall = axios.CancelToken.source()

    const url = demo
      ? `https://backend-staging.chata.ai/api/v1/safetynet?q=${encodeURIComponent(
        query
      )}&projectId=1&unified_query_id=${unifiedQueryId}`
      : `${domain}/api/v1/chata/safetynet?query=${encodeURIComponent(
        query
      )}&key=${apiKey}&customer_id=${customerId}&user_id=${userId}`

    return axiosInstance
      .get(
        url
        // { cancelToken: safetyNetCall.token }
      )
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
        return runQueryOnly(query, demo, domain, apiKey, customerId, userId)
      })
      .catch(() => {
        return runQueryOnly(query, demo, domain, apiKey, customerId, userId)
      })
  }

  return runQueryOnly(query, demo, domain, apiKey, customerId, userId)
}

export const runDrilldown = (
  queryID,
  groupByObject,
  demo,
  apiKey,
  customerId,
  userId
) => {
  const axiosInstance = axios.create({})

  // drilldownCall = axios.CancelToken.source()

  let data = {}
  if (demo) {
    data = {
      queryId: queryID,
      groupBys: groupByObject,
      customerId: customerId,
      userId: userId
    }
  } else {
    data = {
      query_id: queryID,
      group_bys: groupByObject
    }
  }

  const url = demo
    ? `https://backend-staging.chata.ai/api/v1/chata/query/drilldown`
    : `${domain}/api/v1/chata/query/drilldown?key=${apiKey}`

  return axiosInstance
    .post(
      url,
      data
      // { cancelToken: drilldownCall.token }
    )
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}

export const fetchSuggestions = (
  suggestion,
  demo,
  domain,
  apiKey,
  customerId,
  userId
) => {
  const axiosInstance = axios.create({})

  // Cancel current autocomplete call if there is one
  if (autoCompleteCall) {
    autoCompleteCall.cancel('Autocomplete operation cancelled by the user.')
  }

  autoCompleteCall = axios.CancelToken.source()

  const url = demo
    ? `https://backend-staging.chata.ai/api/v1/autocomplete?q=${encodeURIComponent(
      suggestion
    )}&projectid=1`
    : `${domain}/api/v1/chata/autocomplete?query=${encodeURIComponent(
      suggestion
    )}&key=${apiKey}&customer_id=${customerId}&user_id=${userId}`

  return axiosInstance
    .get(url, { cancelToken: autoCompleteCall.token })
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
