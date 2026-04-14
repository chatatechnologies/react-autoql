import React from 'react'
import { mount } from 'enzyme'

import CustomColumnModal from '../CustomColumnModal'
import { CustomColumnTypes } from 'autoql-fe-utils'

describe('CustomColumnModal fallback resolution edge cases', () => {
  it('resolves column when parent assigned numeric field after add (fallback by table_column)', () => {
    const initialColumns = [
      {
        field: '0',
        title: 'Total Sales',
        display_name: 'Total Sales',
        is_visible: true,
        name: 'sum_sales',
        table_column: 'sum(public.all_sales_fact.sales_dollar_amount)',
      },
    ]

    // Simulate parent-assigned new column (field reassigned to numeric index)
    const newCol = {
      field: String(initialColumns.length), // '1'
      title: 'New Column',
      display_name: 'New Column',
      is_visible: true,
      name: 'new_col',
      table_column: '((sum(public.all_sales_fact.sales_dollar_amount))/100)',
    }

    const wrapper = mount(
      <CustomColumnModal isOpen={true} columns={[...initialColumns, newCol]} queryResponse={{ data: { data: {} } }} />,
    )
    const inst = wrapper.find('CustomColumnModal').first().instance()

    // Mismatched chunk: value '0' but chunk.column points to newCol (parent may have reassigned field)
    const mismatchedChunk = { type: CustomColumnTypes.COLUMN, value: '0', column: newCol }
    const el = inst.renderAvailableColumnSelector(mismatchedChunk, 0)

    expect(el).toBeTruthy()
    expect(String(el.props.value)).toBe(String(newCol.field))
  })

  it('matches fields regardless of number/string types (normalizes comparison)', () => {
    const columns = [
      { field: 0, title: 'A', display_name: 'A', is_visible: true, name: 'A' },
      { field: 'uuid-1', title: 'B', display_name: 'B', is_visible: true, name: 'B' },
    ]

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.find('CustomColumnModal').first().instance()

    const chunkStringZero = { type: CustomColumnTypes.COLUMN, value: '0', column: columns[0] }
    const el1 = inst.renderAvailableColumnSelector(chunkStringZero, 0)
    expect(String(el1.props.value)).toBe(String(columns[0].field))

    const chunkNumberZero = { type: CustomColumnTypes.COLUMN, value: 0, column: columns[0] }
    const el2 = inst.renderAvailableColumnSelector(chunkNumberZero, 0)
    expect(String(el2.props.value)).toBe(String(columns[0].field))
  })

  it('falls back to first matching column when multiple columns share identical table_column', () => {
    const sharedSql = '(A + B)'
    const col1 = { field: 'c1', title: 'C1', display_name: 'C1', is_visible: true, name: 'c1', table_column: sharedSql }
    const col2 = { field: 'c2', title: 'C2', display_name: 'C2', is_visible: true, name: 'c2', table_column: sharedSql }

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[col1, col2]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.find('CustomColumnModal').first().instance()

    // chunk references the SQL via chunk.column.table_column; resolver should pick first matching column
    const chunk = { type: CustomColumnTypes.COLUMN, value: 'unknown', column: { table_column: sharedSql } }
    const el = inst.renderAvailableColumnSelector(chunk, 0)
    expect(el).toBeTruthy()
    expect(String(el.props.value)).toBe(String(col1.field))
  })
})
