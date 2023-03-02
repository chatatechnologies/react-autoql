import React from 'react'
import { shallow } from 'enzyme'

import QueryValidationMessage from './QueryValidationMessage'

const defaultProps = {
  initialSelections: undefined,
  isQueryRunning: false,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryValidationMessage {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders without crashing', () => {
    const wrapper = setup()
    // const toolbarComponent = findByTestAttr(wrapper, 'viz-toolbar')
    expect(wrapper.exists()).toBe(true)
  })
})
