import axios from 'axios'
import _get from 'lodash.get'

var autoCompleteCall = null

const formatSourceString = (sourceArray) => {
  try {
    const sourceString = sourceArray.join('.')
    return sourceString
  } catch (error) {
    return undefined
  }
}

const transformUserSelection = (userSelection) => {
  if (!userSelection || !userSelection.length) {
    return undefined
  }

  const finalUserSelection = []

  userSelection.forEach((suggestion) => {
    if (!suggestion.hidden) {
      finalUserSelection.push({
        start: suggestion.start,
        end: suggestion.end,
        value: suggestion.text,
        value_label: suggestion.value_label || 'ORIGINAL_TEXT',
        canonical: suggestion.canonical || 'ORIGINAL_TEXT',
      })
    }
  })

  return finalUserSelection
}

const failedValidation = (response) => {
  return _get(response, 'data.data.replacements.length') > 0
}

export const fetchSuggestions = ({
  query,
  queryId,
  domain,
  apiKey,
  token,
} = {}) => {
  if (!query) {
    return Promise.reject(new Error('No query supplied'))
  }

  if (!domain || !token || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const commaSeparatedKeywords =
    typeof query === 'string' ? query.split(' ') : []
  const relatedQueriesUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${commaSeparatedKeywords}&scope=narrow&query_id=${queryId}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .get(relatedQueriesUrl, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response')))
}

export const runQueryOnly = ({
  query,
  userSelection,
  debug,
  test,
  domain,
  apiKey,
  token,
  source,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query?key=${apiKey}`
  const finalUserSelection = transformUserSelection(userSelection)

  const data = {
    text: query,
    source: formatSourceString(source),
    translation: debug ? 'include' : 'exclude',
    user_selection: finalUserSelection,
    test,
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

  axios.interceptors.response.use(
    (response) => {
      return response
    },
    function(error) {
      return Promise.reject(error)
    }
  )

  return axios
    .post(url, data, config)
    .then((response) => {
      if (response.data && typeof response.data === 'string') {
        // There was an error parsing the json
        // queryCall = null
        throw new Error('Parse error')
      }

      return Promise.resolve(response)
    })
    .catch((error) => {
      if (!('toJSON' in Error.prototype))
        Object.defineProperty(Error.prototype, 'toJSON', {
          value: function() {
            var alt = {}

            Object.getOwnPropertyNames(this).forEach(function(key) {
              alt[key] = this[key]
            }, this)

            return alt
          },
          configurable: true,
          writable: true,
        })
      const str = JSON.stringify(error)
      if (error.message === 'Parse error') {
        return Promise.reject({ error: 'Parse error' })
      }
      if (error.response === 401 || !_get(error, 'response.data')) {
        return Promise.reject({ error: 'Unauthenticated' })
      }
      // if (axios.isCancel(error)) {
      //   return Promise.reject({ error: 'Query Cancelled' })
      // }
      if (
        _get(error, 'response.data.reference_id') === '1.1.430' ||
        _get(error, 'response.data.reference_id') === '1.1.431'
      ) {
        const queryId = _get(error, 'response.data.data.query_id')
        return fetchSuggestions({ query, queryId, domain, apiKey, token })
      }
      return Promise.reject(_get(error, 'response'))
    })
}

export const runQuery = ({
  query,
  userSelection,
  debug,
  test,
  enableQueryValidation,
  domain,
  apiKey,
  token,
  source,
  skipQueryValidation,
} = {}) => {
  if (enableQueryValidation && !skipQueryValidation) {
    return runQueryValidation({
      text: query,
      domain,
      apiKey,
      token,
    })
      .then((response) => {
        if (failedValidation(response)) {
          return Promise.resolve(response)
        }
        return runQueryOnly({
          query,
          userSelection,
          debug,
          test,
          domain,
          apiKey,
          token,
          source,
        })
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  }

  return runQueryOnly({
    query,
    userSelection,
    debug,
    test,
    token,
    domain,
    apiKey,
    source,
  })
}

export const runQueryValidation = ({ text, domain, apiKey, token } = {}) => {
  if (!text) {
    return Promise.reject(new Error('No text supplied'))
  }

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/validate?text=${encodeURIComponent(
    text
  )}&key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
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
  if (!queryID) {
    return Promise.reject(new Error('Query ID not supplied'))
  }

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const requestData = {
    translation: debug ? 'include' : 'exclude',
    columns: data,
    test,
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const url = `${domain}/autoql/api/v1/query/${queryID}/drilldown?key=${apiKey}`

  return axios
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
  if (!suggestion || !suggestion.trim()) {
    return Promise.reject(new Error('No query supplied'))
  }

  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/autocomplete?text=${encodeURIComponent(
    suggestion
  )}&key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
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

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .put(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const sendSuggestion = ({
  queryId,
  suggestion,
  apiKey,
  domain,
  token,
}) => {
  const url = `${domain}/autoql/api/v1/query/${queryId}/suggestions?key=${apiKey}`
  const data = { suggestion }

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
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
  skipQueryValidation,
} = {}) => {
  const commaSeparatedKeywords = keywords ? keywords.split(' ') : []
  const queryTipsUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${commaSeparatedKeywords}&page_size=${pageSize}&page=${pageNumber}`

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  if (!skipQueryValidation) {
    return runQueryValidation({
      text: keywords,
      domain,
      apiKey,
      token,
    })
      .then((queryValidationResponse) => {
        if (
          _get(queryValidationResponse, 'data.data.replacements.length') > 0
        ) {
          return Promise.resolve(queryValidationResponse)
        }
        return axios
          .get(queryTipsUrl, config)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
      .catch(() => {
        return axios
          .get(queryTipsUrl, config)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
  }

  return axios
    .get(queryTipsUrl, config)
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
  if (!queryId) {
    return Promise.reject(new Error('No query ID supplied'))
  }

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/${queryId}?key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const data = {
    is_correct: false,
    message,
  }

  return axios
    .put(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}
