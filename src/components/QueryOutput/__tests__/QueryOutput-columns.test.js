import React from 'react'
import { mount } from 'enzyme'
import { QueryOutput } from '../QueryOutput'

const rawColumns = [
  { id: 'c0', name: 'col0', display_name: 'Col 0', index: 0, is_visible: true, type: 'STRING' },
  { id: 'c1', name: 'col1', display_name: 'Col 1', index: 1, is_visible: true, type: 'STRING' },
  { id: 'c2', name: 'col2', display_name: 'Col 2', index: 2, is_visible: true, type: 'QUANTITY' },
]

const queryResponse = {
  data: {
    data: {
      text: 'test query',
      rows: [['a', 'b', 1]],
      columns: rawColumns,
    },
  },
}

const setup = () =>
  mount(<QueryOutput authentication={{}} onTableConfigChange={jest.fn()} queryResponse={queryResponse} />)

describe('QueryOutput frozen column and column order persistence', () => {
  test('onColumnFreezeChange sets frozen on the named column only', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col1', true)
    wrapper.update()

    expect(inst.state.columns.find((c) => c.name === 'col1').frozen).toBe(true)
    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(false)
    wrapper.unmount()
  })

  test('formatColumnsForTable preserves frozen state across a column rebuild', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col1', true)
    wrapper.update()
    const rebuilt = inst.formatColumnsForTable(rawColumns)

    expect(rebuilt.find((c) => c.name === 'col1').frozen).toBe(true)
    expect(rebuilt.find((c) => c.name === 'col0').frozen).toBe(false)
    wrapper.unmount()
  })

  test('formatColumnsForTable reapplies user column order and appends new columns at the end', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col2', 'col0', 'col1'])
    const newCol = { id: 'c3', name: 'col3', display_name: 'Col 3', index: 3, is_visible: true, type: 'QUANTITY' }
    const rebuilt = inst.formatColumnsForTable([...rawColumns, newCol])

    expect(rebuilt.map((c) => c.name)).toEqual(['col2', 'col0', 'col1', 'col3'])
    // field must stay tied to the column's index into the row data, not its display position
    expect(rebuilt.find((c) => c.name === 'col2').field).toBe('2')
    wrapper.unmount()
  })

  test('onColumnOrderChange ignores empty input', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col1', 'col0', 'col2'])
    inst.onColumnOrderChange([])
    inst.onColumnOrderChange(undefined)

    expect(inst.columnOrder).toEqual(['col1', 'col0', 'col2'])
    wrapper.unmount()
  })
})
