import React from 'react'
import { shallow } from 'enzyme'

import Axis from './Axis'

import { findByTestAttr } from '../../../../test/testUtils'
import { themeConfigDefault } from '../../../props/defaults'

const defaultProps = {
  themeConfig: themeConfigDefault,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Axis {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })
})
