import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import ScheduleBuilder from './ScheduleBuilder'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ScheduleBuilder {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const scheduleComponent = findByTestAttr(wrapper, 'schedule-builder')
    expect(scheduleComponent.exists()).toBe(true)
  })
})
