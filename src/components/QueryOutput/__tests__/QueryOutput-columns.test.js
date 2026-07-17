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

  test('formatColumnsForTable keeps canonical (data-order) columns regardless of user column order', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col2', 'col0', 'col1'])
    const newCol = { id: 'c3', name: 'col3', display_name: 'Col 3', index: 3, is_visible: true, type: 'QUANTITY' }
    const rebuilt = inst.formatColumnsForTable([...rawColumns, newCol])

    // state.columns must stay in canonical data order - index-based consumers (charts/drilldowns/
    // pivots) rely on rebuilt[i].field === i, so user drag-order must never permute this array
    expect(rebuilt.map((c) => c.name)).toEqual(['col0', 'col1', 'col2', 'col3'])
    expect(rebuilt.find((c) => c.name === 'col2').field).toBe('2')
    wrapper.unmount()
  })

  test('getOrderedTableColumns reapplies user column order for display, appending new columns at the end', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col2', 'col0', 'col1'])
    wrapper.update()
    const ordered = inst.getOrderedTableColumns()

    expect(ordered.map((c) => c.name)).toEqual(['col2', 'col0', 'col1'])
    // field must stay tied to the column's index into the row data, not its display position
    expect(ordered.find((c) => c.name === 'col2').field).toBe('2')
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

  test('onColumnFreezeChange reports the full frozen-name list via onFrozenColumnsChange', () => {
    const onFrozenColumnsChange = jest.fn()
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        onFrozenColumnsChange={onFrozenColumnsChange}
      />,
    )
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col1', true)
    wrapper.update()

    expect(onFrozenColumnsChange).toHaveBeenCalledWith(['col1'])
    wrapper.unmount()
  })

  test('a parent-driven initialColumnOrder/initialFrozenColumns change resyncs without a remount', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col0', true)
    wrapper.update()
    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(true)

    wrapper.setProps({ initialColumnOrder: ['col2', 'col1', 'col0'], initialFrozenColumns: [] })
    wrapper.update()

    expect(inst.columnOrder).toEqual(['col2', 'col1', 'col0'])
    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(false)
    wrapper.unmount()
  })
})

const customColumnResponse = {
  data: {
    data: {
      query_id: 'q1',
      text: 'test query',
      rows: [['a', 'b', 1, 5]],
      columns: [
        ...rawColumns,
        { id: 'c3', name: 'col3_custom', display_name: 'New Column', index: 3, is_visible: true, type: 'QUANTITY' },
      ],
      fe_req: {
        display_overrides: [{ english: 'New Column', table_column: 'col3_custom' }],
        additional_selects: [{ insertion: 'OPTIONAL', columns: ['col3_custom'] }],
      },
    },
  },
}

describe('QueryOutput frozen/order persistence across a fresh mount (e.g. dashboard tile save/reload)', () => {
  test('frozen seeds from initialFrozenColumns prop', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialFrozenColumns={['col1']}
      />,
    )
    const inst = wrapper.instance()
    expect(inst.state.columns.find((c) => c.name === 'col1').frozen).toBe(true)
    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(false)
    wrapper.unmount()
  })

  test('columnOrder seeds from initialColumnOrder prop', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialColumnOrder={['col2', 'col0', 'col1']}
      />,
    )
    const inst = wrapper.instance()
    expect(inst.getOrderedTableColumns().map((c) => c.name)).toEqual(['col2', 'col0', 'col1'])
    expect(inst.state.columns.map((c) => c.name)).toEqual(['col0', 'col1', 'col2'])
    wrapper.unmount()
  })

  test('a stale frozen name must not leak onto an unrelated column (different name) when the ' +
    'query changes without a remount', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialFrozenColumns={['col1']}
      />,
    )
    const inst = wrapper.instance()
    expect(inst.state.columns.find((c) => c.name === 'col1').frozen).toBe(true)

    // Simulate a brand new, unrelated query response landing in the same mounted instance
    // (e.g. user changes the query text but the component doesn't remount yet)
    const newQueryResponse = {
      data: {
        data: {
          query_id: 'q2-totally-different',
          text: 'a completely different query',
          rows: [['x', 'y', 'z']],
          columns: [
            { id: 'n0', name: 'new_col_a', display_name: 'New Col A', index: 0, is_visible: true, type: 'STRING' },
            { id: 'n1', name: 'new_col_b', display_name: 'New Col B', index: 1, is_visible: true, type: 'STRING' },
            { id: 'n2', name: 'new_col_c', display_name: 'New Col C', index: 2, is_visible: true, type: 'STRING' },
          ],
          fe_req: { display_overrides: [], additional_selects: [] },
        },
      },
    }

    inst.updateColumnsAndData(newQueryResponse)
    wrapper.update()

    expect(inst.state.columns.find((c) => c.name === 'new_col_b')?.frozen).toBeFalsy()
    wrapper.unmount()
  })
})

