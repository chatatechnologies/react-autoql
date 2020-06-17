import React from 'react'
import { shallow } from 'enzyme'

import Axes from './Axes'

import { findByTestAttr } from '../../../../test/testUtils'
import { themeConfigDefault } from '../../../props/defaults'

const defaultProps = {
  themeConfig: themeConfigDefault,
  scales: {},
  margins: {},
  xCol: {},
  yCol: {},
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Axes {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const axesComponent = findByTestAttr(wrapper, 'chata-axes')
    expect(axesComponent.exists()).toBe(true)
  })
})
