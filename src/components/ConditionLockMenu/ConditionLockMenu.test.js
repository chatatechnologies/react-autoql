import React from 'react'
import { shallow, mount } from 'enzyme'

import { checkProps } from '../../../test/testUtils'
import { ConditionLockMenu } from './' 

const defaultProps = {
  containerWidth: '500px',
  onClose: () => {},
  isOpen: false,
  initFilterText: undefined,
  authentication: {
    apiKey: 'test-apikey',
  },
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ConditionLockMenu {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    const wrapper = shallow(
      <ConditionLockMenu authentication={{ token: 'token' }} />
    )
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
})

describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(ConditionLockMenu, defaultProps)
  })
  
  describe('containerWidth', () => {
    test('containerWidth is applied', () => {
      const html = mount(<ConditionLockMenu containerWidth={"500px"} />)
      const menu = html.find('#react-autoql-filter-menu')
      expect(menu.exists()).toBe(false)
    })
    test('renders correctly with containerWidth', () => {
      const wrapper = setup({ containerWidth: "500px" })
      expect(wrapper.instance().props.containerWidth).toBe("500px")
    })
    test('renders correctly without containerWidth', () => {
      const wrapper = setup({ containerWidth: undefined })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('isOpen', () => {
    test('renders correctly with isOpen false', () => {
      const wrapper = setup({ isOpen: false })
      expect(wrapper.instance().props.isOpen).toBe(false)
    })
    test('renders correctly with isOpen true', () => {
      const wrapper = setup({ isOpen: true })
      expect(wrapper.instance().props.isOpen).toBe(true)
    })
  })
  
  describe('initFilterText', () => {
    test('renders correctly with initFilterText', () => {
      const wrapper = setup({ isOpen: true, initFilterText: "asdsdfsd" })
      expect(wrapper.instance().props.initFilterText).toEqual("asdsdfsd")
    })
    test('renders correctly with initFilterText undefined', () => {
      const wrapper = setup({ isOpen: true })
      expect(wrapper.instance().props.initFilterText).toEqual(undefined)
    })
    test('does not render with initFilterText 300', () => {
      const wrapper = setup({ isOpen: true, initFilterText: 300 })
      expect(wrapper.instance().props.initFilterText).toEqual(300)
    })
    test('does not render with initFilterText 300', () => {
      const wrapper = setup({ isOpen: true, initFilterText: true })
      expect(wrapper.instance().props.initFilterText).toEqual(true)
    })
  })
})