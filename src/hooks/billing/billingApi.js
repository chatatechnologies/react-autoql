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
