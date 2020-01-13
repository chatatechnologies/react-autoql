import axios from 'axios'
import _get from 'lodash.get'

import { TABLE_TYPES } from './Constants'

// axios.defaults.timeout = 10000

var autoCompleteCall = null
// var queryCall = null
// var safetyNetCall = null
// var drilldownCall = null

const transformSafetyNetResponse = response => {
  let newResponse = response
  if (_get(response, 'data.data.replacements')) {
    newResponse = {
      ...newResponse,
      data: {
        ...newResponse.data,
        full_suggestion: response.data.data.replacements.map(suggs => {
          let newSuggestionList = suggs.suggestionList || suggs.suggestions
          if (newSuggestionList) {
            newSuggestionList = suggs.suggestionList.map(sugg => {
              return {
                ...sugg,
                value_label: sugg.value_label
              }
            })
          }
          return {
            ...suggs,
            suggestion_list: newSuggestionList
          }
        }),
        query: response.data.data.query
      }
    }
  }
  return newResponse
}

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
  token,
  username
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
    username: demo ? 'widget-demo' : username || 'widget-user',
    customer_id: customerId,
    user_id: userId,
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

  if (!demo && (!userId || !customerId || !apiKey || !domain)) {
    return Promise.reject({ error: 'unauthenticated' })
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
  token,
  username
}) => {
  if (useSafetyNet) {
    // safetyNetCall = axios.CancelToken.source()
    return runSafetyNet({
      query,
      demo,
      domain,
      apiKey,
      customerId,
      userId,
      token
    })
      .then(response => {
        if (
          _get(response, 'data.full_suggestion.length') > 0 ||
          _get(response, 'data.data.replacements.length') > 0
          // && !this.state.skipSafetyNet
        ) {
          const newResponse = transformSafetyNetResponse(response)
          return Promise.resolve(newResponse)
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
          token,
          username
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
          token,
          username
        })
      })
  }

  return runQueryOnly({
    query,
    demo,
    debug,
    test,
    token,
    domain,
    apiKey,
    customerId,
    userId,
    username
  })
}

export const runSafetyNet = ({
  query,
  demo,
  domain,
  apiKey,
  customerId,
  userId,
  token
}) => {
  const axiosInstance = axios.create({})

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
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
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
  token,
  username
}) => {
  const axiosInstance = axios.create({})

  // drilldownCall = axios.CancelToken.source()

  const data = {
    customer_id: customerId,
    user_id: userId,
    debug,
    test,
    username
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

export const fetchApiId = (apiKey, token) => {
  const url = `https://backend-staging.chata.io/api/v1/integrator?key=${apiKey}`
  const axiosInstance = axios.create({})

  return axiosInstance
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}

export const setColumnVisibility = ({
  apiKey,
  userId,
  token,
  // domain,
  columns
}) => {
  return fetchApiId(apiKey, token)
    .then(response => {
      const apiId = response.data
      const url = `https://backend-staging.chata.io/api/v1/colvisibilitySetting/set/${apiId}/${userId}`
      const data = { columns }

      const config = {}
      if (token) {
        config.headers = {
          Authorization: `Bearer ${token}`
        }
      }

      const axiosInstance = axios.create({})
      return axiosInstance
        .put(url, data, config)
        .then(response => Promise.resolve(response))
        .catch(error => Promise.reject(error))
    })
    .catch(error => Promise.reject(error))
}

export const fetchQueryTips = ({
  keywords,
  customerId,
  userId,
  limit,
  offset,
  domain,
  apiKey,
  token,
  skipSafetyNet
} = {}) => {
  const queryTipsUrl = `${domain}/api/v1/chata/inspirations?key=${apiKey}&keywords=${keywords}&customer_id=${customerId}&user_id=${userId}&limit=${limit}&offset=${offset}`

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!skipSafetyNet) {
    return runSafetyNet({
      query: keywords,
      demo: false,
      domain,
      apiKey,
      customerId,
      userId,
      token
    })
      .then(safetyNetResponse => {
        if (
          _get(safetyNetResponse, 'data.full_suggestion.length') > 0 ||
          _get(safetyNetResponse, 'data.data.replacements.length') > 0
          // && !this.state.skipSafetyNet
        ) {
          const newResponse = transformSafetyNetResponse(safetyNetResponse)
          return Promise.resolve(newResponse)
        }
        return axiosInstance
          .get(queryTipsUrl)
          .then(response => Promise.resolve(response))
          .catch(error => Promise.reject(error))
      })
      .catch(() => {
        return axiosInstance
          .get(queryTipsUrl)
          .then(response => Promise.resolve(response))
          .catch(error => Promise.reject(error))
      })
  }

  return axiosInstance
    .get(queryTipsUrl)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}

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
  })
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
  })
}
