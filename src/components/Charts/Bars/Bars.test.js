import React from 'react'
import { shallow } from 'enzyme'
import { scaleLinear, scaleBand } from 'd3-scale'

import { findByTestAttr } from '../../../../test/testUtils'
import Bars from './Bars'

const defaultProps = {
  labelValue: 'label',
  data: [
    { cells: [{ value: 50 }, { value: -75 }], label: 'label1`' },
    { cells: [{ value: 30 }, { value: 65 }], label: 'label2`' },
  ],
  scales: {
    xScale: scaleLinear()
      .domain([0, 100])
      .range([0, 300]),
    yScale: scaleBand()
      .domain(['label1', 'label2'])
      .range([0, 200])
      .paddingInner(0.1),
  },
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

  test('renders correctly when min value is greater than 0', () => {
    const wrapper = setup({
      scales: {
        xScale: scaleLinear()
          .domain([50, 100])
          .range([0, 300]),
        yScale: scaleBand()
          .domain(['label1', 'label2'])
          .range([0, 200])
          .paddingInner(0.1),
      },
    })
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })

  test('renders first bar correctly', () => {
    const wrapper = setup()
    const firstBar = findByTestAttr(wrapper, 'bar-0-0')
    expect(firstBar.exists()).toBe(true)
  })

  describe('active key', () => {
    test('no active key by default', () => {
      const wrapper = setup()
      const activeKey = wrapper.state(['activeKey'])
      expect(activeKey).toBeUndefined()
    })
  })

  describe('on bar click', () => {
    test('does not crash when onChartClick is not provided', () => {
      const wrapper = setup()
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
    })

    test('calls onChartClick when bar is clicked', () => {
      const onChartClick = jest.fn()
      const wrapper = setup({ onChartClick })
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
      expect(onChartClick).toHaveBeenCalled()
    })

    test('sets active bar when clicked', () => {
      const wrapper = setup()
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
      const activeKey = wrapper.state(['activeKey'])
      expect(activeKey).toBeDefined()
    })
  })
})
