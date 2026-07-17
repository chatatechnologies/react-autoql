import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../test/testUtils'
import Chip from './Chip'

const setup = (props = {}) => {
  return shallow(<Chip {...props} />)
}

describe('Chip', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const wrapper = setup()
      const chip = findByTestAttr(wrapper, 'react-autoql-chip')
      expect(chip.exists()).toBe(true)
    })

    test('renders children', () => {
      const wrapper = shallow(<Chip>Test Label</Chip>)
      expect(wrapper.find('.react-autoql-chip-content').text()).toContain('Test Label')
    })

    test('applies selected class when selected=true', () => {
      const wrapper = setup({ selected: true })
      const chip = findByTestAttr(wrapper, 'react-autoql-chip')
      expect(chip.hasClass('selected')).toBe(true)
    })

    test('does not apply selected class when selected=false', () => {
      const wrapper = setup({ selected: false })
      const chip = findByTestAttr(wrapper, 'react-autoql-chip')
      expect(chip.hasClass('selected')).toBe(false)
    })

    test('applies disabled class when disabled=true', () => {
      const wrapper = setup({ disabled: true })
      const chip = findByTestAttr(wrapper, 'react-autoql-chip')
      expect(chip.hasClass('disabled')).toBe(true)
    })

    test('does not render delete button when onDelete is not provided', () => {
      const wrapper = setup()
      expect(wrapper.find('.react-autoql-chip-delete-btn').exists()).toBe(false)
    })

    test('renders delete button when onDelete is provided', () => {
      const wrapper = setup({ onDelete: jest.fn() })
      expect(wrapper.find('.react-autoql-chip-delete-btn').exists()).toBe(true)
    })

    test('renders ConfirmPopover when confirmDelete=true', () => {
      const wrapper = setup({ onDelete: jest.fn(), confirmDelete: true })
      expect(wrapper.find('ConfirmPopover').exists()).toBe(true)
    })

    test('does not render ConfirmPopover when confirmDelete=false', () => {
      const wrapper = setup({ onDelete: jest.fn(), confirmDelete: false })
      expect(wrapper.find('ConfirmPopover').exists()).toBe(false)
    })
  })

  describe('interaction', () => {
    test('calls onClick when chip is clicked', () => {
      const onClick = jest.fn()
      const wrapper = setup({ onClick })
      findByTestAttr(wrapper, 'react-autoql-chip').simulate('click')
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('calls onDelete when delete button is clicked', () => {
      const onDelete = jest.fn()
      const wrapper = setup({ onDelete, confirmDelete: false })
      wrapper.find('.react-autoql-chip-delete-btn').simulate('click')
      expect(onDelete).toHaveBeenCalledTimes(1)
    })
  })
})
