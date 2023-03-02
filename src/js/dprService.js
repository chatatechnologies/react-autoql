import axios from 'axios'
import { v4 as uuid } from 'uuid'

export const dprQuery = ({ query, dprKey, dprDomain, sessionId }) => {
  const domain = dprDomain || 'https://autoae-api-staging.chata.io'
  const url = `${domain}/api/v1/query?key=${dprKey}`
  const body = { query }

  if (!sessionId) {
    console.warn('No session ID was supplied to DPR. Using a randomly generated UUID instead')
  }

  const config = {
    headers: {
      ['AutoAE-Referer-URL']: window.location.origin,
      ['AutoAE-Session-ID']: sessionId || uuid(),
    },
  }

  return axios.post(url, body, config)
}
