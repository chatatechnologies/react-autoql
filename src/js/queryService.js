// import request from './request'
import axios from 'axios'
import uuid from 'uuid'

export const runQuery = (query, token) => {
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

  const theURL = `https://backend-staging.chata.ai/api/v1/autocomplete?apiId=1&q=${encodeURIComponent(
    suggestion
  )}&projectid=7077`

  return axiosInstance
    .get(theURL)
    .then(response => Promise.resolve(response))
    .catch(error => Promise.reject(error))
}
