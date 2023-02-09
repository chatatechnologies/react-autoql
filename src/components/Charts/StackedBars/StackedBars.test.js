import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedBars from './StackedBars'
import sampleProps from '../chartTestData'

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedBars.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedBars {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.numberScale(),
      yScale: pivotSampleProps.stringScale(),
    })
    const stackedBarsComponent = findByTestAttr(wrapper, 'stacked-bars')
    expect(stackedBarsComponent.exists()).toBe(true)
  })
})
