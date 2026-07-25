import { useBillingCustomerKey } from './useBillingCustomerKey'
import { useBillingUsage } from './useBillingUsage'

export const useMagicWandBillingGate = ({ authentication, enabled } = {}) => {
  const { billingCustomerKey, data: billingCustomerKeyData } = useBillingCustomerKey({
    authentication: enabled ? authentication : undefined,
  })

  const { data, state } = useBillingUsage({
    authentication: enabled ? authentication : undefined,
    billingCustomerKey: enabled ? billingCustomerKey : null,
  })

  const quotaStatus = enabled && state === 'success' ? data?.quota_status : undefined
  // Only trust this once we have a definite, resolved billing customer key — same
  // "never guess" rule as quotaStatus above.
  const billingExecutionType = enabled ? billingCustomerKeyData?.billing_execution_type : undefined

  return { quotaStatus, billingExecutionType }
}
