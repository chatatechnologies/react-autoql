import React from 'react'
import { shallow } from 'enzyme'
import MultiSelect from './MultiSelect'

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' },
]

const setup = (props = {}) => {
  return shallow(<MultiSelect {...{ options, selected: [], ...props }} />)
}

describe('MultiSelect', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      expect(wrapper.exists()).toBe(true)
    })

    test('returns null when options prop is null', () => {
      const wrapper = setup({ options: null })
      expect(wrapper.type()).toBeNull()
    })

    test('shows badge count when items are selected and showBadge=true', () => {
      const wrapper = setup({ selected: ['opt1', 'opt2'], showBadge: true })
      expect(wrapper.find('.react-autoql-multi-select-badge').exists()).toBe(true)
    })

    test('does not show badge when showBadge=false', () => {
      const wrapper = setup({ selected: ['opt1'], showBadge: false })
      expect(wrapper.find('.react-autoql-multi-select-badge').exists()).toBe(false)
    })

    test('does not show badge when nothing is selected', () => {
      const wrapper = setup({ selected: [], showBadge: true })
      expect(wrapper.find('.react-autoql-multi-select-badge').exists()).toBe(false)
    })

    test('renders label when provided', () => {
      const wrapper = setup({ label: 'My Label' })
      expect(wrapper.find('.react-autoql-input-label').text()).toBe('My Label')
    })

    test('does not render label element when label not provided', () => {
      const wrapper = setup({ label: null })
      expect(wrapper.find('.react-autoql-input-label').exists()).toBe(false)
    })

    test('starts with popover closed', () => {
      const wrapper = setup()
      expect(wrapper.instance().state.isOpen).toBe(false)
    })
  })

  describe('onItemClick', () => {
    test('adds item to selection when not currently selected', () => {
      const onChange = jest.fn()
      const wrapper = setup({ selected: ['opt1'], onChange })
      wrapper.instance().onItemClick({ value: 'opt2' })
      expect(onChange).toHaveBeenCalledWith(['opt1', 'opt2'])
    })

    test('removes item from selection when already selected', () => {
      const onChange = jest.fn()
      const wrapper = setup({ selected: ['opt1', 'opt2'], onChange })
      wrapper.instance().onItemClick({ value: 'opt1' })
      expect(onChange).toHaveBeenCalledWith(['opt2'])
    })

    test('handles empty selection correctly', () => {
      const onChange = jest.fn()
      const wrapper = setup({ selected: [], onChange })
      wrapper.instance().onItemClick({ value: 'opt3' })
      expect(onChange).toHaveBeenCalledWith(['opt3'])
    })
  })
})
