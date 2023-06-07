import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Points from './Points'
import sampleProps from '../chartTestData'

const pivotSampleProps = sampleProps.pivot
const defaultProps = Points.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Points {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders regular pivot chart data correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.stringScale(),
    })
    const pointsComponent = findByTestAttr(wrapper, 'points')
    expect(pointsComponent.exists()).toBe(true)
  })
})
