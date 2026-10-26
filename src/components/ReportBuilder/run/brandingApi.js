import axios from 'axios'
import { getAuthentication, parseJwt } from 'autoql-fe-utils'
import { brandingFromApi, brandingToApi } from '../model/branding'

// The organisation's branding, kept by AutoQL: anyone reads it; saving takes the management API, which an
// organisation's admins reach with the grant their app passes for reports. The organisation is the one the
// token's project belongs to. Each project's answer is kept for the page's life, so builders opened one after
// another ask once, whatever tokens the host mints meanwhile.

export const BRANDING_PATH = '/autoql/api/v1/reports/branding'
export const BRANDING_MANAGEMENT_PATH = '/autoql/management/api/v1/reports/branding'

// A branding can carry its fonts and logo, so only the last few data sources' are kept.
const CACHE_MAX = 4
const cache = new Map() // domain|key|project → Promise of the branding, the latest used last

// The token's project, or the token itself where it names none.
const projectOf = (token) => {
  try {
    const project = parseJwt(token)?.project_id
    return project === undefined || project === null || project === '' ? token : String(project)
  } catch (error) {
    return token
  }
}

const requestOf = (authentication, path) => {
  const { domain, apiKey, token } = getAuthentication(authentication)
  if (!domain || !token) {
    return null
  }
  return {
    url: `${domain}${path}${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`,
    config: { headers: { Authorization: `Bearer ${token}` } },
    key: `${domain}|${apiKey}|${projectOf(token)}`,
  }
}

const remember = (key, pending) => {
  cache.delete(key)
  cache.set(key, pending)
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value)
  }
}

const notSignedIn = () => new Error('No AutoQL authentication to read the branding with')

// The branding as AutoQL has it ({} until anything is set). Rejects where it can't be read — an AutoQL without
// branding answers 404 — and a rejection isn't kept, so the next builder asks again.
export const fetchBranding = ({ authentication }) => {
  const request = requestOf(authentication, BRANDING_PATH)
  if (!request) {
    return Promise.reject(notSignedIn())
  }
  const kept = cache.get(request.key)
  if (kept) {
    remember(request.key, kept)
    return kept
  }
  const pending = axios.get(request.url, request.config).then((response) => brandingFromApi(response?.data?.data))
  pending.catch(() => {
    if (cache.get(request.key) === pending) {
      cache.delete(request.key)
    }
  })
  remember(request.key, pending)
  return pending
}

// Replaces the organisation's branding with this, resolving with what AutoQL stored.
export const saveBranding = async ({ authentication, branding }) => {
  const request = requestOf(authentication, BRANDING_MANAGEMENT_PATH)
  if (!request) {
    throw notSignedIn()
  }
  const response = await axios.put(request.url, brandingToApi(branding), request.config)
  const saved = brandingFromApi(response?.data?.data)
  remember(request.key, Promise.resolve(saved))
  return saved
}

// For tests.
export const clearBrandingCache = () => cache.clear()
