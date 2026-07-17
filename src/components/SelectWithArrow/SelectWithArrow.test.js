import React from 'react'
import { shallow } from 'enzyme'
import ReactSelect from 'react-select'
import Select from './SelectWithArrow'

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

const setup = (props = {}) => {
  return shallow(<Select {...props} />)
}

describe('SelectWithArrow', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup({ options })
      expect(wrapper.find(ReactSelect).exists()).toBe(true)
    })

    test('returns null when options prop is null', () => {
      const wrapper = setup({ options: null })
      expect(wrapper.type()).toBeNull()
    })

    test('passes options to ReactSelect', () => {
      const wrapper = setup({ options })
      expect(wrapper.find(ReactSelect).prop('options')).toEqual(options)
    })

    test('applies custom className to ReactSelect', () => {
      const wrapper = setup({ options, className: 'my-select' })
      expect(wrapper.find(ReactSelect).prop('className')).toContain('my-select')
    })

    test('always includes react-autoql-select-with-arrow className', () => {
      const wrapper = setup({ options })
      expect(wrapper.find(ReactSelect).prop('className')).toContain('react-autoql-select-with-arrow')
    })

    test('initializes selected state from selectedOption prop', () => {
      const selectedOption = options[1]
      const wrapper = setup({ options, selectedOption })
      expect(wrapper.instance().state.selected).toEqual(selectedOption)
    })

    test('passes selected state as value to ReactSelect', () => {
      const selectedOption = options[0]
      const wrapper = setup({ options, selectedOption })
      expect(wrapper.find(ReactSelect).prop('value')).toEqual(selectedOption)
    })
  })

  describe('interaction', () => {
    test('calls onChange when a selection is made', () => {
      const onChange = jest.fn()
      const wrapper = setup({ options, onChange })
      wrapper.find(ReactSelect).prop('onChange')(options[0])
      expect(onChange).toHaveBeenCalledWith(options[0])
    })

    test('updates state.selected when a selection is made', () => {
      const wrapper = setup({ options })
      wrapper.find(ReactSelect).prop('onChange')(options[2])
      expect(wrapper.instance().state.selected).toEqual(options[2])
    })

    test('does not call onChange when it is undefined', () => {
      const wrapper = setup({ options, onChange: undefined })
      // should not throw
      expect(() => wrapper.find(ReactSelect).prop('onChange')(options[0])).not.toThrow()
    })
  })
})
