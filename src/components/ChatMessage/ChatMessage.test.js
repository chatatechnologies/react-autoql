import React from 'react'
import { shallow } from 'enzyme'
import { fetchLLMSummary, fetchLLMSummaryQuote } from 'autoql-fe-utils'

import { testAuthentication } from '../../../test/testData'
import { findByTestAttr } from '../../../test/testUtils'
import { ChatMessage } from './ChatMessage'
import { QueryOutput } from '../QueryOutput'

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

// A dataless response (service error, failed validation, "Did you mean") arrives as an
// ordinary response message. Every built-in toolbar item already gates itself off those,
// so an unguarded custom option was the only thing left in the More menu — the menu opened
// on an error offering nothing but "Add to Dashboard...".
describe('customOptions gating', () => {
  const customToolbarOptions = [{ name: 'Add to Dashboard...', icon: 'dashboard', callback: jest.fn() }]

  const customOptionsFor = (props) => {
    const instance = setup({ customToolbarOptions, ...props }).instance()
    return instance.renderRightToolbar().props.children.props.customOptions
  }

  test('are passed through for a normal data answer', () => {
    expect(customOptionsFor()).toEqual(customToolbarOptions)
  })

  test('are withheld for the 1.1.555 internal service error', () => {
    const response = {
      data: {
        data: {},
        message: 'Internal Service Error: Our system is experiencing an unexpected error.',
        reference_id: '1.1.555',
      },
    }

    expect(customOptionsFor({ response, type: undefined })).toEqual([])
  })

  test('are withheld for a "Did you mean" suggestion list', () => {
    const response = { data: { reference_id: '1.1.211', data: { items: ['total revenue'] } } }

    expect(customOptionsFor({ response, type: undefined })).toEqual([])
  })

  // Pre-existing gates, kept covered so the rewrite into `showCustomOptions` stays honest.
  test('are withheld for the intro message, a data preview, and a content-only message', () => {
    expect(customOptionsFor({ isIntroMessage: true })).toEqual([])

    const preview = { data: { reference_id: '1.1.210', data: { isDataPreview: true, columns: [], rows: [] } } }
    expect(customOptionsFor({ response: preview })).toEqual([])

    expect(customOptionsFor({ content: 'Thank you for your feedback!', response: undefined })).toEqual([])
  })
})

// The delete button is the toolbar's only destructive control, and OptionsToolbar's
// `enableDeleteBtn` was hardcoded here — integrators whose chat is a durable record had no
// way to remove it. ChatContent forwards `enableMessageDelete`; only an explicit false
// turns it off, so direct consumers of ChatMessage keep the button.
describe('delete button gating', () => {
  const enableDeleteBtnFor = (props) =>
    setup(props).instance().renderRightToolbar().props.children.props.enableDeleteBtn

  test('is on by default, when no preference is forwarded', () => {
    expect(enableDeleteBtnFor()).toBe(true)
  })

  test('is off when enableMessageDelete is false', () => {
    expect(enableDeleteBtnFor({ enableMessageDelete: false })).toBe(false)
  })

  test('is on when enableMessageDelete is true', () => {
    expect(enableDeleteBtnFor({ enableMessageDelete: true })).toBe(true)
  })

  // Pre-existing gate: the intro message is never deletable, whatever the integrator asks for.
  test('stays off for the intro message even when delete is enabled', () => {
    expect(enableDeleteBtnFor({ isIntroMessage: true, enableMessageDelete: true })).toBe(false)
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

  test('passes billingExecutionType through to the get-quote popover content', () => {
    const wrapper = setup({
      enableBillingGate: true,
      enableMagicWand: true,
      billingExecutionType: 'STRIPE',
    })
    const instance = wrapper.instance()

    const footer = instance.renderSummaryFooter()
    const button = footer.props.children[0].props.children
    const popoverContentElement = button.props.splitButton.popoverContent({ closePopover: () => {} })

    expect(popoverContentElement.props.billingExecutionType).toBe('STRIPE')
  })
})

// Both bubble actions reason over the answer's rows, so on a truncated answer they would
// be reasoning over the ten-row preview without knowing it. They return once the user
// restores the data, which clears `dataTruncated` on the message.
describe('truncated data gating', () => {
  const truncatedProps = {
    enableMagicWand: true,
    enableFollowOnQuery: true,
    dataTruncated: { droppedRowCount: 4512 },
  }

  test('hides the Auto Analyze button and the follow-up button, leaving no footer at all', () => {
    const instance = setup(truncatedProps).instance()

    expect(instance.shouldShowFollowOnButton()).toBe(false)
    expect(instance.renderSummaryFooter()).toBeNull()
  })

  test('shows both again on the same answer once its data is restored', () => {
    const instance = setup({ ...truncatedProps, dataTruncated: undefined }).instance()

    expect(instance.shouldShowFollowOnButton()).toBe(true)
    expect(instance.renderSummaryFooter()).not.toBeNull()
  })
})

// The toolbars hold the QueryOutput ref as a prop, so they go stale on the remount that
// truncating and restoring an answer forces - which is how Show/Hide Columns ended up
// opening nothing.
describe('the QueryOutput ref handed to the toolbars', () => {
  test('re-renders the message when the output remounts, so the toolbars get the live one', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const forceUpdate = jest.spyOn(instance, 'forceUpdate')

    const remounted = { _isMounted: true }
    instance.setResponseRef(remounted)

    expect(instance.responseRef).toBe(remounted)
    expect(forceUpdate).toHaveBeenCalled()
  })

  test('does not re-render for the same ref, or for the null the old instance leaves behind', () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const output = { _isMounted: true }
    instance.setResponseRef(output)

    const forceUpdate = jest.spyOn(instance, 'forceUpdate')
    instance.setResponseRef(output)
    instance.setResponseRef(null)

    expect(forceUpdate).not.toHaveBeenCalled()
  })
})

