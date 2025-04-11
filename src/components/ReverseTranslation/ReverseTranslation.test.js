import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../test/testUtils'
import ReverseTranslationV2 from './ReverseTranslationV2'

const defaultProps = ReverseTranslation.defaultProps || {}

const setup = (props = {}, state = null) => {
  const setupProps = {
    ...defaultProps,
    ...props,
    queryResponse: { data: { data: { parsed_interpretation: props.reverseTranslation } } },
  }
  const wrapper = shallow(<ReverseTranslation {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('does not render with default props only', () => {
    const wrapper = setup()
    const reverseTranslationComponent = findByTestAttr(wrapper, 'react-autoql-reverse-translation-container')
    expect(reverseTranslationComponent.exists()).toBe(false)
  })

  test('renders correctly when valid reverse translation array is provided', () => {
    const wrapper = setup({
      reverseTranslation: [{ c_type: 'TEXT', eng: 'This is a test' }],
    })
    const reverseTranslationComponent = findByTestAttr(wrapper, 'react-autoql-reverse-translation-container')
    expect(reverseTranslationComponent.exists()).toBe(true)
  })

  test('renders VALIDATED_VALUE_LABEL as anchor tag', () => {
    const wrapper = setup({
      reverseTranslation: [{ c_type: 'VALIDATED_VALUE_LABEL', eng: 'This is a test' }],
      onValueLabelClick: () => { },
    })

    const reverseTranslationLink = findByTestAttr(wrapper, 'react-autoql-condition-link')
    expect(reverseTranslationLink.exists()).toBe(true)
  })

  test('does not render VALIDATED_VALUE_LABEL if callback is not provided', () => {
    const wrapper = setup({
      reverseTranslation: [{ c_type: 'VALIDATED_VALUE_LABEL', eng: 'This is a test' }],
    })
    const reverseTranslationLink = findByTestAttr(wrapper, 'react-autoql-condition-link')
    expect(reverseTranslationLink.exists()).toBe(false)
  })

  test('renders format correctly', () => {
    const wrapper = setup({
      reverseTranslation: [
        { c_type: 'TEXT', eng: 'This is a test' },
        { c_type: 'VALIDATED_VALUE_LABEL', eng: 'Value Label' },
        { c_type: 'TEXT', eng: 'more text.' },
      ],
    })
    const reverseTranslationComponent = findByTestAttr(wrapper, 'react-autoql-reverse-translation-container')
    expect(reverseTranslationComponent.text()).toBe('<Icon /> Interpreted as:  This is a test Value Label more text.')
  })
})
