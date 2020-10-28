import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr, ignoreConsoleErrors } from '../../../test/testUtils'
import Button from './Button'

const defaultProps = {}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Button {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders without crashing', () => {
  test('renders correctly with no props', () => {
    const wrapper = setup()
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.exists()).toBe(true)
  })
})

describe('renders type correctly', () => {
  test('renders danger type correctly', () => {
    const wrapper = setup({ type: 'danger' })
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.hasClass('danger')).toBe(true)
  })

  test('renders primary type correctly', () => {
    const wrapper = setup({ type: 'primary' })
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.hasClass('primary')).toBe(true)
  })

  test('renders default type correctly', () => {
    const wrapper = setup({ type: 'default' })
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.hasClass('default')).toBe(true)
  })

  test('renders default button when type prop is not a string', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ type: { type: 'primary' } })
      const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
      expect(buttonComponent.hasClass('default')).toBe(true)
    })
  })

  test('renders default button when type is invalid', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ type: 'awesome' })
      const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
      expect(buttonComponent.hasClass('default')).toBe(true)
    })
  })
})

describe('renders size correctly', () => {
  test('renders large size when size prop is not a string', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ size: { size: 'small' } })
      const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
      expect(buttonComponent.hasClass('large')).toBe(true)
    })
  })

  test('renders large size when size prop is invalid', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ size: 'gigantic' })
      const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
      expect(buttonComponent.hasClass('large')).toBe(true)
    })
  })

  test('renders correct size when prop has upper case', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup({ size: 'SmALl' })
      const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
      expect(buttonComponent.hasClass('small')).toBe(true)
    })
  })
})

describe('renders state correctly', () => {
  test('does not disable button by default', () => {
    const wrapper = setup()
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.hasClass('disabled')).toBe(false)
  })

  test('renders disabled state correctly', () => {
    const wrapper = setup({ disabled: true })
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    expect(buttonComponent.hasClass('disabled')).toBe(true)
  })
})

describe('renders loading indicator correctly', () => {
  test('renders loading indicator when prop is true', () => {
    const wrapper = setup({ loading: true })
    const loadingIndicator = findByTestAttr(wrapper, 'react-autoql-btn-loading')
    expect(loadingIndicator.exists()).toBe(true)
  })
  test('does not render loading indicator by default', () => {
    const wrapper = setup()
    const loadingIndicator = findByTestAttr(wrapper, 'react-autoql-btn-loading')
    expect(loadingIndicator.exists()).toBe(false)
  })
})

describe('process click event properly', () => {
  test('calls onClick prop when button is clicked', () => {
    const callback = jest.fn()
    const wrapper = setup({ onClick: callback })
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    buttonComponent.simulate('click')
    expect(callback).toHaveBeenCalled()
  })

  test('does not throw error when onClick is not provided', () => {
    const wrapper = setup()
    const buttonComponent = findByTestAttr(wrapper, 'react-autoql-btn')
    buttonComponent.simulate('click')
    expect(buttonComponent.exists()).toBe(true)
  })
})
