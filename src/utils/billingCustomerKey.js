const STORAGE_PREFIX = 'billingCustomerKey'

const getStorageKey = (apiKey) => `${STORAGE_PREFIX}:${apiKey || 'default'}`

export const getStoredBillingCustomerKey = (apiKey) => {
  try {
    return localStorage.getItem(getStorageKey(apiKey))
  } catch {
    return null
  }
}

export const setStoredBillingCustomerKey = (billingCustomerKey, apiKey) => {
  try {
    localStorage.setItem(getStorageKey(apiKey), billingCustomerKey)
  } catch {
    // Storage can be unavailable in privacy modes and non-browser environments.
  }
}

export const clearStoredBillingCustomerKey = (apiKey) => {
  try {
    localStorage.removeItem(getStorageKey(apiKey))
  } catch {
    // Storage can be unavailable in privacy modes and non-browser environments.
  }
}
