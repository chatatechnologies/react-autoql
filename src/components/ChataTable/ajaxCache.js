export default class AjaxCache {
  constructor({ maxEntries = 50, ttl = 1000 * 60 * 10 } = {}) {
    // Parameters for future eviction policies (LRU, TTL-based)
    this._cache = new Map()
    this._inFlight = new Map()
  }

  get(key) {
    return this._cache.get(key)
  }

  set(key, value) {
    this._cache.set(key, value)
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
