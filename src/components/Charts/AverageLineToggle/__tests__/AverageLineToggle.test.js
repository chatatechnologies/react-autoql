import React from 'react'
import { mount } from 'enzyme'
import AverageLineToggle from '../AverageLineToggle'

describe('AverageLineToggle', () => {
  const defaultProps = {
    isEnabled: false,
    onToggle: jest.fn(),
    isEditing: false,
    disabled: false,
    columns: [
      { name: 'Category', type: 'STRING' },
      { name: 'Value', type: 'NUMBER' },
    ],
    visibleSeriesIndices: [1],
    chartTooltipID: 'test-tooltip',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly when disabled', () => {
    const wrapper = mount(<AverageLineToggle {...defaultProps} />)

    expect(wrapper.find('button')).toHaveLength(1)
    // When isEnabled: false and disabled: false, should have neither class
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
    expect(wrapper.find('button').hasClass('enabled')).toBe(false)
  })

  it('renders correctly when enabled', () => {
    const props = { ...defaultProps, isEnabled: true }
    const wrapper = mount(<AverageLineToggle {...props} />)

    expect(wrapper.find('button').hasClass('enabled')).toBe(true)
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
  })

  it('calls onToggle when clicked', () => {
    const wrapper = mount(<AverageLineToggle {...defaultProps} />)

    wrapper.find('button').simulate('click')

    expect(defaultProps.onToggle).toHaveBeenCalledWith(true)
  })

  it('does not call onToggle when disabled', () => {
    const props = { ...defaultProps, disabled: true }
    const wrapper = mount(<AverageLineToggle {...props} />)

    wrapper.find('button').simulate('click')

    expect(defaultProps.onToggle).not.toHaveBeenCalled()
  })

  it('shows correct tooltip content', () => {
    const wrapper = mount(<AverageLineToggle {...defaultProps} />)

    const tooltipContent = wrapper.find('button').prop('data-tooltip-content')
    expect(tooltipContent).toBe('Show Average Line')
  })

  it('shows different tooltip content when enabled', () => {
    const props = { ...defaultProps, isEnabled: true }
    const wrapper = mount(<AverageLineToggle {...props} />)

    const tooltipContent = wrapper.find('button').prop('data-tooltip-content')
    expect(tooltipContent).toBe('Hide Average Line')
  })

  it('disables button and shows warning when mixed column types', () => {
    const mockColumns = [
      { name: 'Category', type: 'STRING' },
      { name: 'Revenue', type: 'CURRENCY' },
      { name: 'Count', type: 'NUMBER' },
    ]

    const props = {
      ...defaultProps,
      columns: mockColumns,
      visibleSeriesIndices: [1, 2], // Currency and Number types
    }

    const wrapper = mount(<AverageLineToggle {...props} />)

    // Button should be disabled
    expect(wrapper.find('button').prop('disabled')).toBe(true)
    expect(wrapper.find('button').hasClass('disabled')).toBe(true)

    // Tooltip should show warning
    const tooltipContent = wrapper.find('button').prop('data-tooltip-content')
    expect(tooltipContent).toBe(
      'Cannot show average line when chart has series with different data types (e.g., currency and quantity)',
    )
  })

  it('allows button when all columns have same type', () => {
    const mockColumns = [
      { name: 'Category', type: 'STRING' },
      { name: 'Revenue', type: 'CURRENCY' },
      { name: 'Sales', type: 'CURRENCY' },
    ]

    const props = {
      ...defaultProps,
      columns: mockColumns,
      visibleSeriesIndices: [1, 2], // Both Currency types
    }

    const wrapper = mount(<AverageLineToggle {...props} />)

    // Button should not be disabled
    expect(wrapper.find('button').prop('disabled')).toBe(false)
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
  })
})
