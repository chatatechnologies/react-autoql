import React from 'react'
import { mount } from 'enzyme'

import ConditionPreview from './ConditionPreview'

describe('ConditionPreview', () => {
  test('renders current and threshold values when provided and updates with props', () => {
    const props = {
      firstQueryResult: { data: { data: { rows: [[100]] } } },
      firstQuerySelectedColumns: [0],
      secondTermType: 'number',
      secondInputValue: '50',
      secondTermMultiplicationFactorType: 'add',
      secondTermMultiplicationFactorValue: '10',
      selectedOperator: 'GREATER_THAN',
    }

    const wrapper = mount(<ConditionPreview {...props} />)

    // Expect legend to show Current (100) and Threshold (60)
    const text = wrapper.text()
    expect(text).toContain('Current (100)')
    expect(text).toContain('Threshold (60)')

    // Update props to change the input value and expect threshold to update
    wrapper.setProps({
      secondInputValue: '20',
      secondTermMultiplicationFactorValue: '5',
      secondTermMultiplicationFactorType: 'multiply',
    })
    wrapper.update()

    // baseComparedValue = 20, multiply by 5 => threshold 100
    const updatedText = wrapper.text()
    expect(updatedText).toContain('Threshold (100)')
  })
})
