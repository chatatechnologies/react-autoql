import { useEffect, useState } from 'react'
import { getDefaultBillingHistoryRange } from '../../utils/billingFormatting'
import { getBillingApiUrlWithParams, getBillingRequestConfig, hasBillingAuthentication } from './billingApi'

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
        const response = await fetch(
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

        if (response.status >= 500) {
          setItems([])
          setState('unavailable')
          return
        }

        if (!response.ok) {
          setItems([])
          setState('error')
          return
        }

        const json = await response.json()
        if (!isActive) {
          return
        }

        const responseItems = json?.data?.items
        if (!Array.isArray(responseItems)) {
          setItems([])
          setState('error')
          return
        }

        setItems(responseItems)
        setState('success')
      } catch {
        if (!isActive) {
          return
        }

        setItems([])
        setState('unavailable')
      }
    }

    fetchHistory()

    return () => {
      isActive = false
    }
  }, [authentication.apiKey, authentication.domain, authentication.token, billingCustomerKey, from, to])

  return { items, state }
}
