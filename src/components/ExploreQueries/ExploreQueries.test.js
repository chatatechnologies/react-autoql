import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ExploreQueries from './ExploreQueries'

const defaultProps = ExploreQueries.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ExploreQueries {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const queryTipsComponent = findByTestAttr(wrapper, 'query-tips-tab')
    expect(queryTipsComponent.exists()).toBe(true)
  })
})
