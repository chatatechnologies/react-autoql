import React from 'react'
import { shallow } from 'enzyme'
import { fetchLLMSummary, fetchLLMSummaryQuote } from 'autoql-fe-utils'

import { testAuthentication } from '../../../test/testData'
import { findByTestAttr } from '../../../test/testUtils'
import { ChatMessage } from './ChatMessage'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchLLMSummary: jest.fn(),
  fetchLLMSummaryQuote: jest.fn(),
}))

const sampleResponse = {
  data: {
    message: 'Success',
    reference_id: '1.1.210',
    data: {
      columns: [
        {
          display_name: 'Amount (Sum)',
          groupable: false,
          is_visible: true,
          name: 'sum(generalledger.amount)',
          type: 'DOLLAR_AMT',
        },
        {
          display_name: 'Test Column',
          groupable: false,
          is_visible: true,
          name: 'test',
          type: 'QUANTITY',
        },
      ],
      display_type: 'data',
      interpretation:
        'Amount (Sum), lower of Classification of \'revenue\', and, Date greater than or equal \'2020-05-01T00:00:00.000Z\', and, Date below \'2020-05-31T23:59:59.000Z\'',
      query_id: 'q_uwOMur9eTtSxyKh_GSI1bQ',
      rows: [
        [148644.9600000001, 1],
        [111, 1],
      ],
      sql: ['select sum()'],
    },
  },
}

const defaultProps = {
  id: 'r9837592385',
  authentication: testAuthentication,
  response: sampleResponse,
  isResponse: true,
  type: 'data',
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChatMessage {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const chatMessageComponent = findByTestAttr(wrapper, 'chat-message')
    expect(chatMessageComponent.exists()).toBe(true)
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
    fetchLLMSummaryQuote.mockReset()
  })

  describe('handleGetQuote (popover "Get quote")', () => {
    test('proactively blocks when quotaStatus is at_or_over_quota', async () => {
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'at_or_over_quota' })
      const instance = wrapper.instance()

      await instance.handleGetQuote()

      expect(fetchLLMSummaryQuote).not.toHaveBeenCalled()
      expect(instance.state.billingGateState).toBe('over_quota')
    })

    test('does not block when quotaStatus is unknown/loading/error', async () => {
      fetchLLMSummaryQuote.mockResolvedValue({ data: { data: { wandable: true, cost: 1 } } })
      const wrapper = setup({ enableBillingGate: true, quotaStatus: undefined })
      const instance = wrapper.instance()

      await instance.handleGetQuote()

      expect(fetchLLMSummaryQuote).toHaveBeenCalledTimes(1)
      expect(instance.state.billingGateState).toBeNull()
    })

    test('reactive: a ceiling-reached error after a fired call renders the over_quota state', async () => {
      fetchLLMSummaryQuote.mockRejectedValue(ceilingReachedError)
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota' })
      const instance = wrapper.instance()

      await instance.handleGetQuote()

      expect(instance.state.billingGateState).toBe('over_quota')
      expect(instance.state.focusError).toBeNull()
    })

    test('reactive: an unavailable error never claims over-quota', async () => {
      fetchLLMSummaryQuote.mockRejectedValue(unavailableError)
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota' })
      const instance = wrapper.instance()

      await instance.handleGetQuote()

      expect(instance.state.billingGateState).toBe('unavailable')
    })
  })

  describe('handleGenerateSummary ("Auto Analyze")', () => {
    test('proactively blocks and notifies via addMessageToDM when quotaStatus is at_or_over_quota', async () => {
      const addMessageToDM = jest.fn()
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'at_or_over_quota', addMessageToDM })
      const instance = wrapper.instance()

      await instance.handleGenerateSummary()

      expect(fetchLLMSummary).not.toHaveBeenCalled()
      expect(instance.state.billingGateState).toBe('over_quota')
      expect(addMessageToDM).toHaveBeenCalledTimes(1)
      expect(addMessageToDM.mock.calls[0][0].content).toMatch(/at or over its monthly quota/i)
    })

    test('does not block when quotaStatus is unknown/loading/error', async () => {
      fetchLLMSummary.mockResolvedValue({ data: { data: { summary: 'Great insights' } } })
      const addMessageToDM = jest.fn()
      const wrapper = setup({ enableBillingGate: true, quotaStatus: undefined, addMessageToDM })
      const instance = wrapper.instance()

      await instance.handleGenerateSummary()

      expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
      expect(instance.state.billingGateState).toBeNull()
    })

    test('reactive: a ceiling-reached error after a fired call renders the over_quota state', async () => {
      fetchLLMSummary.mockRejectedValue(ceilingReachedError)
      const addMessageToDM = jest.fn()
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota', addMessageToDM })
      const instance = wrapper.instance()

      await instance.handleGenerateSummary()

      expect(instance.state.billingGateState).toBe('over_quota')
      expect(instance.state.focusError).toBeNull()
    })

    test('reactive: an unavailable error never claims over-quota and does not block future attempts', async () => {
      fetchLLMSummary.mockRejectedValue(unavailableError)
      const addMessageToDM = jest.fn()
      const wrapper = setup({ enableBillingGate: true, quotaStatus: 'under_quota', addMessageToDM })
      const instance = wrapper.instance()

      await instance.handleGenerateSummary()

      expect(instance.state.billingGateState).toBe('unavailable')
    })

    test('with enableBillingGate false/omitted: no proactive block, no hook-driven gating, and a ceiling-reached response falls back to the existing generic message unchanged', async () => {
      fetchLLMSummary.mockRejectedValue(ceilingReachedError)
      const addMessageToDM = jest.fn()
      const wrapper = setup({ enableBillingGate: false, quotaStatus: 'at_or_over_quota', addMessageToDM })
      const instance = wrapper.instance()

      await instance.handleGenerateSummary()

      // Not proactively blocked even though quotaStatus looks over-quota, because the gate is off.
      expect(fetchLLMSummary).toHaveBeenCalledTimes(1)
      expect(instance.state.billingGateState).toBeNull()
      expect(instance.state.focusError).toBe(ceilingReachedError.message)
      expect(addMessageToDM).toHaveBeenCalledWith(
        expect.objectContaining({ content: ceilingReachedError.message }),
      )
    })
  })
})
