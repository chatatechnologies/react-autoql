import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import Rule from './Rule'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Rule {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with equired props', () => {
    const wrapper = setup()
    const ruleComponent = findByTestAttr(wrapper, 'rule')
    expect(ruleComponent.exists()).toBe(true)
  })
})
