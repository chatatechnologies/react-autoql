import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import YearSelect from './YearSelect'

const defaultProps = {
  // options: ['1', '2', '3']
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<YearSelect {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const yearSelectComponent = findByTestAttr(wrapper, 'react-autoql-year-select')
    expect(yearSelectComponent.exists()).toBe(true)
  })
})
