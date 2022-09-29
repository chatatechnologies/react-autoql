import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationIcon from './NotificationIcon'

const defaultProps = {
  authentication: testAuthentication,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<NotificationIcon {...setupProps} />).dive()
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
