import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import WeekSelect from './WeekSelect'

const defaultProps = {
  // options: ['1', '2', '3']
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<WeekSelect {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const weekSelectComponent = findByTestAttr(wrapper, 'chata-week-select')
    expect(weekSelectComponent.exists()).toBe(true)
  })
})
