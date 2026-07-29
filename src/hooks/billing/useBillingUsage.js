import { useEffect, useState } from 'react'
import { dedupeBillingRequest, getBillingApiUrl, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

export const useBillingUsage = (options = {}) => {
  const authentication = options.authentication ?? {}
  const { billingCustomerKey, refreshKey = 0 } = options
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
        const cacheKey = `usage:${authentication.domain}:${authentication.apiKey}:${authentication.token}:${billingCustomerKey}:${refreshKey}`
        const { status, ok, data: responseData } = await dedupeBillingRequest(cacheKey, async () => {
          const response = await fetch(
            getBillingApiUrl(authentication, `billing-usage/${encodeURIComponent(billingCustomerKey)}/current-period`),
            getBillingRequestConfig(authentication),
          )

          if (response.status === 404 || response.status >= 500 || !response.ok) {
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

        if (status >= 500) {
          setData(null)
          setState('unavailable')
          return
        }

        if (!ok) {
          setData(null)
          setState('error')
          return
        }

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
