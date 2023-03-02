import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import ExpressionBuilder from './ExpressionBuilder'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ExpressionBuilder {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const notificationRulesComponent = findByTestAttr(wrapper, 'notification-rules')
    expect(notificationRulesComponent.exists()).toBe(true)
  })
})
