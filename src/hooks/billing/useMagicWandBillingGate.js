import { useBillingCustomerKey } from './useBillingCustomerKey'
import { useBillingUsage } from './useBillingUsage'

export const useMagicWandBillingGate = ({ authentication, enabled } = {}) => {
  const { billingCustomerKey } = useBillingCustomerKey({
    authentication: enabled ? authentication : undefined,
  })

  const { data, state } = useBillingUsage({
    authentication: enabled ? authentication : undefined,
    billingCustomerKey: enabled ? billingCustomerKey : null,
  })

  const quotaStatus = enabled && state === 'success' ? data?.quota_status : undefined

  return { quotaStatus }
}