describe('QueryOutput frozen/order live interactions do not cross-contaminate sort/filter or each other', () => {
  test('freeze -> reorder: both apply, canonical order/index untouched', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col1', true)
    wrapper.update()
    inst.onColumnOrderChange(['col2', 'col0', 'col1'])
    wrapper.update()

    expect(inst.state.columns.map((c) => c.name)).toEqual(['col0', 'col1', 'col2'])
    expect(inst.state.columns.find((c) => c.name === 'col1').frozen).toBe(true)
    const ordered = inst.getOrderedTableColumns()
    expect(ordered.map((c) => c.name)).toEqual(['col2', 'col0', 'col1'])
    expect(ordered.find((c) => c.name === 'col1').frozen).toBe(true)
    expect(ordered.find((c) => c.name === 'col2').field).toBe('2')

    wrapper.unmount()
  })

  test('reorder -> freeze: both apply, canonical order/index untouched', () => {
    const wrapper = setup()
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col2', 'col1', 'col0'])
    wrapper.update()
    inst.onColumnFreezeChange('col0', true)
    wrapper.update()

    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(true)
    const ordered = inst.getOrderedTableColumns()
    expect(ordered.map((c) => c.name)).toEqual(['col2', 'col1', 'col0'])
    expect(ordered.find((c) => c.name === 'col0').frozen).toBe(true)

    wrapper.unmount()
  })

  test('freezing a column does not touch sorters/filters', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialFormattedTableParams={{
          filters: [{ field: '0', type: 'like', value: 'a' }],
          sorters: [{ field: '1', sort: 'DESC' }],
        }}
      />,
    )
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col2', true)
    wrapper.update()

    expect(inst.formattedTableParams.filters).toEqual([{ field: '0', type: 'like', value: 'a' }])
    expect(inst.formattedTableParams.sorters).toEqual([{ field: '1', sort: 'DESC' }])

    wrapper.unmount()
  })

  test('reordering columns does not touch sorters/filters', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialFormattedTableParams={{
          filters: [{ field: '0', type: 'like', value: 'a' }],
          sorters: [{ field: '1', sort: 'DESC' }],
        }}
      />,
    )
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col2', 'col0', 'col1'])
    wrapper.update()

    expect(inst.formattedTableParams.filters).toEqual([{ field: '0', type: 'like', value: 'a' }])
    expect(inst.formattedTableParams.sorters).toEqual([{ field: '1', sort: 'DESC' }])

    wrapper.unmount()
  })
})

describe('QueryOutput frozen/order interacting with custom columns', () => {
  test('a custom column can be frozen, matched by name, without corrupting its field/index', () => {
    const wrapper = mount(
      <QueryOutput authentication={{}} onTableConfigChange={jest.fn()} queryResponse={customColumnResponse} />,
    )
    const inst = wrapper.instance()

    inst.onColumnFreezeChange('col3_custom', true)
    wrapper.update()

    const custom = inst.state.columns.find((c) => c.name === 'col3_custom')
    expect(custom.frozen).toBe(true)
    expect(custom.field).toBe('3')
    wrapper.unmount()
  })

  test('a custom column can be reordered to the front and still resolves via getOrderedTableColumns', () => {
    const wrapper = mount(
      <QueryOutput authentication={{}} onTableConfigChange={jest.fn()} queryResponse={customColumnResponse} />,
    )
    const inst = wrapper.instance()

    inst.onColumnOrderChange(['col3_custom', 'col0', 'col1', 'col2'])
    wrapper.update()

    const ordered = inst.getOrderedTableColumns()
    expect(ordered.map((c) => c.name)).toEqual(['col3_custom', 'col0', 'col1', 'col2'])
    expect(ordered.find((c) => c.name === 'col3_custom').field).toBe('3')
    wrapper.unmount()
  })

  test('frozen custom column survives a fresh mount via initialFrozenColumns', () => {
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={customColumnResponse}
        initialFrozenColumns={['col3_custom']}
      />,
    )
    const inst = wrapper.instance()
    expect(inst.state.columns.find((c) => c.name === 'col3_custom').frozen).toBe(true)
    wrapper.unmount()
  })
})

describe('QueryOutput frozen state is independent of chart axis / column-type overrides', () => {
  test('changing a frozen column\'s axis type/isCyclical does not touch its frozen flag', () => {
    // frozen is tracked entirely separately from columnOverrides (type/precision/isCyclical), so an
    // axis/type change on the same column has no path to affect it.
    const wrapper = mount(
      <QueryOutput
        authentication={{}}
        onTableConfigChange={jest.fn()}
        queryResponse={queryResponse}
        initialFrozenColumns={['col0']}
      />,
    )
    const inst = wrapper.instance()
    inst.resetTableConfig(inst.state.columns)

    const newColumns = inst.state.columns.map((c) => (c.index === 0 ? { ...c, isCyclical: true } : c))
    inst.onChangeStringColumnIndex(0, newColumns)

    expect(inst.state.columns.find((c) => c.name === 'col0').frozen).toBe(true)
    wrapper.unmount()
  })
})
