import { useEffect, useState } from 'react'
import { getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

export const useBillingUsage = ({ authentication = {}, billingCustomerKey, refreshKey = 0 } = {}) => {
  const [data, setData] = useState(null)
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!billingCustomerKey || !hasBillingAuthentication(authentication)) {
      setData(null)
      setState('idle')
      return undefined
    }

    let isActive = true

    const fetchUsage = async () => {
      setState('loading')

      try {
        const response = await fetch(
          getBillingApiUrl(authentication, `billing-usage/${encodeURIComponent(billingCustomerKey)}/current-period`),
          getBillingRequestConfig(authentication),
        )

        if (!isActive) {
          return
        }

        if (response.status === 404) {
          setData(null)
          setState('missing_customer')
          return
        }

        if (response.status >= 500) {
          setData(null)
          setState('unavailable')
          return
        }

        if (!response.ok) {
          setData(null)
          setState('error')
          return
        }

        const json = await response.json()
        if (!isActive) {
          return
        }

        const responseData = json?.data ?? null
        if (!responseData) {
          setData(null)
          setState('error')
          return
        }

        setData(responseData)
        setState('success')
      } catch {
        if (!isActive) {
          return
        }

        setData(null)
        setState('unavailable')
      }
    }

    fetchUsage()

    return () => {
      isActive = false
    }
  }, [authentication.apiKey, authentication.domain, authentication.token, billingCustomerKey, refreshKey])

  return { data, state }
}
