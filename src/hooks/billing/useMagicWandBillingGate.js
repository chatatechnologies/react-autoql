import { useEffect, useState } from 'react'
import { useBillingCustomerKey } from './useBillingCustomerKey'
import { useBillingUsage } from './useBillingUsage'
import { getBillingUsageRefreshVersion, subscribeBillingUsageRefresh } from './billingUsageRefreshBus'

export const useMagicWandBillingGate = ({ authentication, enabled } = {}) => {
  // Bumped whenever refreshBillingUsage() is called (e.g. after a quota increase completes),
  // so a stale at_or_over_quota block doesn't persist until this component remounts.
  const [refreshKey, setRefreshKey] = useState(getBillingUsageRefreshVersion)

  useEffect(() => subscribeBillingUsageRefresh(setRefreshKey), [])

  const { billingCustomerKey, data: billingCustomerKeyData } = useBillingCustomerKey({
    authentication: enabled ? authentication : undefined,
  })

  const { data, state } = useBillingUsage({
    authentication: enabled ? authentication : undefined,
    billingCustomerKey: enabled ? billingCustomerKey : null,
    refreshKey,
  })

  const quotaStatus = enabled && state === 'success' ? data?.quota_status : undefined
  // Only trust this once we have a definite, resolved billing customer key — same
  // "never guess" rule as quotaStatus above.
  const billingExecutionType = enabled ? billingCustomerKeyData?.billing_execution_type : undefined

  return { quotaStatus, billingExecutionType }
}
