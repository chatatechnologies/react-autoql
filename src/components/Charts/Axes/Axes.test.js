// This is a component meant to be used inside an SVG
// You must wrap it in an svg element and use mount for it to work properly

import React from 'react'
import { mount, shallow } from 'enzyme'
import { scaleLinear, scaleBand } from 'd3-scale'

import Axes from './Axes'

import { findByTestAttr, ignoreConsoleErrors } from '../../../../test/testUtils'

var yLabelRef

const xScale = scaleLinear()
  .domain([0, 100])
  .range([0, 300])
  .nice()

const yScale = scaleBand()
  .domain([50, 2, 35, 87])
  .range([0, 300])

const defaultProps = {
  scales: { xScale, yScale },
  height: 300,
  width: 300,
}

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width="300px" height="300px">
      <Axes {...setupProps} />
    </svg>
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    ignoreConsoleErrors(() => {
      const wrapper = setup()
      const axesComponent = findByTestAttr(wrapper, 'react-autoql-axes')
      expect(axesComponent.exists()).toBe(true)
    })
  })
})

describe('after mount', () => {
  describe('renders axis labels correctly', () => {
    describe('short titles', () => {
      const wrapper = setup({
        xCol: { title: 'x title test' },
        yCol: { title: 'y title test' },
      })

      test('renders x axis label', () => {
        const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const xLabelText = findByTestAttr(xLabel, 'axis-label')
        expect(xLabelText.text()).toEqual('x title test ')
      })
      test('renders y axis label', () => {
        const yLabel = findByTestAttr(wrapper, 'y-axis-label')
        const yLabelText = findByTestAttr(yLabel, 'axis-label')
        expect(yLabelText.text()).toEqual('y title test ')
      })
      test('does not render dropdowns by default', () => {
        const xLabelArrow = findByTestAttr(wrapper, 'dropdown-arrow')
        expect(xLabelArrow.exists()).toBe(false)
      })
    })

    describe('long titles', () => {
      const wrapper = setup({
        xCol: { title: 'x title test loooong title to test ellipsis overflow' },
        yCol: { title: 'y title test loooong title to test ellipsis overflow' },
      })

      test('renders long x axis label with ellipsis', () => {
        const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const xLabelText = findByTestAttr(xLabel, 'axis-label')
        expect(xLabelText.text()).toEqual(
          'x title test loooong title to test ...'
        )
      })
      test('renders long y axis label with ellipsis', () => {
        const yLabel = findByTestAttr(wrapper, 'y-axis-label')
        const yLabelText = findByTestAttr(yLabel, 'axis-label')
        expect(yLabelText.text()).toEqual(
          'y title test loooong title to test ...'
        )
      })
    })

    describe('renders dropdowns correctly', () => {
      const wrapper = setup({
        xCol: { title: 'x title test' },
        yCol: { title: 'y title test' },
        hasXDropdown: true,
        hasYDropdown: true,
      })

      test('calculates bbox', () => {
        ignoreConsoleErrors(() => {
          const yLabel = mount(
            <text
              ref={(r) => {
                yLabelRef = r
              }}
            >
              y title test
            </text>
          )
          yLabel.mount()

          const wrapper = mount(
            <Axes
              {...defaultProps}
              xCol={{ title: 'x title test' }}
              yCol={{ title: 'y title test' }}
              hasXDropdown={true}
              hasYDropdown={true}
            />
          )
          wrapper.mount()
          wrapper.instance().getBBoxFromRef(yLabelRef)
        })
      })

      test('renders x dropdown arrow', () => {
        const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const xLabelArrow = findByTestAttr(xLabel, 'dropdown-arrow')
        expect(xLabelArrow.exists()).toBe(true)
      })

      test('renders y dropdown arrow', () => {
        const yLabel = findByTestAttr(wrapper, 'y-axis-label')
        const yLabelArrow = findByTestAttr(yLabel, 'dropdown-arrow')
        expect(yLabelArrow.exists()).toBe(true)
      })

      describe('x label button', () => {
        const xLabelBorder = findByTestAttr(wrapper, 'x-axis-label-border')
        test('renders border', () => {
          expect(xLabelBorder.exists()).toBe(true)
        })
        test('doesnt crash when clicked and callback is not provided', () => {
          xLabelBorder.simulate('click')
        })
        test('calls onXAxisClick when provided', () => {
          const onXAxisClick = jest.fn()
          const wrapper = setup({
            xCol: { title: 'x title test' },
            yCol: { title: 'y title test' },
            hasXDropdown: true,
            hasYDropdown: true,
            onXAxisClick,
          })
          const xLabelBorder = findByTestAttr(wrapper, 'x-axis-label-border')
          xLabelBorder.simulate('click')
          expect(onXAxisClick).toHaveBeenCalled()
        })
      })

      describe('y label button', () => {
        const yLabelBorder = findByTestAttr(wrapper, 'y-axis-label-border')
        test('renders border', () => {
          expect(yLabelBorder.exists()).toBe(true)
        })
        test('doesnt crash when clicked and callback is not provided', () => {
          yLabelBorder.simulate('click')
        })
        test('calls onYAxisClick when provided', () => {
          const onYAxisClick = jest.fn()
          const wrapper = setup({
            xCol: { title: 'x title test' },
            yCol: { title: 'y title test' },
            hasXDropdown: true,
            hasYDropdown: true,
            onYAxisClick,
          })
          const yLabelBorder = findByTestAttr(wrapper, 'y-axis-label-border')
          yLabelBorder.simulate('click')
          expect(onYAxisClick).toHaveBeenCalled()
        })
      })
    })
  })
})
