export default class AjaxCache {
  constructor() {
    // only track in-flight requests
    this._inFlight = new Map()
  }

  // Persistent-cache methods are no-ops so callers fall back to fetching
  get() {
    return undefined
  }

  set() {
    return undefined
  }

  delete() {
    return false
  }

  has() {
    return false
  }

  keys() {
    return [].values()
  }

  get size() {
    return 0
  }

  // in-flight helpers
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
