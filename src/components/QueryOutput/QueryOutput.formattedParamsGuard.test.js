import React from 'react'
import { mount } from 'enzyme'
import _cloneDeep from 'lodash.clonedeep'
import { QueryOutput as QueryOutputWithoutTheme } from './QueryOutput'
import testCases from '../../../test/responseTestCases'

describe('formattedTableParams guard', () => {
  test('keeps initial formattedTableParams when a transient empty payload arrives', () => {
    const testCase = _cloneDeep(testCases[8])

    const initialFilters = [
      {
        id: testCase.data.data.columns[0].name,
        value: testCase.data.data.rows[0][0],
        operator: 'equals',
      },
    ]

    const wrapper = mount(
      <QueryOutputWithoutTheme queryResponse={testCase} initialFormattedTableParams={{ filters: initialFilters }} />,
    )

    const instance = wrapper.instance()

    // Sanity: initial filters applied
    expect(Array.isArray(instance.formattedTableParams.filters)).toBe(true)
    expect(instance.formattedTableParams.filters.length).toBeGreaterThan(0)

    // Simulate ChataTable emitting an initial empty formatted payload
    instance.onTableParamsChange({}, {})

    // Guard should keep the initial formattedTableParams
    expect(Array.isArray(instance.formattedTableParams.filters)).toBe(true)
    expect(instance.formattedTableParams.filters.length).toBeGreaterThan(0)

    wrapper.unmount()
  })
})
