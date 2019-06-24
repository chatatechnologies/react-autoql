// import request from './request'
import axios from 'axios'
import uuid from 'uuid'

export const runQueryOnly = (query, token) => {
  const queryString = query
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return axiosInstance
    .get(
      `https://backend-staging.chata.ai/api/v1/query?q=${queryString}&project=7077&unified_query_id=${uuid.v4()}`
    )
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject()
    })
}

export const runQuery = (query, token, useSafetyNet, skipSafetyNetCallback) => {
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  if (useSafetyNet) {
    return axiosInstance
      .get(
        `https://backend-staging.chata.ai/api/v1/safetynet?q=${encodeURIComponent(
          query
        )}&projectId=7077&unified_query_id=${uuid.v4()}`
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
        return runQueryOnly(query, token)
      })
      .catch(() => {
        return runQueryOnly(query, token)
      })
  }

  return runQueryOnly(query, token)
}

export const runDrilldown = (data, token) => {
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  return axiosInstance
    .post(
      `https://backend-staging.chata.ai/api/v1/query/drilldown?&project=7077&unified_query_id=${uuid.v4()}`,
      data
    )
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject()
    })
}

export const fetchSuggestions = (suggestion, token) => {
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const theURL = `https://backend-staging.chata.ai/api/v1/autocomplete?q=${encodeURIComponent(
    suggestion
  )}&projectid=7077`

  return axiosInstance
    .get(theURL)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
