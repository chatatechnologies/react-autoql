import React from 'react'
import { shallow } from 'enzyme'
import { scaleLinear, scaleBand } from 'd3-scale'

import { findByTestAttr } from '../../../../test/testUtils'
import Bars from './Bars'

const defaultProps = {
  labelValue: 'label',
  data: [
    { cells: [{ value: 50 }, { value: 75 }], label: 'label1`' },
    { cells: [{ value: 30 }, { value: 65 }], label: 'label2`' }
  ],
  scales: {
    xScale: scaleLinear()
      .domain([0, 100])
      .range([0, 300]),
    yScale: scaleBand()
      .domain(['label1', 'label2'])
      .range([0, 200])
      .paddingInner(0.1)
  }
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Bars {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })
})
