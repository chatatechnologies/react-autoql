import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'

import { runQueryOnly, setQueryMetadata } from 'autoql-fe-utils'

import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'
import { FOLLOW_ON_FILTERS_DEBOUNCE_MS } from '../../../js/followOnFilters'
import testCases from '../../../../test/responseTestCases'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  runQueryOnly: jest.fn(),
  setQueryMetadata: jest.fn(),
}))

const ORIGINAL_QUERY_ID = 'q_y4sWT0IAStWnLeM7COEsSQ'
const SESSION_ID = 'session-1'

// testCases[8]: month (STRING) by sale amount (DOLLAR_AMT), query id ORIGINAL_QUERY_ID
const makeResponse = () => _cloneDeep(testCases[8])

const responseWithId = (queryId) => {
  const response = makeResponse()
  response.data.data.query_id = queryId
  return response
}

const monthFilter = (value) => ({
  name: 'sale__transaction_date__month',
  columnName: 'Month',
  operator: 'like',
  value,
  id: 'col-0',
})

const mountOutput = (props = {}) =>
  mount(
    <QueryOutputWithoutTheme
      queryResponse={makeResponse()}
      initialDisplayType='table'
      querySessionId={SESSION_ID}
      {...props}
    />,
  )

beforeEach(() => {
  runQueryOnly.mockReset()
  runQueryOnly.mockImplementation(() => Promise.resolve(responseWithId('q_rerun')))
  setQueryMetadata.mockReset()
  setQueryMetadata.mockImplementation(() => Promise.resolve({}))
})

describe('> 50k: a table filter re-run is anchored to the original query', () => {
  test('a filter change sends the session id and the original query id', async () => {
    const instance = mountOutput().instance()

    await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] })

    expect(runQueryOnly).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, originalQueryId: ORIGINAL_QUERY_ID }),
    )
  })

  test('a sort-only re-run sends neither', async () => {
    const instance = mountOutput().instance()

    await instance.tableQueryFn({ tableFilters: [], orders: [{ name: 'x', sort: 'ASC' }] })

    const args = runQueryOnly.mock.calls[0][0]
    expect(args.sessionId).toBeUndefined()
    expect(args.originalQueryId).toBeUndefined()
  })

  test('sorting with an unchanged filter sends neither', async () => {
    const instance = mountOutput().instance()
    await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] })

    await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [{ name: 'x', sort: 'ASC' }] })

    const args = runQueryOnly.mock.calls[1][0]
    expect(args.sessionId).toBeUndefined()
    expect(args.originalQueryId).toBeUndefined()
  })

  test('later filter changes stay anchored to the original, not to the re-run that replaced it', async () => {
    const instance = mountOutput().instance()

    instance.onNewData(await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] }))
    instance.onNewData(await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [{ sort: 'ASC' }] }))
    await instance.tableQueryFn({ tableFilters: [monthFilter('feb')], orders: [] })

    expect(instance.queryID).toBe('q_rerun')
    expect(runQueryOnly.mock.calls[2][0].originalQueryId).toBe(ORIGINAL_QUERY_ID)
  })

  test('the anchor survives a remount from the re-run response', async () => {
    const instance = mountOutput().instance()
    const rerun = await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] })

    const remounted = mountOutput({ queryResponse: rerun }).instance()
    await remounted.tableQueryFn({ tableFilters: [monthFilter('feb')], orders: [] })

    expect(runQueryOnly.mock.calls[1][0].originalQueryId).toBe(ORIGINAL_QUERY_ID)
  })

  test('clearing the filters is a filter change too', async () => {
    const instance = mountOutput().instance()
    await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] })

    await instance.tableQueryFn({ tableFilters: [], orders: [] })

    expect(runQueryOnly.mock.calls[1][0]).toEqual(
      expect.objectContaining({ sessionId: SESSION_ID, originalQueryId: ORIGINAL_QUERY_ID, tableFilters: [] }),
    )
  })

  test('re-runs that are not table filters (drilldown by filter, restore) are not anchored', async () => {
    const instance = mountOutput().instance()

    await instance.queryFn({ tableFilters: [monthFilter('jan')] })
    await instance.queryFn()

    runQueryOnly.mock.calls.forEach(([args]) => {
      expect(args.sessionId).toBeUndefined()
      expect(args.originalQueryId).toBeUndefined()
    })
  })

  test('without a query session nothing is anchored', async () => {
    const instance = mountOutput({ querySessionId: undefined }).instance()

    await instance.tableQueryFn({ tableFilters: [monthFilter('jan')], orders: [] })

    expect(runQueryOnly.mock.calls[0][0].originalQueryId).toBeUndefined()
  })
})

