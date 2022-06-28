import axios from 'axios'
import { v4 as uuid } from 'uuid'
const sessionId = uuid()

export const dprQuery = ({ query, dprKey, dprDomain }) => {
  const domain = dprDomain || 'https://autoae-api-staging.chata.io'
  const url = `${domain}/api/v1/query?key=${dprKey}`
  const body = { query }

  const config = {
    headers: {
      ['AutoAE-Referer-URL']: 'http://localhost:3000',
      ['AutoAE-Session-ID']: sessionId,
      ['AutoAE-Activity-ID']: sessionId,
    },
  }

  return axios.post(url, body, config)
}
