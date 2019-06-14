// import request from './request'
import axios from 'axios'

export const runQuery = (query, token) => {
  const queryString = query
  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return axiosInstance
    .get(
      `https://backend-staging.chata.ai/api/v1/query?q=${queryString}&project=7077&unified_query_id=12344`
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
      `https://backend-staging.chata.ai/api/v1/query/drilldown?&project=7077&unified_query_id=12344`,
      data
    )
    .then(response => {
      return Promise.resolve(response)
    })
    .catch(error => {
      return Promise.reject()
    })
}
