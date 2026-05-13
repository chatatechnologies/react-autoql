import React from 'react'
import { mount } from 'enzyme'
import CustomColumnModal from '../../AddColumnBtn/CustomColumnModal'
import { CustomColumnTypes } from 'autoql-fe-utils'

describe('CustomColumnModal - modal-state reference resolution', () => {
  it('resolves references to columns added in-modal', () => {
    const wrapper = mount(
      <CustomColumnModal isOpen={true} columns={[]} queryResponse={{ data: { data: {} } }} />,
    )
    const inst = wrapper.instance()

    // Add a column into modal state (represents a newly-created in-session custom column)
    const colA = {
      id: 'a',
      field: '2',
      name: 'col_a',
      display_name: 'Col A',
      table_column: 'col_a',
      custom: true,
    }
    inst.setState({ columns: [colA] })

    // colB was authored to reference colA but holds a stale field value '99'
    const colB = {
      id: 'b',
      field: '3',
      custom: true,
      columnFnArray: [
        {
          type: CustomColumnTypes.COLUMN,
          value: '99', // stale
          column: { name: 'col_a', table_column: 'col_a' }, // identifies colA
        },
      ],
    }

    const columnFn = []
    inst.addColumnToFormula(colB, columnFn, null)

    const colTokens = columnFn.filter((t) => t.type === CustomColumnTypes.COLUMN)
    expect(colTokens).toHaveLength(1)
    expect(colTokens[0].value).toBe('2') // resolved to colA.field
    expect(colTokens[0].column.id).toBe('a')
    expect(colTokens[0].column.field).toBe('2')

    wrapper.unmount()
  })
})
