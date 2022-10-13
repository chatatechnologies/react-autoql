import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import MonthSelect from './MonthSelect'

const defaultProps = {
  // options: ['1', '2', '3']
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<MonthSelect {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const monthSelectComponent = findByTestAttr(wrapper, 'react-autoql-month-select')
    expect(monthSelectComponent.exists()).toBe(true)
  })
})
