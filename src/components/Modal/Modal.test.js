import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Modal from './Modal'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Modal {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with equired props', () => {
    const wrapper = setup()
    const modalComponent = findByTestAttr(wrapper, 'chata-modal')
    expect(modalComponent.exists()).toBe(true)
  })
})
