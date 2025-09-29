export class TableLifecycleManager {
  constructor(component) {
    this.component = component
    this.stateToSet = {}
  }

  updateSummaryAndRefresh(props = this.component.props, forceUpdate = true) {
    this.component.summaryStats = this.component.summaryStatsCalculator.calculate(props)

    if (forceUpdate && this.component._isMounted) {
      this.component.forceUpdate()
    }
  }

  refreshTableState(props = this.component.props) {
    this.component.setHeaderInputEventListeners()
    this.updateSummaryAndRefresh(props)
  }

  safeSetState(state) {
    if (this.component._isMounted) {
      this.component.setState(state)
    }
  }

  safeForceUpdate() {
    if (this.component._isMounted) {
      this.component.forceUpdate()
    }
  }

  debounceSetState(state, setStateFn) {
    this.stateToSet = {
      ...this.stateToSet,
      ...state,
    }

    this.component.timeoutManager.setNamedTimeout(
      'setState',
      () => {
        if (this.component._isMounted) {
          setStateFn(this.stateToSet)
          this.stateToSet = {}
        }
      },
      50,
    )
  }

  safeForceUpdate() {
    if (this.component._isMounted) {
      this.component.forceUpdate()
    }
  }
}

export class TimeoutManager {
  constructor() {
    this.namedTimeouts = new Map()
    this.tooltipTimeout = null
  }

  setTimeout(key, callback, delay) {
    const existing = this.namedTimeouts.get(key)
    if (existing) {
      clearTimeout(existing)
    }
    const timeoutId = setTimeout(callback, delay)
    this.namedTimeouts.set(key, timeoutId)
    return timeoutId
  }

  scheduleTooltipRefresh(setHeaderInputEventListeners, delay = 10) {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout)
    }
    this.tooltipTimeout = setTimeout(() => setHeaderInputEventListeners(), delay)
  }

  clearAll() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout)
    }
    this.namedTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    this.namedTimeouts.clear()
  }
}
