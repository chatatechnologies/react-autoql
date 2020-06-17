import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import ChataColumnChart from './ChataColumnChart'

const defaultProps = {
  data: [
    {
      cells: [{ value: 50 }, { value: 75 }],
      label: 'label1`',
      origRow: ['label1', 50, 75],
    },
    {
      cells: [{ value: 30 }, { value: 65 }],
      label: 'label2`',
      origRow: ['label2', 30, 65],
    },
  ],
  columns: [{}, {}, {}],
  height: 300,
  width: 300,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataColumnChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const columnChartComponent = findByTestAttr(wrapper, 'chata-column-chart')
    expect(columnChartComponent.exists()).toBe(true)
  })
})
