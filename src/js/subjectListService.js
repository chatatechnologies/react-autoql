import { fetchSubjectList, getAuthentication } from 'autoql-fe-utils'

// The subject list is the same for everyone on the same credentials and changes
// rarely, but every thread asks for it: a session host mounts one ChatContent and
// one QueryInput per tab, so an eight-tab drawer fired eight identical requests -
// sixteen, counting the quick topics. Requests in flight are shared and the result
// is held briefly, so opening tabs costs nothing after the first.
const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map()

const getCacheKey = ({ domain, apiKey, token, valueLabel }) => `${domain}|${apiKey}|${token}|${valueLabel ?? ''}`

/**
 * fetchSubjectList with in-flight sharing and a short-lived result cache. Rejections
 * are never cached, so a failed fetch is retried by the next caller.
 */
export const fetchSubjectListCached = (authentication, { valueLabel } = {}) => {
  const { domain, apiKey, token } = getAuthentication(authentication)
  const key = getCacheKey({ domain, apiKey, token, valueLabel })
  const cached = cache.get(key)

  if (cached && (cached.pending || Date.now() - cached.fetchedAt < CACHE_TTL_MS)) {
    return cached.promise
  }

  const entry = { pending: true }

  entry.promise = fetchSubjectList({ domain, apiKey, token, valueLabel })
    .then((subjects) => {
      entry.pending = false
      entry.fetchedAt = Date.now()
      return subjects
    })
    .catch((error) => {
      if (cache.get(key) === entry) {
        cache.delete(key)
      }
      return Promise.reject(error)
    })

  cache.set(key, entry)

  return entry.promise
}

export const clearSubjectListCache = () => cache.clear()
