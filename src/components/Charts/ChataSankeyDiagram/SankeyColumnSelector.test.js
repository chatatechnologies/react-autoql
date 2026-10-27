import React from 'react'
import { mount } from 'enzyme'
import SankeyColumnSelector from './SankeyColumnSelector'
import { SANKEY_VALUE_COUNT_SENTINEL } from '../chartPropHelpers'

const columns = [
  { name: 'region', display_name: 'Region' },
  { name: 'sales', display_name: 'Sales', isNumberType: true },
  { name: 'cost', display_name: 'Cost', isNumberType: true },
]

const setup = (props = {}) =>
  mount(
    <svg>
      <SankeyColumnSelector
        columns={columns}
        type='path'
        showDropdown
        setShowDropdown={() => {}}
        minPathColumns={1}
        {...props}
      />
    </svg>,
  )

const getAddableNames = (wrapper) =>
  wrapper.find('.sankey-column-dropdown-container .sankey-column-dropdown-item').map((item) => item.text())

describe('SankeyColumnSelector path mode', () => {
  test('offers Count only when the sentinel is a path option', () => {
    expect(getAddableNames(setup({ pathColumnIndices: [1], pathColumnOptionIndices: [1, 2] }))).toEqual(['Cost'])
    expect(
      getAddableNames(setup({ pathColumnIndices: [1], pathColumnOptionIndices: [SANKEY_VALUE_COUNT_SENTINEL, 1, 2] })),
    ).toEqual(['Count', 'Cost'])
  })

  test('adds Count as a path column', () => {
    const onPathChange = jest.fn()
    const wrapper = setup({
      pathColumnIndices: [1],
      pathColumnOptionIndices: [SANKEY_VALUE_COUNT_SENTINEL, 1, 2],
      onPathChange,
    })
    wrapper.find('.sankey-column-dropdown-container .sankey-column-dropdown-item').first().simulate('click')
    expect(onPathChange).toHaveBeenCalledWith([1, SANKEY_VALUE_COUNT_SENTINEL])
  })

  test('shows a selected Count in the selected list', () => {
    const wrapper = setup({
      pathColumnIndices: [SANKEY_VALUE_COUNT_SENTINEL],
      pathColumnOptionIndices: [SANKEY_VALUE_COUNT_SENTINEL, 1, 2],
    })
    expect(wrapper.find('.sankey-path-selected-item')).toHaveLength(1)
  })

  test('a single-column pick is a plain list that replaces the pick', () => {
    const onPathChange = jest.fn()
    const wrapper = setup({ pathColumnIndices: [1], pathColumnOptionIndices: [1, 2], maxPathColumns: 1, onPathChange })
    expect(wrapper.find('.sankey-path-add-title').exists()).toBe(false)
    const items = wrapper.find('.sankey-column-dropdown-item')
    expect(items.map((item) => item.text())).toEqual(['Sales', 'Cost'])
    expect(items.first().hasClass('sankey-column-dropdown-item-selected')).toBe(true)
    items.last().simulate('click')
    expect(onPathChange).toHaveBeenCalledWith([2])
  })

  test('disabled options in a single-column pick explain why and do nothing', () => {
    const onPathChange = jest.fn()
    const wrapper = setup({
      pathColumnIndices: [1],
      pathColumnOptionIndices: [1, 2],
      maxPathColumns: 1,
      disabledPathColumnIndices: [2],
      disabledPathColumnTooltip: 'Only one value',
      onPathChange,
    })
    const disabled = wrapper.find('.sankey-column-dropdown-item').last()
    expect(disabled.hasClass('sankey-column-dropdown-item-disabled')).toBe(true)
    expect(disabled.prop('data-tooltip-content')).toBe('Only one value')
    disabled.simulate('click')
    expect(onPathChange).not.toHaveBeenCalled()
  })

  test('does nothing when a multi-column path is full', () => {
    const onPathChange = jest.fn()
    const wrapper = setup({
      pathColumnIndices: [0, 1],
      pathColumnOptionIndices: [0, 1, 2],
      maxPathColumns: 2,
      onPathChange,
    })
    wrapper.find('.sankey-column-dropdown-container .sankey-column-dropdown-item').first().simulate('click')
    expect(onPathChange).not.toHaveBeenCalled()
  })

  test('a full path says so, and shows the other columns as disabled with the reason', () => {
    const wrapper = setup({
      pathColumnIndices: [0, 1],
      pathColumnOptionIndices: [0, 1, 2],
      maxPathColumns: 2,
      chartTooltipID: 'chart-tooltip',
    })
    expect(wrapper.find('.sankey-path-add-title').text()).toBe('Add column (2 of 2)')
    expect(wrapper.find('.sankey-path-limit-notice').text()).toBe(
      'Maximum of 2 columns reached. Remove one to add another.',
    )
    const item = wrapper.find('.sankey-column-dropdown-container .sankey-column-dropdown-item').first()
    expect(item.hasClass('sankey-column-dropdown-item-disabled')).toBe(true)
    expect(item.prop('data-tooltip-id')).toBe('chart-tooltip')
    expect(item.prop('data-tooltip-content')).toBe('Maximum of 2 columns reached')
  })

  test('a path with room has no limit notice and enabled columns', () => {
    const wrapper = setup({ pathColumnIndices: [0], pathColumnOptionIndices: [0, 1, 2], maxPathColumns: 2 })
    expect(wrapper.find('.sankey-path-add-title').text()).toBe('Add column (1 of 2)')
    expect(wrapper.find('.sankey-path-limit-notice').exists()).toBe(false)
    const item = wrapper.find('.sankey-column-dropdown-container .sankey-column-dropdown-item').first()
    expect(item.hasClass('sankey-column-dropdown-item-disabled')).toBe(false)
  })
})

describe('SankeyColumnSelector popover clicks', () => {
  // Charts close their dropdowns when clicked, so a click inside the popover (eg. picking from a nested
  // Select) must not reach the chart, or it closes the popover mid-edit
  test.each([
    ['path', { pathColumnIndices: [1], pathColumnOptionIndices: [1, 2] }, '.sankey-path-dropdown-popover-content'],
    [
      'single column',
      { pathColumnIndices: [1], pathColumnOptionIndices: [1, 2], maxPathColumns: 1 },
      '.sankey-column-dropdown-popover-content',
    ],
    ['value', { type: 'value', selectedIndex: 1 }, '.sankey-column-dropdown-popover-content'],
  ])('a click inside the %s popover does not reach the chart', (_, props, contentSelector) => {
    const onChartClick = jest.fn()
    const wrapper = mount(
      <svg>
        <g onClick={onChartClick}>
          <SankeyColumnSelector columns={columns} type='path' showDropdown setShowDropdown={() => {}} {...props} />
        </g>
      </svg>,
    )
    wrapper.find(contentSelector).first().simulate('click')
    expect(onChartClick).not.toHaveBeenCalled()
  })
})
