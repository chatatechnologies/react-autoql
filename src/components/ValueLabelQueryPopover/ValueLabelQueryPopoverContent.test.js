import React from 'react'
import { mount } from 'enzyme'
import { act } from 'react-dom/test-utils'
import ValueLabelQueryPopoverContent from './ValueLabelQueryPopoverContent'

jest.mock('../../js/valueLabelHelpers', () => ({
  resolveValueLabelLock: jest.fn(() => new Promise(() => {})),
}))

describe('ValueLabelQueryPopoverContent', () => {
  test('focuses the input once it is on the page', () => {
    jest.useFakeTimers()
    const container = document.createElement('div')
    document.body.appendChild(container)

    const wrapper = mount(
      <ValueLabelQueryPopoverContent column={{ name: 'category' }} value='Bakery' onSubmit={jest.fn()} />,
      { attachTo: container },
    )

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(document.activeElement).toBe(wrapper.find('input').getDOMNode())

    wrapper.unmount()
    container.remove()
    jest.useRealTimers()
  })
})
