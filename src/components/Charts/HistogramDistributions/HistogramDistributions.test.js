import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'
import HistogramDistributions from './HistogramDistributions'

const scales = {
  xScale: sampleProps.pivot.stringScale(),
  yScale: sampleProps.pivot.numberScale(),
}

const pivotSampleProps = {
  ...sampleProps.pivot,
  ...scales,
}

const datePivotSampleProps = {
  ...sampleProps.datePivot,
  ...scales,
}

const listSampleProps = {
  ...sampleProps.list,
  ...scales,
}

const defaultProps = HistogramDistributions.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<HistogramDistributions {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const distributionsComponent = findByTestAttr(wrapper, 'distribution-lines')
    expect(distributionsComponent.exists()).toBe(true)
  })
})
