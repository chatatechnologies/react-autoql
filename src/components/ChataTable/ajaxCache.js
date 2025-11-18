export default class AjaxCache {
  constructor({ maxEntries = 50, ttl = 1000 * 60 * 10 } = {}) {
    // Simple in-memory LRU cache (Map order used to track recency).
    this._cache = new Map()
    this._inFlight = new Map()
    this._maxEntries = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : 50
    this._ttl = ttl
  }

  _isExpired(entry) {
    return entry && entry.expiresAt && Date.now() > entry.expiresAt
  }

  get(key) {
    const entry = this._cache.get(key)
    if (!entry) return undefined
    if (this._isExpired(entry)) {
      this._cache.delete(key)
      return undefined
    }

    // Bump entry to end of Map to mark it recently used.
    try {
      this._cache.delete(key)
      this._cache.set(key, entry)
    } catch (e) {
      // Map operations should not fail under normal circumstances; log for debugging so issues can be diagnosed instead of being silently swallowed; use warn to avoid noisy stack traces in production logs; eslint-disable-next-line no-console
      console.warn('AjaxCache: Failed to update entry recency', e)
    }

    return entry.value
  }

  set(key, value) {
    const expiresAt = this._ttl ? Date.now() + this._ttl : undefined

    // If key already exists, delete first so set() moves it to end
    if (this._cache.has(key)) {
      this._cache.delete(key)
    }
    this._cache.set(key, { value, expiresAt })

    // Evict least-recently-used entries (oldest Map entries) when over limit
    while (this._cache.size > this._maxEntries) {
      const oldestKey = this._cache.keys().next().value
      if (oldestKey === undefined) break
      this._cache.delete(oldestKey)
    }

    return value
  }

  delete(key) {
    return this._cache.delete(key)
  }

  has(key) {
    return this._cache.has(key)
  }

  keys() {
    return this._cache.keys()
  }

  get size() {
    return this._cache.size
  }

  hasInFlight(key) {
    return this._inFlight.has(key)
  }

  getInFlight(key) {
    return this._inFlight.get(key)
  }

  setInFlight(key, promise) {
    this._inFlight.set(key, promise)
  }

  deleteInFlight(key) {
    this._inFlight.delete(key)
  }
}
