import React from 'react'
import { shallow } from 'enzyme'

import { findByTestAttr } from '../../../../test/testUtils'
import ChataStackedLineChart from './ChataStackedLineChart'

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
  tableColumns: [{}, {}, {}],
  height: 300,
  width: 300,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataStackedLineChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const stackedLineChartComponent = findByTestAttr(
      wrapper,
      'react-autoql-stacked-line-chart'
    )
    expect(stackedLineChartComponent.exists()).toBe(true)
  })
})
