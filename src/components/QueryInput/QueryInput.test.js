import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import QueryInput from './QueryInput'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryInput {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const queryInputComponent = findByTestAttr(wrapper, 'chat-bar')
    expect(queryInputComponent.exists()).toBe(true)
  })
})

describe('validation call', () => {
  test('should call validation when prop is set to true', () => {
    // const queryResponse = {}
    // axios.get.mockImplementation(() => Promise.resolve(queryResponse))
    // const users = [{name: 'Bob'}];
    // const resp = {data: users};
    // axios.get.mockResolvedValue(resp);
    // or you could use the following depending on your use case:
    // axios.get.mockImplementation(() => Promise.resolve(resp))
    // return Users.all().then(data => expect(data).toEqual(users));
  })

  test('should call query endpoint only when validation is set to false', () => {})
})

// disable "enter" if no query or if only spaces
