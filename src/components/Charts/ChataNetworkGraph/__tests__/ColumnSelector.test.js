import React from 'react'
import { shallow } from 'enzyme'
import ColumnSelector from '../ColumnSelector'

const defaultProps = {
  columns: [],
  selectedSourceColumnIndex: null,
  selectedTargetColumnIndex: null,
  selectedAmountColumnIndex: null,
  setSelectedSourceColumnIndex: () => {},
  setSelectedTargetColumnIndex: () => {},
  setSelectedAmountColumnIndex: () => {},
  showSourceDropdown: false,
  showTargetDropdown: false,
  showAmountDropdown: false,
  setShowSourceDropdown: () => {},
  setShowTargetDropdown: () => {},
  setShowAmountDropdown: () => {},
  setShowFilterDropdown: () => {},
  popoverParentElement: typeof document !== 'undefined' ? document.body : null,
  chartTooltipID: 'tooltip',
  buttonX: 0,
  sourceButtonY: 0,
  targetButtonY: 0,
  amountButtonY: 0,
  buttonSize: 24,
}

describe('ColumnSelector defaults', () => {
  test('uses first string column when only one string column exists (no wrong second-column selection)', () => {
    const columns = [
      { type: 'STRING', name: 'Name', display_name: 'Name' },
      { type: 'NUMBER', name: 'Amount', display_name: 'Amount' },
    ]

    const props = { ...defaultProps, columns }
    const wrapper = shallow(<ColumnSelector {...props} />)

    const targetRect = wrapper.find('.target-button-rect')
    expect(targetRect.exists()).toBe(true)
    const tooltip = targetRect.prop('data-tooltip-html')
    // should reference the only string column 'Name'
    expect(tooltip).toContain('Name')
  })
})
