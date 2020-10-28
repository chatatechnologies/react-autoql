import React from 'react'
import { shallow } from 'enzyme'
import { scaleBand } from 'd3-scale'

import { findByTestAttr } from '../../../../test/testUtils'
import Circles from './Circles'

const defaultProps = {
  labelValueX: 'label',
  labelValueY: 'label',
  data: [
    { cells: [{ value: 50 }, { value: 75 }], label: 'label1`' },
    { cells: [{ value: 30 }, { value: 65 }], label: 'label2`' },
  ],
  columns: [{}, {}],
  scales: {
    xScale: scaleBand()
      .domain(['label1', 'label2'])
      .range([0, 200])
      .paddingInner(0.1),
    yScale: scaleBand()
      .domain(['label1', 'label2'])
      .range([0, 200])
      .paddingInner(0.1),
  },
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Circles {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const circlesComponent = findByTestAttr(wrapper, 'circles')
    expect(circlesComponent.exists()).toBe(true)
  })
})
