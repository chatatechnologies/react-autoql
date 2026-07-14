import { useEffect, useState } from 'react'
import axios from 'axios'
import { getBillingApiUrl, getBillingRequestConfig, getHttpStatus, hasBillingAuthentication } from './billingApi'

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
        const response = await axios.get(
          getBillingApiUrl(authentication, 'billing/customer-keys'),
          getBillingRequestConfig(authentication),
        )

        if (!isActive) {
          return
        }

        const responseData = response?.data?.data ?? null
        if (!responseData?.billing_customer_key) {
          setData(null)
          setState('missing_customer')
          return
        }

        setData(responseData)
        setState('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        setData(null)
        setState(getHttpStatus(error) === 404 ? 'missing_customer' : 'error')
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
