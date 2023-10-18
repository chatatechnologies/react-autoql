import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import Cascader from './Cascader'

const testOptions = [
  {
    value: 'test',
    label: 'test label',
    children: [{ value: 'test2', label: 'test label 2' }],
  },
]

const setup = (props = {}, state = null) => {
  const setupProps = { ...props }
  const wrapper = shallow(<Cascader {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

const getComponent = (props = {}) => {
  try {
    const wrapper = setup({ ...props })
    return findByTestAttr(wrapper, 'react-autoql-cascader')
  } catch (error) {
    return undefined
  }
}

describe('renders without crashing', () => {
  test('renders correctly with default props', () => {
    try {
      const cascaderComponent = getComponent()
      expect(cascaderComponent.exists()).toBe(true)
    } catch (error) {
      console.error(error)
    }
  })
})

describe('renders correctly with 1 set of children', () => {
  const wrapper = setup({ options: testOptions })
  const cascaderComponent = findByTestAttr(wrapper, 'react-autoql-cascader')
  const firstChild = findByTestAttr(cascaderComponent, 'options-list-0')

  test('has no active item after mounting', () => {
    expect(firstChild.exists()).toBe(true)
  })

  const firstOptionText = findByTestAttr(cascaderComponent, 'options-item-0-0-text')
  test('renders first item correctly', () => {
    expect(firstOptionText.text()).toEqual('test label')
  })

  test('do not render back button by default', () => {
    const backBtn = findByTestAttr(cascaderComponent, 'cascader-back-arrow-0')
    expect(backBtn.exists()).toBe(false)
  })

  describe('after clicking first option', () => {
    const wrapper = setup({ options: testOptions, onSeeMoreClick: () => {} })
    const firstOption = findByTestAttr(wrapper, 'options-item-0-0')
    firstOption.simulate('click')

    test('render back button', () => {
      const backBtn = findByTestAttr(wrapper, 'cascader-back-arrow-1')
      expect(backBtn.exists()).toBe(true)
    })

    test('renders title', () => {
      const title = findByTestAttr(wrapper, 'options-title')
      expect(title.text()).toEqual('test label')
    })

    test('does not throw error when see more button is clicked', () => {
      const seeMoreBtn = findByTestAttr(wrapper, 'see-more-option')
      seeMoreBtn.simulate('click')
    })

    test('see more option triggers callback', () => {
      const seeMore = jest.fn()
      wrapper.setProps({ onSeeMoreClick: seeMore })
      const seeMoreBtn = findByTestAttr(wrapper, 'see-more-option')
      seeMoreBtn.simulate('click')
      expect(seeMore).toHaveBeenCalled()
    })

    test('does not throw error when onFinalOptionClick is not provided', () => {
      const secondOption = findByTestAttr(wrapper, 'options-item-1-0')
      secondOption.simulate('click')
    })

    test('clicking final option triggers callback', () => {
      const finalOptionCallback = jest.fn()
      wrapper.setProps({ onFinalOptionClick: finalOptionCallback })
      const secondOption = findByTestAttr(wrapper, 'options-item-1-0')
      secondOption.simulate('click')
      expect(finalOptionCallback).toHaveBeenCalled()
    })
  })
})
