import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import Switch from './Switch'

const setup = (props = {}) => {
  return shallow(<Switch {...props} />)
}

describe('Switch', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      const container = findByTestAttr(wrapper, 'react-autoql-switch-container')
      expect(container.exists()).toBe(true)
    })

    test('renders with checked=true class', () => {
      const wrapper = setup({ checked: true })
      const container = findByTestAttr(wrapper, 'react-autoql-switch-container')
      expect(container.hasClass('react-autoql-switch-container-checked')).toBe(true)
    })

    test('renders with checked=false class', () => {
      const wrapper = setup({ checked: false })
      const container = findByTestAttr(wrapper, 'react-autoql-switch-container')
      expect(container.hasClass('react-autoql-switch-container-unchecked')).toBe(true)
    })

    test('renders disabled class when disabled=true', () => {
      const wrapper = setup({ disabled: true })
      const container = findByTestAttr(wrapper, 'react-autoql-switch-container')
      expect(container.hasClass('react-autoql-switch-disabled')).toBe(true)
    })

    test('does not render disabled class when disabled=false', () => {
      const wrapper = setup({ disabled: false })
      const container = findByTestAttr(wrapper, 'react-autoql-switch-container')
      expect(container.hasClass('react-autoql-switch-disabled')).toBe(false)
    })

    test('renders onText when checked is true', () => {
      const wrapper = setup({ checked: true, onText: 'ON', offText: 'OFF' })
      expect(wrapper.find('.toggle-switch-text').text()).toBe('ON')
    })

    test('renders offText when checked is false', () => {
      const wrapper = setup({ checked: false, onText: 'ON', offText: 'OFF' })
      expect(wrapper.find('.toggle-switch-text').text()).toBe('OFF')
    })

    test('does not render switch text when displaySwitchText=false', () => {
      const wrapper = setup({ checked: true, onText: 'ON', displaySwitchText: false })
      expect(wrapper.find('.toggle-switch-text').text()).toBe('')
    })
  })

  describe('interaction', () => {
    test('calls onChange with true when toggled from unchecked', () => {
      const onChange = jest.fn()
      const wrapper = setup({ checked: false, onChange })
      const input = wrapper.find("[data-test='react-autoql-switch']")
      input.simulate('change')
      expect(onChange).toHaveBeenCalledWith(true)
    })

    test('calls onChange with false when toggled from checked', () => {
      const onChange = jest.fn()
      const wrapper = setup({ checked: true, onChange })
      const input = wrapper.find("[data-test='react-autoql-switch']")
      input.simulate('change')
      expect(onChange).toHaveBeenCalledWith(false)
    })

    test('input has correct checked value', () => {
      const wrapper = setup({ checked: true })
      const input = wrapper.find("[data-test='react-autoql-switch']")
      expect(input.prop('checked')).toBe(true)
    })

    test('input is disabled when disabled=true', () => {
      const wrapper = setup({ disabled: true })
      const input = wrapper.find("[data-test='react-autoql-switch']")
      expect(input.prop('disabled')).toBe(true)
    })
  })
})
