import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Select from './Select'

const defaultProps = {
  options: [{ option: '1' }, { option: '2' }, { option: '3' }],
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Select {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const selectComponent = findByTestAttr(wrapper, 'react-autoql-select')
    expect(selectComponent.exists()).toBe(true)
  })
})

describe('menu scrolling', () => {
  // Labels truncate with an ellipsis, so the menu never needs to scroll sideways. Without this, a list
  // a pixel wider than the menu showed a horizontal scrollbar that stayed up and had nothing to scroll.
  test('the menu only scrolls vertically', () => {
    const wrapper = setup({ options: [{ value: 1, label: 'One' }] })
    const content = shallow(<div>{wrapper.instance().renderPopoverContent()}</div>)
    expect(content.find('CustomScrollbars').prop('suppressScrollX')).toBe(true)
  })
})
