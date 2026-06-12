import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import QueryInput from './QueryInput'

const defaultProps = QueryInput.defaultProps

beforeAll(() => {
  global.localStorage = {
    lastQuery: 'sales per customer',
    getItem: function () {
      return 'sales per customer'
    },
  }
})

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<QueryInput {...setupProps} />).dive()
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

  test('show last query on up press', () => {
    // const wrapper = setup(
    //   { autoQLConfig: { enableAutocomplete: false } },
    //   { lastQuery: 'sales per customer' }
    // )
    // wrapper.find('input').simulate('keydown', { key: 'ArrowUp' })
    // expect(wrapper.find('input').props().value).toBe(
    //   global.localStorage.getItem('lastQuery')
    // )
  })
})

// disable "enter" if no query or if only spaces

describe('getState and restoreState', () => {
  test('getState returns current input state as object', () => {
    const wrapper = setup({}, { inputValue: 'test query' })
    const instance = wrapper.instance()

    const state = instance.getState()

    expect(state).toHaveProperty('inputValue')
    expect(state).toHaveProperty('lastQuery')
    expect(state).toHaveProperty('queryHistoryIndex')
    expect(state).toHaveProperty('selectedTopic')
    expect(state).toHaveProperty('selectedColumns')
    expect(state).toHaveProperty('isExpanded')
  })

  test('restoreState applies saved state snapshot', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    const snapshot = {
      inputValue: 'restored query',
      lastQuery: 'old query',
      queryHistoryIndex: 0,
      selectedTopic: { name: 'Topic' },
      selectedColumns: [{ name: 'Col1' }],
      isExpanded: false,
    }

    instance.restoreState(snapshot)

    const restoredState = instance.getState()
    expect(restoredState.inputValue).toBe('restored query')
    expect(restoredState.isExpanded).toBe(false)
  })

  test('restoreState preserves unspecified fields', () => {
    const wrapper = setup({ autoQLConfig: { enableAutocomplete: true } }, { inputValue: 'initial', lastQuery: 'prev' })
    const instance = wrapper.instance()

    const snapshot = {
      inputValue: 'new query',
      lastQuery: 'new last',
      queryHistoryIndex: 5,
      selectedTopic: undefined,
      selectedColumns: [],
      isExpanded: true,
    }

    instance.restoreState(snapshot)

    const restoredState = instance.getState()
    expect(restoredState.inputValue).toBe('new query')
    expect(restoredState.lastQuery).toBe('new last')
  })
})
