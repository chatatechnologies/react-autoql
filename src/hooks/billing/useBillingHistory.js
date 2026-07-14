import { useEffect, useState } from 'react'
import axios from 'axios'
import { getDefaultBillingHistoryRange } from '../../utils/billingFormatting'
import {
  getBillingApiUrlWithParams,
  getBillingRequestConfig,
  getHttpStatus,
  hasBillingAuthentication,
} from './billingApi'

export const useBillingHistory = ({ authentication = {}, billingCustomerKey, from, to } = {}) => {
  const [items, setItems] = useState([])
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!billingCustomerKey || !hasBillingAuthentication(authentication)) {
      setItems([])
      setState('idle')
      return undefined
    }

    let isActive = true
    const defaultRange = getDefaultBillingHistoryRange()
    const resolvedFrom = from ?? defaultRange.from
    const resolvedTo = to ?? defaultRange.to

    const fetchHistory = async () => {
      setState('loading')

      try {
        const response = await axios.get(
          getBillingApiUrlWithParams(
            authentication,
            `billing-usage/${encodeURIComponent(billingCustomerKey)}/history`,
            { from: resolvedFrom, to: resolvedTo },
          ),
          getBillingRequestConfig(authentication),
        )

        if (!isActive) {
          return
        }

        const responseItems = response?.data?.data?.items
        if (!Array.isArray(responseItems)) {
          setItems([])
          setState('error')
          return
        }

        setItems(responseItems)
        setState('success')
      } catch (error) {
        if (!isActive) {
          return
        }

        const status = getHttpStatus(error)
        setItems([])
        setState(!status || status >= 500 ? 'unavailable' : 'error')
      }
    }

    fetchHistory()

    return () => {
      isActive = false
    }
  }, [authentication.apiKey, authentication.domain, authentication.token, billingCustomerKey, from, to])

  return { items, state }
}
