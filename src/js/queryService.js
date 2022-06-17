import axios from 'axios'
import _get from 'lodash.get'
import { constructRTArray } from './reverseTranslationHelpers'

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

  const relatedQueriesUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${encodeURIComponent(
    query
  )}&scope=narrow&query_id=${queryId}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .get(relatedQueriesUrl, config)
    .then((response) => {
      return Promise.resolve(response)
    })
    .catch((error) => Promise.reject(_get(error, 'response')))
}

export const runSubQuery = ({
  queryId,
  domain,
  apiKey,
  token,
  debug,
  page,
  sorters,
  filters,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query/${queryId}/subquery?key=${apiKey}&page=${page}`

  const data = {
    translation: debug ? 'include' : 'exclude',
    orders: sorters,
    filters,
  }

  if (!queryId) {
    return Promise.reject({ error: 'No query ID supplied' })
  }

  if (!apiKey || !domain || !token) {
    return Promise.reject({ error: 'Unauthenticated' })
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .post(url, data, config)
    .then((response) => {
      if (response.data && typeof response.data === 'string') {
        throw new Error('Parse error')
      }

      return Promise.resolve({ ..._get(response, 'data.data', {}), page })
    })
    .catch((error) => {
      if (error.message === 'Parse error') {
        return Promise.reject({ error: 'Parse error' })
      }
      if (error.response === 401 || !_get(error, 'response.data')) {
        return Promise.reject({ error: 'Unauthenticated' })
      }
      return Promise.reject(_get(error, 'response'))
    })
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
  filters,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query?key=${apiKey}`
  const finalUserSelection = transformUserSelection(userSelection)

  const data = {
    text: query,
    source: formatSourceString(source),
    translation: debug ? 'include' : 'exclude',
    user_selection: finalUserSelection,
    test,
    session_filter_locks: filters,
  }

  if (!query || !query.trim()) {
    console.error('No query supplied in request')
    return Promise.reject({ error: 'No query supplied' })
  }

  if (!apiKey || !domain || !token) {
    console.error('authentication invalid for request')
    return Promise.reject({ error: 'Unauthenticated' })
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .post(url, data, config)
    .then((response) => {
      if (response.data && typeof response.data === 'string') {
        // There was an error parsing the json
        throw new Error('Parse error')
      }

      const reverseTranslation = constructRTArray(response)
      if (reverseTranslation) {
        response.data.data.reverse_translation = reverseTranslation
      }

      return Promise.resolve(response)
    })
    .catch((error) => {
      console.error(error)
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

export const runQuery = (params) => {
  if (params?.enableQueryValidation && !params?.skipQueryValidation) {
    return runQueryValidation({
      text: params?.query,
      domain: params?.domain,
      apiKey: params?.apiKey,
      token: params?.token,
    })
      .then((response) => {
        if (failedValidation(response)) {
          return Promise.resolve(response)
        }
        return runQueryOnly(params)
      })
      .catch((error) => {
        console.error(error)
        return Promise.reject(error)
      })
  }

  return runQueryOnly(params)
}

export const exportCSV = ({
  queryId,
  domain,
  apiKey,
  token,
  csvProgressCallback,
} = {}) => {
  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }
  const url = `${domain}/autoql/api/v1/query/${queryId}/export?key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseType: 'blob',
    onDownloadProgress: (progressEvent) => {
      if (csvProgressCallback) {
        let percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        csvProgressCallback(percentCompleted)
      }
    },
  }

  return axios
    .post(url, {}, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response')))
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
    .catch((error) => Promise.reject(_get(error, 'response')))
}

export const runDrilldown = ({
  queryID,
  groupBys,
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
    columns: groupBys,
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
    .then((response) => {
      const reverseTranslation = constructRTArray(response)
      if (reverseTranslation) {
        response.data.data.reverse_translation = reverseTranslation
      }

      return Promise.resolve(response)
    })
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}
export const fetchTopics = ({ domain, token, apiKey } = {}) => {
  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }
  const url = `${domain}/autoql/api/v1/topic-set?key=${apiKey}`
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

export const fetchVLAutocomplete = ({
  suggestion,
  domain,
  token,
  apiKey,
} = {}) => {
  if (!suggestion || !suggestion.trim()) {
    return Promise.reject(new Error('No query supplied'))
  }

  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/vlautocomplete?text=${encodeURIComponent(
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

export const fetchFilters = ({ apiKey, token, domain } = {}) => {
  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/filter-locking?key=${apiKey}`

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

export const setFilters = ({ apiKey, token, domain, filters } = {}) => {
  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  if (!filters?.length) {
    return Promise.reject(new Error('No filters provided'))
  }

  const url = `${domain}/autoql/api/v1/query/filter-locking?key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const data = { columns: filters }

  return axios
    .put(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}

export const unsetFilterFromAPI = ({ apiKey, token, domain, filter } = {}) => {
  if (!domain || !apiKey || !token) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/filter-locking/${filter.id}?key=${apiKey}`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  return axios
    .delete(url, config, {})
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
  const queryTipsUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${encodeURIComponent(
    commaSeparatedKeywords
  )}&page_size=${pageSize}&page=${pageNumber}`

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
