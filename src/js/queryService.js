import axios from 'axios'
import _get from 'lodash.get'

import { TABLE_TYPES } from './Constants'

// axios.defaults.timeout = 10000

var autoCompleteCall = null
// var queryCall = null
// var safetyNetCall = null
// var drilldownCall = null

const formatSourceString = (sourceArray) => {
  try {
    const sourceString = sourceArray.join('.')
    return sourceString
  } catch (error) {
    return undefined
  }
}

const transformSafetyNetResponse = (response) => {
  let newResponse = response
  if (_get(response, 'data.data.replacements')) {
    newResponse = {
      ...newResponse,
      data: {
        ...newResponse.data,
        full_suggestion: response.data.data.replacements.map((suggs) => {
          let newSuggestionList = suggs.suggestions
          if (newSuggestionList) {
            newSuggestionList = suggs.suggestions.map((sugg) => {
              return {
                ...sugg,
                value_label: sugg.value_label,
              }
            })
          }
          return {
            ...suggs,
            suggestion_list: newSuggestionList,
          }
        }),
        query: response.data.data.query || response.data.data.text,
      },
    }
  }
  return newResponse
}

const failedValidation = (response) => {
  return (
    _get(response, 'data.full_suggestion.length') > 0 ||
    _get(response, 'data.data.replacements.length') > 0
  )
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
  debug,
  test,
  domain,
  apiKey,
  token,
  source,
} = {}) => {
  const axiosInstance = axios.create({})

  // if (!queryCall) {
  // queryCall = axios.CancelToken.source()

  const url = `${domain}/autoql/api/v1/query?key=${apiKey}`

  const data = {
    text: query,
    source: formatSourceString(source),
    translation: debug ? 'include' : 'exclude',
    test,
  }

  const config = {}
  // config.cancelToken = queryCall.token
  if (token) {
    config.headers = {
      // 'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  if (!apiKey || !domain) {
    return Promise.reject({ error: 'unauthenticated' })
  }

  return axiosInstance
    .post(url, data, config)
    .then((response) => {
      if (response.data && typeof response.data === 'string') {
        // There was an error parsing the json
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
    .catch((error) => {
      if (error.response === 401 || !_get(error, 'response.data')) {
        return Promise.reject({ error: 'unauthenticated' })
      } else if (error.code === 'ECONNABORTED') {
        error.data = { message: 'Request Timed Out' }
      }
      if (axios.isCancel(error)) {
        error.data = { message: 'Query Cancelled' }
      } else if (
        _get(error, 'response.data.reference_id') === '1.1.430' ||
        _get(error, 'response.data.reference_id') === '1.1.431'
      ) {
        return fetchSuggestions({ query, domain, apiKey, token })
      }
      return Promise.reject(_get(error, 'response.data'))
    })
}

export const runQuery = ({
  query,
  debug,
  test,
  enableQueryValidation,
  domain,
  apiKey,
  token,
  source,
} = {}) => {
  if (enableQueryValidation) {
    return runSafetyNet({
      text: query,
      domain,
      apiKey,
      token,
    })
      .then((response) => {
        if (failedValidation(response)) {
          const newResponse = transformSafetyNetResponse(response)
          return Promise.resolve(newResponse)
        }
        return runQueryOnly({
          query,
          debug,
          test,
          domain,
          apiKey,
          token,
          source,
        })
      })
      .catch((error) => {
        console.error(error)
        return Promise.reject(error)
      })
  }

  return runQueryOnly({
    query,
    debug,
    test,
    token,
    domain,
    apiKey,
    source,
  })
}

export const runSafetyNet = ({ text, domain, apiKey, token }) => {
  const axiosInstance = axios.create({})

  const url = `${domain}/autoql/api/v1/query/validate?text=${encodeURIComponent(
    text
  )}&key=${apiKey}`

  const config = {}
  if (token) {
    config.headers = {
      Authorization: `Bearer ${token}`,
    }
  }

  return axiosInstance
    .get(url, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const runDrilldown = ({
  queryID,
  data,
  debug,
  test,
  domain,
  apiKey,
  token,
} = {}) => {
  const axiosInstance = axios.create({})

  const requestData = {
    translation: debug ? 'include' : 'exclude',
    columns: data,
    test,
  }

  const config = {}
  if (token) {
    config.headers = {
      Authorization: `Bearer ${token}`,
    }
  }

  const url = `${domain}/autoql/api/v1/query/${queryID}/drilldown?key=${apiKey}`

  return axiosInstance
    .post(url, requestData, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const fetchAutocomplete = ({
  suggestion,
  domain,
  apiKey,
  token,
} = {}) => {
  // Do not run if text is blank
  if (!suggestion || !suggestion.trim()) {
    return
  }

  const axiosInstance = axios.create({})

  const url = `${domain}/autoql/api/v1/query/autocomplete?text=${encodeURIComponent(
    suggestion
  )}&key=${apiKey}`

  const config = {}
  if (token) {
    config.headers = {
      Authorization: `Bearer ${token}`,
    }
  }

  return axiosInstance
    .get(url, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const setColumnVisibility = ({
  apiKey,
  token,
  domain,
  columns,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query/column-visibility?key=${apiKey}`
  const data = { columns }
  const config = {}
  if (token) {
    config.headers = {
      Authorization: `Bearer ${token}`,
    }
  }

  const axiosInstance = axios.create({})
  return axiosInstance
    .put(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const fetchQueryTips = ({
  keywords,
  pageSize,
  pageNumber,
  domain,
  apiKey,
  token,
  skipSafetyNet,
} = {}) => {
  const commaSeparatedKeywords = keywords ? keywords.split(' ') : []
  const queryTipsUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${commaSeparatedKeywords}&page_size=${pageSize}&page=${pageNumber}`

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!skipSafetyNet) {
    return runSafetyNet({
      text: keywords,
      domain,
      apiKey,
      token,
    })
      .then((safetyNetResponse) => {
        if (
          _get(safetyNetResponse, 'data.full_suggestion.length') > 0 ||
          _get(safetyNetResponse, 'data.data.replacements.length') > 0
        ) {
          const newResponse = transformSafetyNetResponse(safetyNetResponse)
          return Promise.resolve(newResponse)
        }
        return axiosInstance
          .get(queryTipsUrl)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
      .catch(() => {
        return axiosInstance
          .get(queryTipsUrl)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
  }

  return axiosInstance
    .get(queryTipsUrl)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const fetchSuggestions = ({ query, domain, apiKey, token } = {}) => {
  const commaSeparatedKeywords = query ? query.split(' ') : []
  const relatedQueriesUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${commaSeparatedKeywords}&scope=narrow`

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return axiosInstance
    .get(relatedQueriesUrl)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const reportProblem = ({
  message,
  queryId,
  domain,
  apiKey,
  token,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query/${queryId}?key=${apiKey}`

  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = {
    is_correct: false,
  }

  if (message) {
    data.message = message
  }

  return axiosInstance
    .put(url, data)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}
