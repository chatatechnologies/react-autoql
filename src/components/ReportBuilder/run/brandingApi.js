import axios from 'axios'
import { getAuthentication } from 'autoql-fe-utils'
import { brandingFromApi, brandingToApi } from '../model/branding'

// The organisation's branding, kept by AutoQL: anyone reads it; saving takes the management API, which an
// organisation's admins reach with the grant their app passes for reports. The organisation is the one the
// token's project belongs to. Each token's answer is kept for the page's life, so builders opened one after
// another ask once.

export const BRANDING_PATH = '/autoql/api/v1/reports/branding'
export const BRANDING_MANAGEMENT_PATH = '/autoql/management/api/v1/reports/branding'

const cache = new Map() // domain|key|token → Promise of the branding

const requestOf = (authentication, path) => {
  const { domain, apiKey, token } = getAuthentication(authentication)
  if (!domain || !token) return null
  return {
    url: `${domain}${path}${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''}`,
    config: { headers: { Authorization: `Bearer ${token}` } },
    key: `${domain}|${apiKey}|${token}`,
  }
}

const notSignedIn = () => new Error('No AutoQL authentication to read the branding with')

// The branding as AutoQL has it ({} until anything is set). Rejects where it can't be read — an AutoQL without
// branding answers 404 — and a rejection isn't kept, so the next builder asks again.
export const fetchBranding = ({ authentication }) => {
  const request = requestOf(authentication, BRANDING_PATH)
  if (!request) return Promise.reject(notSignedIn())
  if (!cache.has(request.key)) {
    const pending = axios.get(request.url, request.config).then((response) => brandingFromApi(response?.data?.data))
    pending.catch(() => cache.delete(request.key))
    cache.set(request.key, pending)
  }
  return cache.get(request.key)
}

// Replaces the organisation's branding with this, resolving with what AutoQL stored.
export const saveBranding = async ({ authentication, branding }) => {
  const request = requestOf(authentication, BRANDING_MANAGEMENT_PATH)
  if (!request) throw notSignedIn()
  const response = await axios.put(request.url, brandingToApi(branding), request.config)
  const saved = brandingFromApi(response?.data?.data)
  cache.set(request.key, Promise.resolve(saved))
  return saved
}

// For tests.
export const clearBrandingCache = () => cache.clear()
