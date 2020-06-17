import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import { testAuthentication } from '../../../../test/testData'
import NotificationList from './NotificationList'

const defaultProps = {
  authentication: testAuthentication,
  notifications: [],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<NotificationList {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const notificationListComponent = findByTestAttr(
      wrapper,
      'notification-list'
    )
    expect(notificationListComponent.exists()).toBe(true)
  })
})
