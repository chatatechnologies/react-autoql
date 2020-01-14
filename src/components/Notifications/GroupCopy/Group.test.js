import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import Group from './Group'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Group {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with equired props', () => {
    const wrapper = setup()
    const ruleGroupComponent = findByTestAttr(wrapper, 'rule-group')
    expect(ruleGroupComponent.exists()).toBe(true)
  })
})
