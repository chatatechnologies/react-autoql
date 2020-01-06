import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Steps from './Steps'

const defaultProps = {
  steps: [{}, {}]
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Steps {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const stepsComponent = findByTestAttr(wrapper, 'chata-steps')
    expect(stepsComponent.exists()).toBe(true)
  })
})
