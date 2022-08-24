import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import { Dashboard } from './Dashboard'

const defaultProps = Dashboard.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Dashboard {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const dashboardComponent = findByTestAttr(wrapper, 'react-autoql-dashboard')
    expect(dashboardComponent.exists()).toBe(true)
  })
})

describe('refresh layout', () => {
  test('refreshLayout fires window resize event', () => {
    const spy = jest.fn()
    window.addEventListener('resize', spy)

    const wrapper = setup()
    wrapper.instance().refreshLayout()

    window.removeEventListener('resize', spy)
    expect(spy).toHaveBeenCalled()
  })
})
