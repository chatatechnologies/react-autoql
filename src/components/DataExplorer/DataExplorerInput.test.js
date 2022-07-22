import React from 'react'
// import axios from 'axios'
import { mount, shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import DataExplorerInput from './DataExplorerInput'

jest.mock('axios', () =>
  jest.fn(() => Promise.resolve({ data: { matches: ['test'] } }))
)

let wrapper = null
let inputComponent = null

const defaultProps = DataExplorerInput.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<DataExplorerInput {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders autocomplete wrapper correctly with required props', () => {
    const wrapper = setup()
    const autocompleteComponent = findByTestAttr(
      wrapper,
      'data-explorer-autocomplete'
    )
    expect(autocompleteComponent.exists()).toBe(true)
  })
})

describe('calls autocomplete at the right time', () => {
  beforeAll(() => {
    wrapper = mount(<DataExplorerInput {...defaultProps} />)
    wrapper.setState({
      allSubjects: [{ name: 'test subject', type: 'subject' }],
    })
    inputComponent = findByTestAttr(wrapper, 'data-explorer-input-component')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('input component rendered', () => {
    expect(inputComponent.exists()).toBe(true)
  })
  test('input focus alone does not show autocomplete', () => {
    const instance = wrapper.instance()
    jest.spyOn(instance, 'onSuggestionsFetchRequested')
    inputComponent.simulate('focus')
    expect(instance.onSuggestionsFetchRequested).toHaveBeenCalledTimes(0)
  })
  test('input "focus" and "value change" shows autocomplete', () => {
    const instance = wrapper.instance()
    jest.spyOn(instance, 'onSuggestionsFetchRequested')

    inputComponent.simulate('change', {
      target: {
        value: '',
      },
    })

    expect(instance.onSuggestionsFetchRequested).toHaveBeenCalledTimes(1)
  })
  test('empty input should not call fetchVLAutoComplete', () => {
    const instance = wrapper.instance()
    jest.spyOn(instance, 'requestSuggestions')

    inputComponent.simulate('change', {
      target: {
        value: '',
      },
    })

    expect(instance.requestSuggestions).toHaveBeenCalledTimes(0)
  })
  test('non-empty input should call fetchVLAutoComplete', () => {
    const instance = wrapper.instance()
    jest.spyOn(instance, 'requestSuggestions')

    inputComponent.simulate('change', {
      target: {
        value: 'test',
      },
    })

    expect(instance.requestSuggestions).toHaveBeenCalledTimes(1)
  })
  test('typing, erasing, then typing again should invoke autocomplete 3 times', () => {
    const instance = wrapper.instance()
    jest.spyOn(instance, 'onSuggestionsFetchRequested')

    inputComponent.simulate('change', {
      target: {
        value: 'test',
      },
    })

    inputComponent.simulate('change', {
      target: {
        value: '',
      },
    })

    inputComponent.simulate('change', {
      target: {
        value: 'te',
      },
    })

    expect(instance.onSuggestionsFetchRequested).toHaveBeenCalledTimes(3)
  })
  test('typing in input updates inputValue state', () => {
    inputComponent.simulate('change', {
      target: {
        value: 'test',
      },
    })

    expect(wrapper.instance()?.state?.inputValue).toBe('test')
  })
  test('does not submit on enter press unless a value is selected in the dropdown', () => {
    inputComponent.simulate('change', {
      target: {
        value: 'test',
      },
    })
    inputComponent.simulate('keypress', { key: 'Enter' })
    expect(wrapper.instance()?.state?.inputValue).toBe('test')
  })
  afterAll(() => {
    wrapper.unmount()
  })
})

// describe('always shows recently clicked list after clicking on an item', () => {
//   test('shows recently clicked list when input is empty', () => {})
//   test('shows recently clicked list when there are suggestions', () => {})
//   test('shows recently clicked list when there are no suggestions', () => {})
// })
