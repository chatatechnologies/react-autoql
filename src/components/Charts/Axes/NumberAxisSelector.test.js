import React from 'react'
import { mount } from 'enzyme'
import NumberAxisSelector from './NumberAxisSelector'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'

const pivotSampleProps = sampleProps.pivot
const defaultProps = NumberAxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <NumberAxisSelector {...setupProps} />
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders number axis selector if number column provided', () => {
    const wrapper = setup(pivotSampleProps)
    const numberSelector = findByTestAttr(wrapper, 'axis-label-border')
    expect(numberSelector.exists()).toBe(true)
  })
})
