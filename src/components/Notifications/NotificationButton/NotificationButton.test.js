import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationButton from './NotificationButton'

const defaultProps = {
  authentication: testAuthentication,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<NotificationButton {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const notificationButtonComponent = findByTestAttr(
      wrapper,
      'notification-button'
    )
    expect(notificationButtonComponent.exists()).toBe(true)
  })
})
