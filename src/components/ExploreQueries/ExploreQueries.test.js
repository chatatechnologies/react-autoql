import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ExploreQueries from './ExploreQueries'

const defaultProps = ExploreQueries.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ExploreQueries {...setupProps} />).dive()
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const exploreQueriesComponent = findByTestAttr(wrapper, 'query-tips-tab')
    expect(exploreQueriesComponent.exists()).toBe(true)
  })
})

describe('text input animation', () => {
  test('', async () => {
    const wrapper = setup()
    const instance = wrapper.instance()
    const testInputText = 'This is a test!'
    await instance.animateQITextAndSubmit(testInputText)
    const inputText = findByTestAttr(wrapper, 'explore-queries-input-bar')
    expect(inputText.props().value).toBe(testInputText)
  })
})
