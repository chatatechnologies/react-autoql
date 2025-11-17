// Ensure `isSelectableNumberColumn` behaves reasonably for our test columns
jest.mock('autoql-fe-utils', () => {
  const actual = jest.requireActual('autoql-fe-utils')
  return {
    ...actual,
    isSelectableNumberColumn: (col) => col && col.is_visible !== false && col.type === 'number',
  }
})

import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'

// Minimal helper to create a QueryOutput instance with controllable columns and tableConfig
const setup = ({ columns = [], tableConfig = {}, queryResponse = {} } = {}) => {
  const props = {
    queryResponse,
    initialTableConfigs: undefined,
    onTableConfigChange: () => {},
    onAggConfigChange: () => {},
    onChartControlsChange: () => {},
  }

  const wrapper = mount(<QueryOutput {...props} />)
  const instance = wrapper.instance()

  // Provide columns and tableConfig directly on the instance to emulate state
  instance.getColumns = () => columns
  instance.tableConfig = tableConfig
  instance.queryResponse = queryResponse

  return { wrapper, instance }
}

describe('QueryOutput.findAndSetFallbackNumberColumnIndex2', () => {
  test('picks first selectable numeric column not excluded', () => {
    const columns = [
      { index: 0, display_name: 'A', is_visible: true, type: 'number' },
      { index: 1, display_name: 'B', is_visible: true, type: 'number' },
      { index: 2, display_name: 'C', is_visible: true, type: 'string' },
    ]

    const { instance } = setup({
      columns,
      tableConfig: {
        numberColumnIndex: 0,
        numberColumnIndices: [0],
        numberColumnIndex2: undefined,
        numberColumnIndices2: [],
      },
      queryResponse: { data: { data: { default_amount_column: undefined } } },
    })

    // Exclude index 0, expect fallback to pick index 1
    const fallback = instance.findAndSetFallbackNumberColumnIndex2([0])
    expect(fallback).toBe(1)
    expect(instance.tableConfig.numberColumnIndex2).toBe(1)
    expect(instance.tableConfig.numberColumnIndices2).toEqual([1])
  })

  test('returns undefined when no candidate available', () => {
    const columns = [
      { index: 0, display_name: 'A', is_visible: false, type: 'number' },
      { index: 1, display_name: 'B', is_visible: true, type: 'string' },
    ]

    const { instance } = setup({
      columns,
      tableConfig: {
        numberColumnIndex: 0,
        numberColumnIndices: [0],
        numberColumnIndex2: undefined,
        numberColumnIndices2: [],
      },
      queryResponse: { data: { data: { default_amount_column: undefined } } },
    })

    const fallback = instance.findAndSetFallbackNumberColumnIndex2([0, 1])
    expect(fallback).toBeUndefined()
    // tableConfig should not be modified to include an invalid index
    expect(instance.tableConfig.numberColumnIndex2).toBeUndefined()
    expect(instance.tableConfig.numberColumnIndices2).toEqual([])
  })

  test('respects provided preferred index if valid and not excluded', () => {
    const columns = [
      { index: 0, display_name: 'A', is_visible: true, type: 'number' },
      { index: 1, display_name: 'B', is_visible: true, type: 'number' },
    ]

    const { instance } = setup({
      columns,
      tableConfig: { numberColumnIndex: 0, numberColumnIndices: [0], numberColumnIndex2: 1, numberColumnIndices2: [1] },
      queryResponse: { data: { data: { default_amount_column: undefined } } },
    })

    const fallback = instance.findAndSetFallbackNumberColumnIndex2([0], 1)
    expect(fallback).toBe(1)
    expect(instance.tableConfig.numberColumnIndex2).toBe(1)
    expect(instance.tableConfig.numberColumnIndices2).toEqual([1])
  })
})
