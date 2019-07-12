// import request from './request'
import axios from 'axios'
import uuid from 'uuid'

export const runQueryOnly = (query, token, projectId = 1) => {
  const queryString = query
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  return axiosInstance
    .get(
      `https://backend-staging.chata.ai/api/v1/query?q=${queryString}&project=${projectId}&unified_query_id=${uuid.v4()}`
    )
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject()
    })
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
  if (useSafetyNet) {
    return axiosInstance
      .get(
        `https://backend-staging.chata.ai/api/v1/safetynet?q=${encodeURIComponent(
          query
        )}&projectId=${projectId}&unified_query_id=${uuid.v4()}`
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

  const url = `https://backend-staging.chata.ai/api/v1/query${
    projectId === 1 ? '/demo' : ''
  }/drilldown?&project=${projectId}&unified_query_id=${uuid.v4()}`
  return axiosInstance
    .post(url, data)
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject()
    })
}

export const fetchSuggestions = (suggestion, token, projectId = 1) => {
  const axiosInstance = axios.create({
    headers: {
      'Access-Control-Allow-Origin': '*',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })

  const theURL = `https://backend-staging.chata.ai/api/v1/autocomplete?q=${encodeURIComponent(
    suggestion
  )}&projectid=${projectId}`

  return axiosInstance
    .get(theURL)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
