import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import SelectableList from './SelectableList'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<SelectableList {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with no props', () => {
    const wrapper = setup()
    const listComponent = findByTestAttr(wrapper, 'selectable-list')
    expect(listComponent.exists()).toBe(true)
  })
})
