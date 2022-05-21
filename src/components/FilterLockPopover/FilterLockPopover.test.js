import React from 'react'
import { shallow, mount } from 'enzyme'

import { checkProps, ignoreConsoleErrors } from '../../../test/testUtils'
import { FilterLockPopover } from '.'

const defaultProps = FilterLockPopover.defaultProps
const sampleAuth = {
  apiKey: 'testKey',
  domain: 'http://www.test.com',
  token: 'rand0mtok3n',
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, authentication: sampleAuth, ...props }
  const wrapper = shallow(<FilterLockPopover {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with only token prop', () => {
    ignoreConsoleErrors(async () => {
      const wrapper = await shallow(
        <FilterLockPopover authentication={{ token: 'token' }} />
      )
      expect(wrapper.exists()).toBe(true)
    })
  })

  test('renders correctly with default props', () => {
    const wrapper = setup()
    expect(wrapper.exists()).toBe(true)
  })
  test('renders correctly when no children provided', () => {
    const mounted = mount(
      <FilterLockPopover {...defaultProps} authentication={sampleAuth} />
    )
    expect(mounted.exists()).toBe(true)
  })
  test('renders correctly with children', () => {
    const mounted = mount(
      <FilterLockPopover {...defaultProps} authentication={sampleAuth}>
        <button>button!</button>
      </FilterLockPopover>
    )
    expect(mounted.exists()).toBe(true)
  })
})

describe('props', () => {
  test('does not throw warning with expected props', () => {
    checkProps(FilterLockPopover, defaultProps)
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
})