describe('< 50k: client-side filters are recorded on the query through the metadata endpoint', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  // The fixture has 5 rows, so the mounted ChataTable filters client-side on its own
  const filterLocally = (instance, filters, sorters = []) => {
    expect(instance.tableRef.isLocal).toBe(true)
    instance.onTableParamsChange({ filter: [], sort: [] }, { filters, sorters })
  }

  test('records the settled filters once, on the original query, with the session id', () => {
    const instance = mountOutput().instance()

    filterLocally(instance, [monthFilter('j')])
    filterLocally(instance, [monthFilter('ja')])
    filterLocally(instance, [monthFilter('jan')])
    expect(setQueryMetadata).not.toHaveBeenCalled()

    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).toHaveBeenCalledTimes(1)
    expect(setQueryMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: ORIGINAL_QUERY_ID,
        sessionId: SESSION_ID,
        filters: [{ name: 'sale__transaction_date__month', operator: 'like', value: 'jan', column_type: 'STRING' }],
      }),
    )
  })

  test('sorting with unchanged filters records nothing', () => {
    const instance = mountOutput().instance()
    filterLocally(instance, [monthFilter('jan')])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    filterLocally(instance, [monthFilter('jan')], [{ name: 'x', sort: 'DESC' }])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).toHaveBeenCalledTimes(1)
  })

  test('a sort on a never-filtered table records nothing', () => {
    const instance = mountOutput().instance()

    filterLocally(instance, [], [{ name: 'x', sort: 'DESC' }])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).not.toHaveBeenCalled()
  })

  test('clearing the filters records an empty list', () => {
    const instance = mountOutput().instance()
    filterLocally(instance, [monthFilter('jan')])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    filterLocally(instance, [])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).toHaveBeenCalledTimes(2)
    expect(setQueryMetadata.mock.calls[1][0].filters).toEqual([])
  })

  test('a filter typed and removed before it settles records nothing', () => {
    const instance = mountOutput().instance()

    filterLocally(instance, [monthFilter('jan')])
    filterLocally(instance, [])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).not.toHaveBeenCalled()
  })

  test('remote tables do not use the metadata endpoint', () => {
    const instance = mountOutput().instance()

    instance.tableRef.isLocal = false
    instance.onTableParamsChange({ filter: [], sort: [] }, { filters: [monthFilter('jan')], sorters: [] })
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).not.toHaveBeenCalled()
  })

  test.each([
    ['there is no query session', { querySessionId: undefined }],
    [
      'the answer is a client-side drilldown of another query',
      { queryResponse: { ...makeResponse(), isClientSideFilter: true } },
    ],
  ])('records nothing when %s', (_, props) => {
    const instance = mountOutput(props).instance()

    filterLocally(instance, [monthFilter('jan')])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).not.toHaveBeenCalled()
  })

  test('a pending filter is sent when the answer unmounts', () => {
    const wrapper = mountOutput()
    filterLocally(wrapper.instance(), [monthFilter('jan')])

    wrapper.unmount()

    expect(setQueryMetadata).toHaveBeenCalledTimes(1)
  })

  test('a failed call is silent and the same filters are retried on the next change', async () => {
    setQueryMetadata.mockImplementationOnce(() => Promise.reject({ message: 'forbidden' }))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = mountOutput().instance()

    filterLocally(instance, [monthFilter('jan')])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)
    await Promise.resolve()
    await Promise.resolve()

    filterLocally(instance, [monthFilter('jan')])
    jest.advanceTimersByTime(FOLLOW_ON_FILTERS_DEBOUNCE_MS)

    expect(setQueryMetadata).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
