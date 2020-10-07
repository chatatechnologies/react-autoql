import React from 'react'
import { shallow, mount } from 'enzyme'
import renderer from 'react-test-renderer'

import { findByTestAttr, checkProps } from '../../../test/testUtils'
import { DataMessenger } from '../..'

const defaultProps = {
  placement: 'right',
  maskClosable: true,
  isVisible: false,
  width: '500px',
  height: '350px',
  showHandle: true,
  theme: 'light',
  handleStyles: {},
  shiftScreen: false,
  showMask: true,
  apiKey: 'test-apikey',
  projectId: 500,
  onHandleClick: () => {},
  onVisibleChange: () => {},
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DataMessenger {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    const wrapper = shallow(<DataMessenger apiKey="apiKey" />)
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
})

describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(DataMessenger, defaultProps)
  })
  describe('showMask', () => {
    test('showMask false does not show mask on drawer open', () => {
      const html = mount(<DataMessenger token="token" showMask={false} />)
      const mask = html.find('.drawer-mask')
      expect(mask.exists()).toBe(false)
    })
    test('showMask true shows mask on drawer open', () => {
      const html = mount(<DataMessenger token="token" showMask={true} />)
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
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(null)
    })
    test('nullify width if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', width: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(null)
    })
    test('width is applied if placement is right', () => {
      const wrapper = setup({ placement: 'right', width: '500px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe('500px')
    })
    test('width is applied if placement is left', () => {
      const wrapper = setup({ placement: 'left', width: 300 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.width).toBe(300)
    })
  })
  describe('height', () => {
    test('nullify height if placement is left', () => {
      const wrapper = setup({ placement: 'left', height: '200px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(null)
    })
    test('nullify height if placement is right', () => {
      const wrapper = setup({ placement: 'right', height: 600 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(null)
    })
    test('height is applied if placement is top', () => {
      const wrapper = setup({ placement: 'top', height: '500px' })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe('500px')
    })
    test('height is applied if placement is bottom', () => {
      const wrapper = setup({ placement: 'bottom', height: 300 })
      const drawerProps = wrapper.find('.react-autoql-drawer').props()
      expect(drawerProps.height).toBe(300)
    })
  })
  describe('showHandle', () => {
    test('handle is not rendered when showHandle is false', () => {
      // const wrapper = setup({ placement: 'bottom', height: 300 })
      // const drawerProps = wrapper.find('.react-autoql-drawer').props()
      // expect(drawerProps.height).toBe(300)
    })
  })

  // If empty string is passed as userDisplayName, we should render 'there'
  // If userDisplayName is not provided, we should render 'there'
})