// Truncating an answer remounts its QueryOutput, which is seeded back from the view state
// held on the message. Both halves of the table params have to make the trip: the table
// params put the filter back on screen, the formatted ones are what queries (CSV export,
// Restore, custom options' tableFilters) are built from.
describe('view state round trip', () => {
  test('hands the saved table params, both halves, back to the output', () => {
    const tableParams = { filter: [{ field: '0', type: 'like', value: 'x' }], sort: [] }
    const formattedTableParams = { filters: [{ name: 'region', value: 'x', operator: 'like' }], sorters: [] }
    const onViewStateChange = jest.fn()
    const wrapper = setup({ onViewStateChange })
    const instance = wrapper.instance()

    instance.onTableParamsChange(tableParams, formattedTableParams)
    const [id, patch] = onViewStateChange.mock.calls[0]
    expect(id).toBe(defaultProps.id)

    wrapper.setProps({ viewState: patch, dataVersion: 1 })
    const output = wrapper.find(QueryOutput)

    expect(output.prop('initialTableParams')).toBe(tableParams)
    expect(output.prop('initialFormattedTableParams')).toBe(formattedTableParams)
  })
})

// Every QueryOutput mount reports its display type - including the remount truncation
// causes, which used to scroll an older charted answer into view.
describe('display type reported by a remount', () => {
  test('scrolls a newly charted answer into view, but not the same chart remounting', () => {
    jest.useFakeTimers()
    try {
      const instance = setup().instance()
      instance.getMessageVisibilityElement = () => ({})
      instance.isScrolledIntoView = () => false
      instance.animateScrollBubbleIntoContainer = jest.fn()

      instance.onDisplayTypeChange('column')
      jest.advanceTimersByTime(200)
      expect(instance.animateScrollBubbleIntoContainer).toHaveBeenCalledTimes(1)

      instance.onDisplayTypeChange('column')
      jest.advanceTimersByTime(200)
      expect(instance.animateScrollBubbleIntoContainer).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('updates while hidden', () => {
  test('skips them, except the dataVersion bump that lets go of truncated rows', () => {
    const instance = setup({ shouldRender: false }).instance()
    const props = instance.props

    expect(instance.shouldComponentUpdate({ ...props, isResizing: !props.isResizing }, instance.state)).toBe(false)
    expect(instance.shouldComponentUpdate({ ...props, dataVersion: 1 }, instance.state)).toBe(true)
  })
})
