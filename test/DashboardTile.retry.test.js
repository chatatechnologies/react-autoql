import React from 'react'
import { shallow } from 'enzyme'

// Provide a light mock for autoql-fe-utils before importing the component
const mockRunCached = jest.fn()
const mockRunQuery = jest.fn()
jest.mock('autoql-fe-utils', () => ({
  runCachedDashboardQuery: mockRunCached,
  runQuery: mockRunQuery,
  fetchAutocomplete: jest.fn(),
  deepEqual: jest.fn(() => false),
  isChartType: jest.fn(() => false),
  REQUEST_CANCELLED_ERROR: 'REQUEST_CANCELLED_ERROR',
  authenticationDefault: {},
  autoQLConfigDefault: {},
  dataFormattingDefault: {},
  getAuthentication: () => ({}),
  getAutoQLConfig: () => ({}),
  CustomColumnTypes: { FUNCTION: 'function' },
  QueryErrorTypes: {},
  transformQueryResponse: jest.fn(),
  fetchSuggestions: jest.fn(),
  isError500Type: jest.fn(() => false),
}))

// Stub heavy child components to avoid loading unrelated modules during unit test
jest.mock('../src/components/QueryOutput', () => ({ QueryOutput: () => null }))
jest.mock('../src/components/OptionsToolbar', () => ({ OptionsToolbar: () => null }))
jest.mock('../src/components/Icon', () => ({ Icon: () => null }))
jest.mock('../src/components/Button', () => ({ Button: () => null }))
jest.mock('../src/components/VizToolbar', () => ({ VizToolbar: () => null }))
jest.mock('../src/components/LoadingDots/LoadingDots.js', () => () => null)
jest.mock('../src/containers/ErrorHOC/ErrorHOC', () => ({
  __esModule: true,
  default: (props) => props.children || null,
}))
jest.mock('../src/components/ReverseTranslation', () => ({ ReverseTranslation: () => null }))
jest.mock('../src/components/Popover', () => ({ Popover: () => null }))

import { DashboardTile } from '../src/components/Dashboard/DashboardTile/DashboardTile'

describe('DashboardTile retry behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockRunCached.mockReset()
    mockRunQuery.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('retries with force:true and calls onRetry when cached helper returns 500', async () => {
    const onRetry = jest.fn()

    const props = {
      tile: { i: 1, query: 'cats' },
      setParamsForTile: jest.fn(),
      authentication: {},
      autoQLConfig: {},
      dataFormatting: {},
      onRetry,
    }

    const wrapper = shallow(<DashboardTile {...props} />)
    const instance = wrapper.instance()

    const requestData = { query: 'cats' }

    const error = { response: { status: 500, data: { message: 'Internal Server Error', reference_id: 'abc.500' } } }

    mockRunCached
      .mockImplementationOnce(() => Promise.reject(error))
      .mockImplementationOnce(() => Promise.resolve({ data: { data: { rows: [] } }, status: 200 }))

    // Use real timers for the retry delay so promises resolve naturally
    jest.useRealTimers()
    const p = instance.executeQueryWithForceRetry(requestData, mockRunCached)

    try {
      await p
    } catch (e) {
      // swallow - we want to assert telemetry was emitted even on error
    }

    // Cached helper should be called twice: initial attempt and retry
    expect(mockRunCached).toHaveBeenCalledTimes(2)
    expect(mockRunCached).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: true }))

    // Ensure the telemetry callback was invoked with the forced retry payload
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'retry', retryData: expect.objectContaining({ force: true }) }),
    )
  })

  it('successfully resolves query response after forced retry', async () => {
    const props = {
      tile: { i: 1, query: 'dogs' },
      setParamsForTile: jest.fn(),
      authentication: {},
      autoQLConfig: {},
      dataFormatting: {},
    }

    const wrapper = shallow(<DashboardTile {...props} />)
    const instance = wrapper.instance()

    const requestData = { query: 'dogs' }
    const successResponse = { data: { data: { rows: [{ name: 'Fido', age: 5 }] } }, status: 200 }
    const error = { response: { status: 500, data: { message: 'Internal Server Error' } } }

    mockRunCached
      .mockImplementationOnce(() => Promise.reject(error))
      .mockImplementationOnce(() => Promise.resolve(successResponse))

    // Use real timers for the retry so promises resolve naturally
    jest.useRealTimers()
    const result = await instance.executeQueryWithForceRetry(requestData, mockRunCached)

    // Assert force:true was passed on the retry call
    expect(mockRunCached).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: true }))
    // Assert the successful response is returned from the forced retry
    expect(result).toEqual(successResponse)
  })
})
