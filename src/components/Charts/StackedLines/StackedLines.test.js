import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedLines from './StackedLines'
import sampleProps from '../chartTestData'
import { formatElement } from 'autoql-fe-utils'
import { makeMultiSeriesVerticalProps, toPivotProps, toSplitProps } from '../multiSeriesTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedLines.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedLines {...setupProps} />)
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
      yScale: pivotSampleProps.numberScale(),
    })
    const stackedLinesComponent = findByTestAttr(wrapper, 'stacked-lines')
    expect(stackedLinesComponent.exists()).toBe(true)
  })
})

describe('same-row multi series stacks (AQLP-1098)', () => {
  const getStackDots = (wrapper, category) => {
    const x = wrapper.instance().props.xScale(category)
    return wrapper.find('.vertex-dot').filterWhere((dot) => dot.prop('cx') === x)
  }

  test('every vertex in a stack shares one tooltip with the category and every series value', () => {
    const props = makeMultiSeriesVerticalProps()
    const wrapper = setup(props)
    const dots = getStackDots(wrapper, 'Beta')
    expect(dots.length).toBe(3)

    const tooltips = dots.map((dot) => dot.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(1)
    const tooltip = tooltips[0]
    expect(tooltip).toContain('Beta')
    ;[1, 2, 3].forEach((colIndex) => {
      const formatted = formatElement({ element: props.data[1][colIndex], column: props.columns[colIndex], isChart: true })
      expect(tooltip).toContain(`</strong> ${formatted}</div>`)
    })
    expect(tooltip).toContain('Sales &lt;b&gt;')
  })

  test('hovering one vertex highlights every vertex in its stack', () => {
    const wrapper = setup(makeMultiSeriesVerticalProps())
    getStackDots(wrapper, 'Beta').at(0).simulate('mouseenter')
    getStackDots(wrapper, 'Beta').forEach((dot) => expect(dot.hasClass('hovered')).toBe(true))
    getStackDots(wrapper, 'Alpha').forEach((dot) => expect(dot.hasClass('hovered')).toBe(false))

    getStackDots(wrapper, 'Beta').at(0).simulate('mouseleave')
    getStackDots(wrapper, 'Beta').forEach((dot) => expect(dot.hasClass('hovered')).toBe(false))
  })

  test('clicking a vertex drills down on the row and keeps the whole stack active', () => {
    const onChartClick = jest.fn()
    const props = makeMultiSeriesVerticalProps({ onChartClick })
    const wrapper = setup(props)

    getStackDots(wrapper, 'Gamma').at(1).simulate('click')

    expect(onChartClick).toHaveBeenCalledTimes(1)
    expect(onChartClick.mock.calls[0][0].row).toBe(props.data[2])
    getStackDots(wrapper, 'Gamma').forEach((dot) => expect(dot.hasClass('active')).toBe(true))
    getStackDots(wrapper, 'Alpha').forEach((dot) => expect(dot.hasClass('active')).toBe(false))
  })

  test('pivot data keeps per-vertex tooltips and hover', () => {
    const wrapper = setup(toPivotProps(makeMultiSeriesVerticalProps()))
    const dots = getStackDots(wrapper, 'Beta')
    expect(new Set(dots.map((dot) => dot.prop('data-tooltip-html'))).size).toBe(3)

    dots.at(0).simulate('mouseenter')
    expect(getStackDots(wrapper, 'Beta').filterWhere((dot) => dot.hasClass('hovered')).length).toBe(0)
  })

  test('split-by series keep per-vertex tooltips', () => {
    const wrapper = setup(toSplitProps(makeMultiSeriesVerticalProps()))
    const dots = getStackDots(wrapper, 'Beta')
    expect(new Set(dots.map((dot) => dot.prop('data-tooltip-html'))).size).toBe(3)
  })
})
