import React from 'react'
import { mount } from 'enzyme'
import StringAxisSelector from './StringAxisSelector'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'

const pivotSampleProps = sampleProps.pivot
const defaultProps = StringAxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <StringAxisSelector {...setupProps}>
        <div data-test='string-axis-selector'>test</div>
      </StringAxisSelector>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders string axis selector if string column provided', () => {
    const wrapper = setup(pivotSampleProps)
    const stringSelector = findByTestAttr(wrapper, 'string-axis-selector')
    expect(stringSelector.exists()).toBe(true)
  })
})
