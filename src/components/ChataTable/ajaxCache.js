export default class AjaxCache {
  constructor({ maxEntries = 50, ttl = 1000 * 60 * 10 } = {}) {
    // Parameters for future eviction policies (LRU, TTL-based)
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
    return entry.value
  }

  set(key, value) {
    const expiresAt = this._ttl ? Date.now() + this._ttl : undefined
    this._cache.set(key, { value, expiresAt })

    // Evict oldest entries when over limit
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
