import { useEffect, useState } from 'react'
import { getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

export const useBillingCustomerKey = ({ authentication = {} } = {}) => {
  const [data, setData] = useState(null)
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!hasBillingAuthentication(authentication)) {
      setData(null)
      setState('idle')
      return undefined
    }

    let isActive = true

    const fetchBillingCustomerKey = async () => {
      setState('loading')

      try {
        const response = await fetch(
          getBillingApiUrl(authentication, 'billing/customer-keys'),
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
        if (!responseData?.billing_customer_key) {
          setData(null)
          setState('missing_customer')
          return
        }

        setData(responseData)
        setState('success')
      } catch {
        if (!isActive) {
          return
        }

        setData(null)
        setState('error')
      }
    }

    fetchBillingCustomerKey()

    return () => {
      isActive = false
    }
  }, [authentication.apiKey, authentication.domain, authentication.token])

  return {
    billingCustomerKey: data?.billing_customer_key ?? null,
    data,
    scope: data?.scope ?? null,
    state,
  }
}
