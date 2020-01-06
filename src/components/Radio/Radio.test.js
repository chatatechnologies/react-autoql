import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Radio from './Radio'

const defaultProps = {
  options: ['1', '2', '3']
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Radio {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const radioComponent = findByTestAttr(wrapper, 'chata-radio')
    expect(radioComponent.exists()).toBe(true)
  })
})
