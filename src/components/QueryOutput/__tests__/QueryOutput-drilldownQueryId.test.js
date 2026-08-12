import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { runDrilldown } from 'autoql-fe-utils'
import { QueryOutput as QueryOutputWithoutTheme } from '../QueryOutput'
import testCases from '../../../../test/responseTestCases'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  runDrilldown: jest.fn(() => Promise.resolve({ data: { data: { rows: [], columns: [] } } })),
}))

// The tile pins drilldowns to its cached queryId because a background cached-refresh response can
// carry a different query_id for the same logical query, which the drilldown endpoint 500s on.
describe('QueryOutput drilldown query id pinning', () => {
  const baseTestCase = _cloneDeep(testCases[8])
  const responseQueryID = baseTestCase.data.data.query_id

  const mountWithResponse = (props = {}) =>
    mount(
      <QueryOutputWithoutTheme
        queryResponse={_cloneDeep(baseTestCase)}
        queryFn={() => {}}
        autoQLConfig={{ enableDrilldowns: true }}
        onDrilldownStart={() => {}}
        onDrilldownEnd={() => {}}
        {...props}
      />,
    )

  const runApiDrilldown = async (wrapper) => {
    await wrapper.instance().processDrilldown({
      supportedByAPI: true,
      groupBys: [{ name: 'col1', value: 'a', operator: '=' }],
      activeKey: '0-0',
    })
  }

  beforeEach(() => {
    runDrilldown.mockClear()
  })

  it('uses the pinned queryId prop instead of the response query_id', async () => {
    const wrapper = mountWithResponse({ queryId: 'pinned-query-id' })

    await runApiDrilldown(wrapper)

    expect(runDrilldown).toHaveBeenCalledTimes(1)
    expect(runDrilldown.mock.calls[0][0].queryID).toBe('pinned-query-id')

    wrapper.unmount()
  })

  it('falls back to the response query_id when no queryId prop is given', async () => {
    const wrapper = mountWithResponse()

    await runApiDrilldown(wrapper)

    expect(runDrilldown.mock.calls[0][0].queryID).toBe(responseQueryID)

    wrapper.unmount()
  })

  it('keeps using the pinned queryId after a cached refresh brings back a different query_id', async () => {
    const wrapper = mountWithResponse({ queryId: 'pinned-query-id' })

    const refreshed = _cloneDeep(baseTestCase)
    refreshed.data.data.query_id = 'fresh-query-id-from-cached-refresh'
    wrapper.setProps({ queryResponse: refreshed })
    wrapper.update()

    await runApiDrilldown(wrapper)

    expect(runDrilldown.mock.calls[0][0].queryID).toBe('pinned-query-id')

    wrapper.unmount()
  })
})
