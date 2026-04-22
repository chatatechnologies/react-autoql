import React from 'react'
import { mount } from 'enzyme'
import ChartHeaderToggle from '../../ChartHeaderToggle/ChartHeaderToggle'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

describe('ChartHeaderToggle (Average)', () => {
  const defaultProps = {
    isEnabled: false,
    onToggle: jest.fn(),
    disabled: false,
    chartTooltipID: 'test-tooltip',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly when disabled', () => {
    const wrapper = mount(
      <ChartHeaderToggle
        {...defaultProps}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    expect(wrapper.find('button')).toHaveLength(1)
    // When isEnabled: false and disabled: false, should have neither class
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
    expect(wrapper.find('button').hasClass('enabled')).toBe(false)
  })

  it('renders correctly when enabled', () => {
    const props = { ...defaultProps, isEnabled: true }
    const wrapper = mount(
      <ChartHeaderToggle
        {...props}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    expect(wrapper.find('button').hasClass('enabled')).toBe(true)
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
  })

  it('calls onToggle when clicked', () => {
    const wrapper = mount(
      <ChartHeaderToggle
        {...defaultProps}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    wrapper.find('button').simulate('click')

    expect(defaultProps.onToggle).toHaveBeenCalledWith(true)
  })

  it('does not call onToggle when disabled', () => {
    const props = { ...defaultProps, disabled: true }
    const wrapper = mount(
      <ChartHeaderToggle
        {...props}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    wrapper.find('button').simulate('click')

    expect(defaultProps.onToggle).not.toHaveBeenCalled()
  })

  it('shows correct tooltip content', () => {
    const wrapper = mount(
      <ChartHeaderToggle
        {...defaultProps}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    const tooltipContent = wrapper.find('button').prop('data-tooltip-content')
    expect(tooltipContent).toBe('Show Average Line')
  })

  it('shows different tooltip content when enabled', () => {
    const props = { ...defaultProps, isEnabled: true }
    const wrapper = mount(
      <ChartHeaderToggle
        {...props}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    const tooltipContent = wrapper.find('button').prop('data-tooltip-content')
    expect(tooltipContent).toBe('Hide Average Line')
  })

  it('allows button when all columns have same type', () => {
    const wrapper = mount(
      <ChartHeaderToggle
        {...defaultProps}
        icon='↗'
        label='Average'
        tooltipOn='Hide Average Line'
        tooltipOff='Show Average Line'
      />,
    )

    expect(wrapper.find('button').prop('disabled')).toBe(false)
    expect(wrapper.find('button').hasClass('disabled')).toBe(false)
  })
})
