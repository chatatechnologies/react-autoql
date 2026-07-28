import { useEffect, useState } from 'react'
import { dedupeBillingRequest, getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

export const useBillingCustomerKey = (options = {}) => {
  const authentication = options.authentication ?? {}
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
        const cacheKey = `customer-key:${authentication.domain}:${authentication.apiKey}:${authentication.token}`
        const { status, ok, data: responseData } = await dedupeBillingRequest(cacheKey, async () => {
          const response = await fetch(
            getBillingApiUrl(authentication, 'billing/customer-keys'),
            getBillingRequestConfig(authentication),
          )

          if (response.status === 404 || !response.ok) {
            return { status: response.status, ok: response.ok, data: null }
          }

          const json = await response.json()
          return { status: response.status, ok: response.ok, data: json?.data ?? null }
        })

        if (!isActive) {
          return
        }

        if (status === 404) {
          setData(null)
          setState('missing_customer')
          return
        }

        if (!ok) {
          setData(null)
          setState('error')
          return
        }

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
