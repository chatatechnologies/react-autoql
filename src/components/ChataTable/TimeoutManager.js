export class TimeoutManager {
  constructor() {
    this.namedTimeouts = new Map()
    this.tooltipTimeout = null
    this.clickListenerTimeout = null
    this.setDimensionsTimeout = null
    this.debounceTimeout = null
  }

  setNamedTimeout(key, callback, delay) {
    const existing = this.namedTimeouts.get(key)
    if (existing) {
      clearTimeout(existing)
    }
    const timeoutId = setTimeout(callback, delay)
    this.namedTimeouts.set(key, timeoutId)
    return timeoutId
  }

  clearNamedTimeout(key) {
    const timeoutId = this.namedTimeouts.get(key)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.namedTimeouts.delete(key)
    }
  }

  scheduleTooltipRefresh(callback, delay = 10) {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout)
    }
    this.tooltipTimeout = setTimeout(callback, delay)
  }

  clearAllTimeouts() {
    // Clear named timeouts
    this.namedTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    this.namedTimeouts.clear()

    // Clear specific timeouts
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout)
      this.tooltipTimeout = null
    }

    if (this.clickListenerTimeout) {
      clearTimeout(this.clickListenerTimeout)
      this.clickListenerTimeout = null
    }

    if (this.setDimensionsTimeout) {
      clearTimeout(this.setDimensionsTimeout)
      this.setDimensionsTimeout = null
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
  }

  setDebounceTimeout(callback, delay) {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }
    this.debounceTimeout = setTimeout(callback, delay)
  }
}
