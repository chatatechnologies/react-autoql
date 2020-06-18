import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr, ignoreConsoleErrors } from '../../../test/testUtils'
import Cascader from './Cascader'

const setup = (props = {}, state = null) => {
  const setupProps = { ...props }
  const wrapper = shallow(<Cascader {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders without crashing', () => {
  test('renders correctly with default props', () => {
    const wrapper = setup()
    const cascaderComponent = findByTestAttr(wrapper, 'chata-cascader')
    expect(cascaderComponent.exists()).toBe(true)
  })
})
