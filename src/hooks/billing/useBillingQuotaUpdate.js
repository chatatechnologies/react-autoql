import { useEffect, useRef, useState } from 'react'
import { getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'
import { refreshBillingUsage } from './billingUsageRefreshBus'

export const useBillingQuotaUpdate = ({ authentication = {}, billingCustomerKey } = {}) => {
  const [isSaving, setIsSaving] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  const updateQuota = async (monthlyQuotaMicros) => {
    if (!billingCustomerKey) {
      throw new Error('Missing billing customer key')
    }
    if (!hasBillingAuthentication(authentication)) {
      throw new Error('Missing billing authentication')
    }
    if (!Number.isSafeInteger(monthlyQuotaMicros) || monthlyQuotaMicros < 0) {
      throw new Error('Monthly quota micros must be a non-negative safe integer')
    }

    setIsSaving(true)
    try {
      const config = getBillingRequestConfig(authentication)
      const response = await fetch(
        getBillingApiUrl(authentication, `billing-quotas/${encodeURIComponent(billingCustomerKey)}`),
        {
          ...config,
          method: 'PUT',
          headers: {
            ...config.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monthly_quota_micros: monthlyQuotaMicros }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to update billing quota')
      }

      const json = await response.json()
      const responseData = json?.data
      if (!responseData) {
        throw new Error('Billing quota update returned no data')
      }

      // A raised quota can immediately move an account off "at_or_over_quota" - let every
      // mounted gate re-check rather than waiting for a remount.
      refreshBillingUsage()

      return responseData
    } finally {
      if (isMounted.current) {
        setIsSaving(false)
      }
    }
  }

  return { isSaving, updateQuota }
}
