import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import LoadingDots from './LoadingDots'

describe('renders correctly', () => {
  test('renders without crashing', () => {
    const wrapper = shallow(<LoadingDots />).dive()
    const loadingDotsComponent = findByTestAttr(wrapper, 'loading-dots')
    expect(loadingDotsComponent.exists()).toBe(true)
  })
})
