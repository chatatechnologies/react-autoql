import axios from 'axios'
import { getAuthentication } from 'autoql-fe-utils'

export const QUERY_TITLE_ENDPOINT = '/autoql/api/v1/query/title'

/**
 * A short display name for a Data Messenger session tab, generated from the first
 * query asked in it. Resolves to null when the response has no usable name, so the
 * caller keeps the title it already has.
 */
export const fetchQueryTitle = ({ query, authentication }) => {
  const { domain, apiKey, token } = getAuthentication(authentication)
  const url = `${domain}${QUERY_TITLE_ENDPOINT}${apiKey ? `?key=${apiKey}` : ''}`
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}

  return axios.post(url, { query }, config).then((response) => {
    const title = response?.data?.data?.tab_display_name
    return typeof title === 'string' && title.trim() ? title.trim().replace(/\s+/g, ' ') : null
  })
}
