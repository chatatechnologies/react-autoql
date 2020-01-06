import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Select from './Select'

const defaultProps = {
  options: [{ option: '1' }, { option: '2' }, { option: '3' }]
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Select {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const selectComponent = findByTestAttr(wrapper, 'chata-select')
    expect(selectComponent.exists()).toBe(true)
  })
})
