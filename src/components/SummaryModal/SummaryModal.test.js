import React from 'react'
import { shallow } from 'enzyme'
import { fetchLLMSummary } from 'autoql-fe-utils'

import { testAuthentication } from '../../../test/testData'
import SummaryModal from './SummaryModal'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchLLMSummary: jest.fn(),
}))

const sampleQueryResponse = {
  data: {
    data: {
      columns: [{ name: 'col1', display_name: 'Col 1', type: 'STRING' }],
      rows: [['a'], ['b']],
      text: 'total sales',
      interpretation: 'total sales interpretation',
      query_id: 'q_test123',
    },
  },
}

const defaultProps = {
  authentication: testAuthentication,
  isOpen: true,
  queryResponse: sampleQueryResponse,
}

const setup = (props = {}) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<SummaryModal {...setupProps} />)
  return wrapper
}

describe('renders correctly', () => {
  test('renders with required props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
})

describe('billing gate (enableBillingGate)', () => {
  const ceilingReachedError = {
    reference_id: '1.1.993',
    message: 'MagicWand monthly usage quota has been reached. Raise the quota to continue.',
    data: { code: 'BILLING_USAGE_CEILING_REACHED', outcome: 'BLOCK_CEILING_EXCEEDED' },
  }
  const unavailableError = {
    reference_id: '1.1.993',
    message: 'Unable to verify current MagicWand billing usage. Please retry.',
    data: { code: 'BILLING_USAGE_UNAVAILABLE', outcome: 'BILLING_USAGE_UNAVAILABLE' },
  }

  beforeEach(() => {
    fetchLLMSummary.mockReset()
  })

  test('proactively blocks when quotaStatus is at_or_over_quota', async () => {
    const wrapper = setup({ enableBillingGate: true, quotaStatus: 'at_or_over_quota' })
    const instance = wrapper.instance()

    await instance.handleGenerateSummary()

    expect(fetchLLMSummary).not.toHaveBeenCalled()
    expect(instance.state.billingGateState).toBe('over_quota')
  })

  test('does not block when quotaStatus is unknown/loading/error', async () => {
    fetchLLMSummary.mockResolvedValue({ data: { data: { summary: 'Great insights' } } })
    const wrapper = setup({ enableBillingGate: true, quotaStatus: undefined })
    const instance = wrapper.instance()

    await instance.handleGenerateSummary()

    expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
    expect(instance.state.billingGateState).toBeNull()
  })

  test('reactive: a ceiling-reached error after a fired call renders the over_quota state', async () => {
    fetchLLMSummary.mockRejectedValue(ceilingReachedError)
    const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota' })
    const instance = wrapper.instance()

    await instance.handleGenerateSummary()

    expect(instance.state.billingGateState).toBe('over_quota')
    expect(instance.state.focusError).toBeNull()
  })

  test('reactive: an unavailable error never claims over-quota and does not block future attempts', async () => {
    fetchLLMSummary.mockRejectedValue(unavailableError)
    const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota' })
    const instance = wrapper.instance()

    await instance.handleGenerateSummary()

    expect(instance.state.billingGateState).toBe('unavailable')
  })

  test('with enableBillingGate false/omitted: no proactive block, and a ceiling-reached response falls back to the existing generic message unchanged', async () => {
    fetchLLMSummary.mockRejectedValue(ceilingReachedError)
    const wrapper = setup({ enableBillingGate: false, quotaStatus: 'at_or_over_quota' })
    const instance = wrapper.instance()

    await instance.handleGenerateSummary()

    // Not proactively blocked even though quotaStatus looks over-quota, because the gate is off.
    expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
    expect(instance.state.billingGateState).toBeNull()
    expect(instance.state.focusError).toBe(ceilingReachedError.message)
  })
})
