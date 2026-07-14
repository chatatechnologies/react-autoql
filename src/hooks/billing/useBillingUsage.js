import { useEffect, useState } from 'react'
import axios from 'axios'
import { getBillingApiUrl, getBillingRequestConfig, getHttpStatus, hasBillingAuthentication } from './billingApi'

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
        const response = await axios.get(
          getBillingApiUrl(authentication, `billing-usage/${encodeURIComponent(billingCustomerKey)}/current-period`),
          getBillingRequestConfig(authentication),
        )

        if (!isActive) {
          return
        }

        const responseData = response?.data?.data ?? null
        if (!responseData) {
          setData(null)
          setState('error')
          return
        }

        setData(responseData)
        setState('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        const status = getHttpStatus(error)
        setData(null)
        if (status === 404) {
          setState('missing_customer')
        } else if (!status || status >= 500) {
          setState('unavailable')
        } else {
          setState('error')
        }
      }
    }

    fetchUsage()

    return () => {
      isActive = false
    }
  }, [authentication.apiKey, authentication.domain, authentication.token, billingCustomerKey, refreshKey])

  return { data, state }
}
