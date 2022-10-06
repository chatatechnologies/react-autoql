import React from 'react'
import axios from 'axios'
import { shallow, mount } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import { ExploreQueries } from './ExploreQueries'

jest.mock('axios')
const defaultProps = {
  ...ExploreQueries.defaultProps,
  authentication: {
    domain: 'test-domain',
    apiKey: 'testKey',
    token: 'testtoken',
  },
}

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
  test('text fully animates', async () => {
    // Mock explore queries fetch on mount
    axios.get.mockImplementationOnce(() => Promise.resolve({}))

    const wrapper = mount(<ExploreQueries {...defaultProps} />)
    const instance = wrapper.instance()
    const testInputText = 'This is a test!'

    // Mock explore queries fetch after animation
    axios.get.mockImplementationOnce(() => Promise.resolve({}))

    await instance.animateQITextAndSubmit(testInputText)
    wrapper.update()
    const inputText = findByTestAttr(wrapper, 'explore-queries-input-bar')
    expect(inputText.props().value).toBe(testInputText)
  })
})
