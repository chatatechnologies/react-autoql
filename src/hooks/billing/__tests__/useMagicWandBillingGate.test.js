import React from 'react'
import PropTypes from 'prop-types'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useMagicWandBillingGate } from '../useMagicWandBillingGate'

const authentication = {
  token: 'token-123',
  apiKey: 'api-key-123',
  domain: 'https://domain.test',
}

const buildFetchResponse = (status, data) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  })

const Harness = ({ enabled }) => {
  const { quotaStatus } = useMagicWandBillingGate({ authentication, enabled })
  return <div data-test='result'>{quotaStatus ?? 'undefined'}</div>
}

Harness.propTypes = {
  enabled: PropTypes.bool,
}

describe('useMagicWandBillingGate', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('never fetches and stays undefined when disabled', async () => {
    render(<Harness enabled={false} />)
    expect(screen.getByTestId('result')).toHaveTextContent('undefined')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('resolves at_or_over_quota once the customer key and usage both succeed', async () => {
    global.fetch
      .mockImplementationOnce(() => buildFetchResponse(200, { billing_customer_key: 'bck_acme_ABCDEFGH' }))
      .mockImplementationOnce(() => buildFetchResponse(200, { quota_status: 'at_or_over_quota' }))

    render(<Harness enabled={true} />)

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('at_or_over_quota'))
  })

  it('resolves under_quota when usage is comfortably within quota', async () => {
    global.fetch
      .mockImplementationOnce(() => buildFetchResponse(200, { billing_customer_key: 'bck_acme_ABCDEFGH' }))
      .mockImplementationOnce(() => buildFetchResponse(200, { quota_status: 'under_quota' }))

    render(<Harness enabled={true} />)

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('under_quota'))
  })

  it('stays undefined (never blocks) when the usage fetch is unavailable', async () => {
    global.fetch
      .mockImplementationOnce(() => buildFetchResponse(200, { billing_customer_key: 'bck_acme_ABCDEFGH' }))
      .mockImplementationOnce(() => buildFetchResponse(500))

    render(<Harness enabled={true} />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('result')).toHaveTextContent('undefined')
  })

  it('stays undefined (never blocks) when no billing customer key resolves', async () => {
    global.fetch.mockImplementationOnce(() => buildFetchResponse(404))

    render(<Harness enabled={true} />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('result')).toHaveTextContent('undefined')
  })
})
