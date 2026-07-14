import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import axios from 'axios'
import { useBillingCustomerKey } from '../useBillingCustomerKey'
import { useBillingHistory } from '../useBillingHistory'
import { useBillingQuotaUpdate } from '../useBillingQuotaUpdate'
import { useBillingUsage } from '../useBillingUsage'

jest.mock('axios')

const authentication = {
  token: 'token-123',
  apiKey: 'api-key-123',
  domain: 'https://domain.test',
}

const axiosError = (status) => ({ response: status ? { status } : undefined })

const CustomerKeyHarness = ({ auth = authentication }) => {
  const result = useBillingCustomerKey({ authentication: auth })
  return (
    <div data-test='result'>
      {result.state}|{result.billingCustomerKey ?? ''}|{result.scope?.scope_type ?? ''}
    </div>
  )
}

CustomerKeyHarness.propTypes = {
  auth: PropTypes.shape({
    token: PropTypes.string,
    apiKey: PropTypes.string,
    domain: PropTypes.string,
  }),
}

const UsageHarness = ({ auth = authentication }) => {
  const result = useBillingUsage({
    authentication: auth,
    billingCustomerKey: 'bck_acme_ABCDEFGH',
  })
  return (
    <div data-test='result'>
      {result.state}|{result.data?.billing_period ?? ''}
    </div>
  )
}

UsageHarness.propTypes = CustomerKeyHarness.propTypes

const HistoryHarness = () => {
  const result = useBillingHistory({
    authentication,
    billingCustomerKey: 'bck_acme_ABCDEFGH',
    from: '2026-05',
    to: '2026-06',
  })
  return (
    <div data-test='result'>
      {result.state}|{result.items[0]?.current_quota_projection_status ?? ''}
    </div>
  )
}

const QuotaHarness = () => {
  const [mode, setMode] = useState('')
  const { isSaving, updateQuota } = useBillingQuotaUpdate({
    authentication,
    billingCustomerKey: 'bck_acme_ABCDEFGH',
  })

  return (
    <div>
      <div data-test='result'>
        {isSaving ? 'saving' : 'idle'}|{mode}
      </div>
      <button
        type='button'
        onClick={async () => {
          const response = await updateQuota(40000000)
          setMode(response.effective_update_mode)
        }}
      >
        Save
      </button>
    </div>
  )
}

describe('billing hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useBillingCustomerKey', () => {
    it('stays idle until authentication is complete', () => {
      render(<CustomerKeyHarness auth={{}} />)
      expect(screen.getByTestId('result')).toHaveTextContent('idle||')
      expect(axios.get).not.toHaveBeenCalled()
    })

    it('resolves the scoped customer key from the plural route', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          data: {
            billing_customer_key: 'bck_acme_ABCDEFGH',
            scope: { scope_type: 'integrator', scope_id: '1' },
          },
        },
      })

      render(<CustomerKeyHarness />)

      await waitFor(() =>
        expect(screen.getByTestId('result')).toHaveTextContent('success|bck_acme_ABCDEFGH|integrator'),
      )
      expect(axios.get).toHaveBeenCalledWith(
        'https://domain.test/autoql/api/v1/billing/customer-keys?key=api-key-123',
        { headers: { Authorization: 'Bearer token-123' } },
      )
    })

    it('maps a 404 to missing_customer', async () => {
      axios.get.mockRejectedValueOnce(axiosError(404))
      render(<CustomerKeyHarness />)
      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('missing_customer'))
    })
  })

  describe('useBillingUsage', () => {
    it('returns current-period usage', async () => {
      axios.get.mockResolvedValueOnce({
        data: { data: { billing_period: '2026-06', usage_to_date_micros: 12500000 } },
      })
      render(<UsageHarness />)

      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('success|2026-06'))
      expect(axios.get.mock.calls[0][0]).toBe(
        'https://domain.test/autoql/api/v1/billing-usage/bck_acme_ABCDEFGH/current-period?key=api-key-123',
      )
    })

    it.each([
      [404, 'missing_customer'],
      [400, 'error'],
      [500, 'unavailable'],
      [undefined, 'unavailable'],
    ])('maps status %s to %s', async (status, expectedState) => {
      axios.get.mockRejectedValueOnce(axiosError(status))
      render(<UsageHarness />)
      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent(`${expectedState}|`))
    })
  })

  describe('useBillingHistory', () => {
    it('returns canonical current-quota projection fields', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          data: {
            items: [
              {
                billing_period: '2026-06',
                usage_to_date_micros: 12500000,
                quota_projection_label: 'current_quota_projection',
                current_quota_projection_monthly_micros: 30000000,
                current_quota_projection_status: 'under_quota',
              },
            ],
          },
        },
      })
      render(<HistoryHarness />)

      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('success|under_quota'))
      expect(axios.get.mock.calls[0][0]).toBe(
        'https://domain.test/autoql/api/v1/billing-usage/bck_acme_ABCDEFGH/history?from=2026-05&to=2026-06&key=api-key-123',
      )
    })

    it('treats server failures as unavailable', async () => {
      axios.get.mockRejectedValueOnce(axiosError(503))
      render(<HistoryHarness />)
      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('unavailable|'))
    })
  })

  describe('useBillingQuotaUpdate', () => {
    it('sends integer micros and returns the update result', async () => {
      axios.put.mockResolvedValueOnce({
        data: { data: { effective_update_mode: 'immediate' } },
      })
      render(<QuotaHarness />)
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('idle|immediate'))
      expect(axios.put).toHaveBeenCalledWith(
        'https://domain.test/autoql/api/v1/billing-quotas/bck_acme_ABCDEFGH?key=api-key-123',
        { monthly_quota_micros: 40000000 },
        {
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
          },
        },
      )
    })
  })
})
