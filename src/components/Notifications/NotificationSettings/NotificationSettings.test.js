import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationSettings from './NotificationSettings'

const defaultProps = {
  authentication: testAuthentication,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<NotificationSettings {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const notificationSettingsComponent = findByTestAttr(
      wrapper,
      'notification-settings'
    )
    expect(notificationSettingsComponent.exists()).toBe(true)
  })
})
