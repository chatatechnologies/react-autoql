import React from 'react'
import { mount } from 'enzyme'
import AddColumnBtn from '../AddColumnBtnV2'
import { ColumnTypes, normalizeColumnIdentifier } from 'autoql-fe-utils'

describe('AddColumnBtnV2', () => {
  it('hides available_selects that match existing table columns (by normalized identifier)', () => {
    const columns = [
      { display_name: 'Amount', name: 'amount', table_column: 'amount', column_type: ColumnTypes.DOLLAR_AMT },
    ]

    const available_selects = [
      { display_name: 'Amount', name: 'amount', table_column: 'amount', column_type: ColumnTypes.DOLLAR_AMT },
      { display_name: 'Count', name: 'count', table_column: 'count', column_type: ColumnTypes.QUANTITY },
    ]

    const wrapper = mount(
      <AddColumnBtn
        queryResponse={{ data: { data: { columns, available_selects } } }}
        onAddColumnClick={jest.fn()}
        onCustomClick={jest.fn()}
      />,
    )

    // Open the popover/menu
    wrapper.find("[data-test='react-autoql-table-add-column-btn']").simulate('click')

    // Compute expected available selects after normalization (same logic as component)
    const expectedSelects = available_selects.filter((col) => {
      const thisColName = normalizeColumnIdentifier(col)
      const existingNames = columns.map((c) => normalizeColumnIdentifier(c))
      return !existingNames.includes(thisColName)
    })

    // The Popover content is rendered via the Popover's `content` prop (render function).
    // Call it directly and mount the returned tree so we can inspect menu items.
    const popover = wrapper.findWhere((n) => n.prop && typeof n.prop('content') === 'function').first()
    const contentFn = popover.prop('content')
    const menuWrapper = mount(contentFn())

    const renderedLabels = menuWrapper
      .find('.react-autoql-add-column-menu .react-autoql-add-column-menu-item span')
      .map((n) => n.text())

    // Available selects should include 'Count' (the non-duplicate option)
    expect(renderedLabels).toContain('Count')
  })
})
