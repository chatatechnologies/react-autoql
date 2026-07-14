import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

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
      const response = await axios.put(
        getBillingApiUrl(authentication, `billing-quotas/${encodeURIComponent(billingCustomerKey)}`),
        { monthly_quota_micros: monthlyQuotaMicros },
        {
          ...config,
          headers: {
            ...config.headers,
            'Content-Type': 'application/json',
          },
        },
      )

      const responseData = response?.data?.data
      if (!responseData) {
        throw new Error('Billing quota update returned no data')
      }

      return responseData
    } finally {
      if (isMounted.current) {
        setIsSaving(false)
      }
    }
  }

  return { isSaving, updateQuota }
}
