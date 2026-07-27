// Every mounted useMagicWandBillingGate instance fetches its own quota status independently
// (see dedupeBillingRequest in billingApi.js for why that's safe request-count-wise), so
// there's no single place that "owns" the data to refetch after a quota increase. This bus
// lets any instance broadcast "usage may have changed" and have every other instance pick up
// the new refreshKey on its next render, without needing to know about each other.
let refreshVersion = 0
const listeners = new Set()

export const getBillingUsageRefreshVersion = () => refreshVersion

export const refreshBillingUsage = () => {
  refreshVersion += 1
  listeners.forEach((listener) => listener(refreshVersion))
}

export const subscribeBillingUsageRefresh = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
