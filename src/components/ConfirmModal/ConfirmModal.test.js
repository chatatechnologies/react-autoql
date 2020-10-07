import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ConfirmModal from './ConfirmModal'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ConfirmModal {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const ConfirmModalComponent = findByTestAttr(
      wrapper,
      'react-autoql-confirm-modal'
    )
    expect(ConfirmModalComponent.exists()).toBe(true)
  })
})
