import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedColumns from './StackedColumns'
import sampleProps from '../chartTestData'

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedColumns.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedColumns {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders regular pivot chart data correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.stringScale,
      yScale: pivotSampleProps.numberScale,
    })
    const stackedColumnsComponent = findByTestAttr(wrapper, 'stacked-columns')
    expect(stackedColumnsComponent.exists()).toBe(true)
  })
})
