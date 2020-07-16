import React from 'react'
import { mount } from 'enzyme'

import { findByTestAttr, ignoreConsoleErrors } from '../../../test/testUtils'
import ErrorBoundary from './ErrorHOC'

const setup = ({ children, props = {}, state = null }) => {
  const setupProps = { ...props }
  const wrapper = mount(
    <ErrorBoundary {...setupProps}>{children}</ErrorBoundary>
  )
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

const ProblemChild = () => {
  return <div>TEST CHILD</div> // eslint-disable-line
}

describe('renders correctly', () => {
  test('renders children without error', () => {
    const children = <div data-test="test-child">TEST CHILD</div>
    const wrapper = setup({ children })
    const childComponent = findByTestAttr(wrapper, 'test-child')
    expect(childComponent.exists()).toBe(true)
  })

  test('does not render error placeholder if there is no error', () => {
    const children = <div data-test="test-child">TEST CHILD</div>
    const wrapper = setup({ children })
    const childComponent = findByTestAttr(wrapper, 'error-container')
    expect(childComponent.exists()).toBe(false)
  })

  test('does not render children if there is an error', () => {
    const children = <div data-test="test-child">TEST CHILD</div>
    const wrapper = setup({ children, state: { hasError: true } })
    const childComponent = findByTestAttr(wrapper, 'test-child')
    expect(childComponent.exists()).toBe(false)
  })

  test('renders placeholder message if there is an error', () => {
    const children = <div data-test="test-child">TEST CHILD</div>
    const wrapper = setup({ children, state: { hasError: true } })
    const childComponent = findByTestAttr(wrapper, 'error-container')
    expect(childComponent.exists()).toBe(true)
  })

  test('renders error div if componentdidcatch catches an error', () => {
    const wrapper = mount(
      <ErrorBoundary>
        <ProblemChild data-test="test-child" />
      </ErrorBoundary>
    )
    const childComponent = findByTestAttr(wrapper, 'test-child')
    childComponent.simulateError()

    const errorComponent = findByTestAttr(wrapper, 'error-container')
    expect(errorComponent.exists()).toBe(true)
  })

  test('renders message correctly when provided', () => {
    const children = <div data-test="test-child">TEST CHILD</div>
    const wrapper = setup({
      children,
      state: { hasError: true },
      props: { message: 'test message' },
    })
    const childComponent = findByTestAttr(wrapper, 'error-container')
    expect(childComponent.text()).toEqual('test message')
  })

  test('doesnt render message if it is not a string', () => {
    ignoreConsoleErrors(() => {
      const children = <div data-test="test-child">TEST CHILD</div>
      const wrapper = setup({
        children,
        state: { hasError: true },
        props: { message: <div>test message</div> },
      })
      const childComponent = findByTestAttr(wrapper, 'error-container')
      expect(childComponent.text()).toEqual('')
    })
  })
})
