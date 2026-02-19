import React from 'react'
import { mount } from 'enzyme'

// Mock runDrillthrough before importing module under test to avoid non-configurable exports
const mockResponse = { data: { data: { rows: [[1]], count_rows: 1 } } }
jest.mock('autoql-fe-utils', () => {
  const actual = jest.requireActual('autoql-fe-utils')
  return {
    ...actual,
    runDrillthrough: jest.fn().mockResolvedValue(mockResponse),
  }
})

import * as utils from 'autoql-fe-utils'
import { QueryOutput } from '../src/components/QueryOutput/QueryOutput'

describe('processDrillthrough integration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('calls runDrillthrough with permissions.details and drillthrough_col and forwards response', async () => {
    const columns = [{ name: 'id' }, { name: 'name' }]

    const rows = [[42, 'Alice']]

    const props = {
      authentication: { apiKey: 'k', token: 't', domain: 'd' },
      autoQLConfig: {},
      source: 'source',
      scope: 'scope',
      originalQueryID: 'orig-qid',
      queryResponse: { data: { data: { columns, rows, query_id: 'q1', drilldown_query_id: 'dq1' } } },
      onDrilldownEnd: jest.fn(),
    }

    const wrapper = mount(<QueryOutput {...props} />)
    const instance = wrapper.instance()

    const fakeCell = {
      getData: () => rows[0],
      getColumn: () => ({ getDefinition: () => ({ field: 'id' }) }),
    }

    await instance.processDrillthrough({ cell: fakeCell, groupBys: [], supportedByAPI: true })

    expect(utils.runDrillthrough).toHaveBeenCalled()
    const callArg = utils.runDrillthrough.mock.calls[0][0]
    expect(callArg).toHaveProperty('drillthrough_col')
    expect(callArg).toHaveProperty('tableFilters')
    expect(callArg).toHaveProperty('permissions')
    expect(Array.isArray(callArg.permissions.details)).toBe(true)
    expect(props.onDrilldownEnd).toHaveBeenCalled()
  })
})
