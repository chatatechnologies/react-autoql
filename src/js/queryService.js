import axios from 'axios'
import _get from 'lodash.get'
import { responseErrors } from './errorMessages'
import responseSamples from '../../test/responseTestCases'

const formatErrorResponse = (error) => {
  if (error?.message === responseErrors.CANCELLED) {
    return Promise.reject({
      data: { message: responseErrors.CANCELLED },
    })
  }

  return Promise.reject(_get(error, 'response'))
}

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

export const isError500Type = (referenceId) => {
  try {
    const parsedReferenceId = referenceId?.split('.')
    const errorCode = Number(parsedReferenceId?.[2])

    if (errorCode >= 500 && errorCode < 600) {
      return true
    }
  } catch (error) {
    console.error(error)
  }

  return false
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
  cancelToken,
} = {}) => {
  if (!query) {
    return Promise.reject(new Error('No query supplied'))
  }

  if (!domain || !token || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  let relatedQueriesUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${encodeURIComponent(
    query
  )}&scope=narrow`

  if (queryId) {
    relatedQueriesUrl = `${relatedQueriesUrl}&query_id=${queryId}`
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cancelToken,
  }

  return axios
    .get(relatedQueriesUrl, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response')))
}

export const runQueryNewPage = ({
  queryId,
  domain,
  apiKey,
  token,
  page,
  cancelToken,
} = {}) => {
  const url = `${domain}/autoql/api/v1/query/${queryId}/page?key=${apiKey}&page=${page}`

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
    cancelToken,
  }

  return axios
    .post(url, {}, config)
    .then((response) => {
      if (response.data && typeof response.data === 'string') {
        throw new Error('Parse error')
      }

      return Promise.resolve({ ..._get(response, 'data.data', {}), page })
    })
    .catch((error) => {
      if (error?.message === responseErrors.CANCELLED) {
        return Promise.reject({
          data: { message: responseErrors.CANCELLED },
        })
      }
      if (error.message === 'Parse error') {
        return Promise.reject({ error: 'Parse error' })
      }
      if (error.response === 401 || !_get(error, 'response.data')) {
        return Promise.reject({ error: 'Unauthenticated' })
      }
      return Promise.reject(_get(error, 'response'))
    })
}

export const runQueryOnly = (params = {}) => {
  const {
    query,
    userSelection,
    debug,
    test,
    domain,
    apiKey,
    token,
    source,
    filters,
    orders,
    tableFilters,
    pageSize,
    cancelToken,
  } = params
  const url = `${domain}/autoql/api/v1/query?key=${apiKey}`
  const finalUserSelection = transformUserSelection(userSelection)

  const data = {
    text: query,
    source: formatSourceString(source),
    translation: debug ? 'include' : 'exclude',
    user_selection: finalUserSelection,
    test,
    session_filter_locks: filters,
    orders,
    filters: tableFilters,
    page_size: pageSize,
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
    cancelToken,
  }

  return axios
    .post(url, data, config)
    .then((response) => {
      if (!response?.data?.data) {
        // JSON response is invalid
        throw new Error('Parse error')
      }

      return Promise.resolve(response)
    })
    .catch((error) => {
      if (error?.message === responseErrors.CANCELLED) {
        return Promise.reject({
          data: { message: responseErrors.CANCELLED },
        })
      }

      console.error(error)
      if (error?.message === 'Parse error') {
        return Promise.reject({ error: 'Parse error' })
      }
      if (error?.response === 401 || !error?.response?.data) {
        return Promise.reject({ error: 'Unauthenticated' })
      }
      const referenceId = error?.response?.data?.reference_id
      if (
        referenceId === '1.1.430' ||
        referenceId === '1.1.431' ||
        isError500Type(referenceId)
      ) {
        const queryId = error?.response?.data?.data?.query_id
        return fetchSuggestions({
          query,
          queryId,
          domain,
          apiKey,
          token,
          cancelToken,
        })
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
  orders,
  tableFilters,
  cancelToken,
} = {}) => {
  if (!queryID) {
    console.error('No query ID supplied to drilldown function')
    return Promise.reject(new Error('Query ID not supplied'))
  }

  if (!token || !domain || !apiKey) {
    console.error('Unauthenticated')
    return Promise.reject(new Error('Unauthenticated'))
  }

  const requestData = {
    translation: debug ? 'include' : 'exclude',
    columns: groupBys,
    filters: tableFilters,
    orders,
    test,
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cancelToken,
  }

  const url = `${domain}/autoql/api/v1/query/${queryID}/drilldown?key=${apiKey}`

  return axios
    .post(url, requestData, config)
    .then((response) => Promise.resolve(response))
    .catch(formatErrorResponse)
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
  cancelToken,
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
    cancelToken,
  }

  return axios
    .get(url, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => {
      if (error?.message === responseErrors.CANCELLED) {
        return Promise.reject({
          data: { message: responseErrors.CANCELLED },
        })
      }

      return Promise.reject(_get(error, 'response.data'))
    })
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

export const fetchExploreQueries = ({
  keywords,
  pageSize,
  pageNumber,
  domain,
  apiKey,
  token,
  skipQueryValidation,
} = {}) => {
  const commaSeparatedKeywords = keywords ? keywords.split(' ') : []
  const exploreQueriesUrl = `${domain}/autoql/api/v1/query/related-queries?key=${apiKey}&search=${encodeURIComponent(
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
          .get(exploreQueriesUrl, config)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
      .catch(() => {
        return axios
          .get(exploreQueriesUrl, config)
          .then((response) => Promise.resolve(response))
          .catch((error) => Promise.reject(_get(error, 'response.data')))
      })
  }

  return axios
    .get(exploreQueriesUrl, config)
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

export const fetchSubjectList = ({ domain, apiKey, token }) => {
  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/query/subjects?key=${apiKey}`

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

export const fetchDataPreview = ({ subject, domain, apiKey, token } = {}) => {
  if (!subject) {
    return Promise.reject(new Error('No subject supplied for data preview'))
  }

  return runQueryOnly({ query: subject, domain, apiKey, token })
    .then((response) => {
      if (response?.data?.data?.rows?.length) {
        response.data.data.rows = response.data.data.rows.slice(0, 5)
      }
      return Promise.resolve(response)
    })
    .catch((error) => Promise.reject(_get(error, 'response.data')))

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(responseSamples[9])
    }, 500)
  })

  if (!token || !domain || !apiKey) {
    return Promise.reject(new Error('Unauthenticated'))
  }

  const url = `${domain}/autoql/api/v1/data-preview`

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  const data = {
    subject,
  }

  return axios
    .post(url, data, config)
    .then((response) => Promise.resolve(response))
    .catch((error) => Promise.reject(_get(error, 'response.data')))
}
