import React from 'react'
import { shallow, mount } from 'enzyme'
import renderer from 'react-test-renderer'

import { findByTestAttr, checkProps } from '../../../test/testUtils'
import { ChatDrawer } from '../..'

const defaultProps = {
  placement: 'right',
  maskClosable: true,
  isVisible: false,
  width: 500,
  height: 350,
  showHandle: true,
  theme: 'light',
  handleStyles: {},
  shiftScreen: false,
  showMask: true,
  token: 'test-token',
  projectId: 500,
  onHandleClick: () => {},
  onVisibleChange: () => {}
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChatDrawer {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    const wrapper = shallow(<ChatDrawer token="token" />)
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
})

describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(ChatDrawer, defaultProps)
  })
  describe('showMask', () => {
    test('showMask false does not show mask on drawer open', () => {
      const html = mount(<ChatDrawer token="token" showMask={false} />)
      const mask = html.find('.drawer-mask')
      expect(mask.exists()).toBe(false)
    })
    test('showMask true shows mask on drawer open', () => {
      const html = mount(<ChatDrawer token="token" showMask={true} />)
      const mask = html.find('.drawer-mask')
      expect(mask.exists()).toBe(true)
    })
  })
  describe('placement', () => {
    test('renders correctly with left placement', () => {
      const wrapper = setup({ placement: 'left' })
      expect(wrapper.exists()).toBe(true)
    })
    test('renders correctly with top placement', () => {
      const wrapper = setup({ placement: 'top' })
      expect(wrapper.exists()).toBe(true)
    })
    test('renders correctly with bottom placement', () => {
      const wrapper = setup({ placement: 'bottom' })
      expect(wrapper.exists()).toBe(true)
    })
  })
  describe('width', () => {
    test('nullify width if placement is top', () => {
      const wrapper = setup({ placement: 'top', width: '200px' })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.width).toBe(null)
    })
    test('nullify width if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', width: 600 })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.width).toBe(null)
    })
    test('width is applied if placement is right', () => {
      const wrapper = setup({ placement: 'right', width: '500px' })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.width).toBe('500px')
    })
    test('width is applied if placement is left', () => {
      const wrapper = setup({ placement: 'left', width: 300 })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.width).toBe(300)
    })
  })
  describe('height', () => {
    test('nullify height if placement is left', () => {
      const wrapper = setup({ placement: 'left', height: '200px' })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.height).toBe(null)
    })
    test('nullify height if placement is right', () => {
      const wrapper = setup({ placement: 'right', height: 600 })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.height).toBe(null)
    })
    test('height is applied if placement is top', () => {
      const wrapper = setup({ placement: 'top', height: '500px' })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.height).toBe('500px')
    })
    test('height is applied if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', height: 300 })
      const drawerProps = wrapper.find('.chata-drawer').props()
      expect(drawerProps.height).toBe(300)
    })
  })
  describe('showHandle', () => {
    test('handle is not rendered when showHandle is false', () => {
      // const wrapper = setup({ placement: 'bottom', height: 300 })
      // const drawerProps = wrapper.find('.chata-drawer').props()
      // expect(drawerProps.height).toBe(300)
    })
  })

  // If empty string is passed as customerName, we should render 'there'
  // If customerName is not provided, we should render 'there'
})
