import React from 'react'
import { mount } from 'enzyme'
import { scaleLinear, scaleBand } from 'd3-scale'

import Axis from './Axis'

import { findByTestAttr } from '../../../../test/testUtils'

const legendLabels = [
  { color: 'red', label: 'first' },
  { color: 'green', label: 'second' },
  { color: 'blue', label: 'third' },
]

const defaultProps = {
  height: 300,
  width: 300,
  scale: scaleBand()
    .domain([50, 2, 35, 87])
    .range([0, 300]),
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg>
      <Axis {...setupProps} />
    </svg>
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup()
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  describe('legend', () => {
    test('does not render right legend by default', () => {
      const wrapper = setup()
      const legendElement = findByTestAttr(wrapper, 'right-legend')
      expect(legendElement.exists()).toBe(false)
    })

    test('does not render bottom legend by default', () => {
      const wrapper = setup()
      const legendElement = findByTestAttr(wrapper, 'bottom-legend')
      expect(legendElement.exists()).toBe(false)
    })

    // todo: find a different way to test the d3 dom stuff because this doesnt work

    // test('renders right legend without title', () => {
    //   const wrapper = setup({ hasRightLegend: true, legendLabels })
    //   const legendElement = findByTestAttr(wrapper, 'right-legend')
    //   expect(legendElement.exists()).toBe(true)
    // })

    // test('renders bottom legend without title', () => {
    //   const wrapper = setup({ hasBottomLegend: true, legendLabels })
    //   const legendElement = findByTestAttr(wrapper, 'bottom-legend')
    //   expect(legendElement.exists()).toBe(true)
    // })

    // test('renders right legend with title', () => {
    //   const wrapper = setup({
    //     hasRightLegend: true,
    //     legendTitle: 'Legend',
    //     legendLabels,
    //   })
    //   const legendTitle = findByTestAttr(wrapper, 'legend-title')
    //   expect(legendTitle.exists()).toBe(true)
    // })
  })
})
