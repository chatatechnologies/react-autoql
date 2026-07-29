export const hasBillingAuthentication = (authentication = {}) =>
  Boolean(authentication.token && authentication.apiKey && authentication.domain)

export const getBillingRequestConfig = (authentication) => ({
  headers: {
    Authorization: `Bearer ${authentication.token}`,
  },
})

export const getBillingApiUrl = (authentication, path) =>
  `${authentication.domain}/autoql/api/v1/${path}?key=${encodeURIComponent(authentication.apiKey)}`

export const getBillingApiUrlWithParams = (authentication, path, params) => {
  const queryParams = { ...params, key: authentication.apiKey }
  const query = Object.keys(queryParams)
    .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(queryParams[name])}`)
    .join('&')

  return `${authentication.domain}/autoql/api/v1/${path}?${query}`
}

// Dedupes identical in-flight requests (e.g. many ChatMessage/OptionsToolbar instances all
// mounting at once and each independently fetching the same customer-key/usage data). Entries
// are removed as soon as the request settles, so this never serves stale data - it only
// collapses concurrent callers onto a single network request.
const inFlightBillingRequests = new Map()

export const dedupeBillingRequest = (key, factory) => {
  if (inFlightBillingRequests.has(key)) {
    return inFlightBillingRequests.get(key)
  }

  const promise = factory().finally(() => {
    if (inFlightBillingRequests.get(key) === promise) {
      inFlightBillingRequests.delete(key)
    }
  })

  inFlightBillingRequests.set(key, promise)
  return promise
}
