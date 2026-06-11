import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../CustomColumnModal'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import { CustomColumnTypes } from 'autoql-fe-utils'

describe('CustomColumnModal column resolution', () => {
  it('inserts a custom column added in-modal as a single atomic reference', () => {
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.instance()

    const colA = {
      id: 'a',
      field: '2',
      name: 'col_a',
      display_name: 'Col A',
      table_column: 'col_a',
      custom: true,
    }
    inst.setState({ columns: [colA] })

    const colB = {
      id: 'b',
      field: '3',
      custom: true,
      columnFnArray: [
        {
          type: CustomColumnTypes.COLUMN,
          value: '99', // stale field value
          column: { name: 'col_a', table_column: 'col_a' },
        },
      ],
    }

    const columnFn = []
    inst.addColumnToFormula(colB, columnFn, null)

    // colB is a custom column — inserted as a single COLUMN reference, not de-wrapped
    const colTokens = columnFn.filter((t) => t.type === CustomColumnTypes.COLUMN)
    expect(colTokens).toHaveLength(1)
    expect(colTokens[0].value).toBe('3')
    expect(colTokens[0].column).toBe(colB)

    wrapper.unmount()
  })

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
    const newCol = {
      field: String(initialColumns.length),
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

    const mismatchedChunk = { type: CustomColumnTypes.COLUMN, value: '0', column: newCol }
    const el = inst.renderAvailableColumnSelector(mismatchedChunk, 0)

    expect(el).toBeTruthy()
    expect(String(el.props.value)).toBe(String(newCol.field))
    wrapper.unmount()
  })

  it('matches fields regardless of number/string type (normalizes comparison)', () => {
    const columns = [
      { field: 0, title: 'A', display_name: 'A', is_visible: true, name: 'A' },
      { field: 'uuid-1', title: 'B', display_name: 'B', is_visible: true, name: 'B' },
    ]
    const wrapper = mount(<CustomColumnModal isOpen={true} columns={columns} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.find('CustomColumnModal').first().instance()

    const el1 = inst.renderAvailableColumnSelector({ type: CustomColumnTypes.COLUMN, value: '0', column: columns[0] }, 0)
    expect(String(el1.props.value)).toBe(String(columns[0].field))

    const el2 = inst.renderAvailableColumnSelector({ type: CustomColumnTypes.COLUMN, value: 0, column: columns[0] }, 0)
    expect(String(el2.props.value)).toBe(String(columns[0].field))
    wrapper.unmount()
  })

  it('falls back to first matching column when multiple columns share identical table_column', () => {
    const sharedSql = '(A + B)'
    const col1 = { field: 'c1', title: 'C1', display_name: 'C1', is_visible: true, name: 'c1', table_column: sharedSql }
    const col2 = { field: 'c2', title: 'C2', display_name: 'C2', is_visible: true, name: 'c2', table_column: sharedSql }

    const wrapper = mount(<CustomColumnModal isOpen={true} columns={[col1, col2]} queryResponse={{ data: { data: {} } }} />)
    const inst = wrapper.find('CustomColumnModal').first().instance()

    const el = inst.renderAvailableColumnSelector({ type: CustomColumnTypes.COLUMN, value: 'unknown', column: { table_column: sharedSql } }, 0)
    expect(el).toBeTruthy()
    expect(String(el.props.value)).toBe(String(col1.field))
    wrapper.unmount()
  })
})

describe('CustomColumnModal display_overrides helpers', () => {
  it('deduplicates overrides by normalized SQL signature', () => {
    const qo = new QueryOutput({})
    const firstOverride = { name: 'A', display_name: 'Alpha', table_column: 'A' }
    const secondOverride = { name: 'A', display_name: 'Alpha', table_column: ' A ' }

    const keys = [firstOverride, secondOverride].map((o) => qo.normalizeSqlForOverrideMatch(o.table_column))
    expect([...new Set(keys)].length).toBe(1)
  })

  it('normalizes display_override table_column for signature', () => {
    const qo = new QueryOutput({})
    const sig = qo.normalizeSqlForOverrideMatch('tot')
    expect(sig).toContain('tot')
  })

  it('applyDisplayOverridesToResponse returns original response when overrides are invalid', () => {
    const qo = new QueryOutput({})
    const response = { data: { data: { columns: [{ name: 'A' }], fe_req: { display_overrides: null } } } }
    const next = qo.applyDisplayOverridesToResponse(response, response.data.data.fe_req.display_overrides)
    expect(next).toBe(response)
  })
})
