import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Line from './Line'
import sampleProps from '../chartTestData'
import { formatElement } from 'autoql-fe-utils'
import { makeMultiSeriesVerticalProps, toPivotProps, toSplitProps } from '../multiSeriesTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

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

const defaultProps = Line.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Line {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })
})

describe('chart area hover', () => {
  // The shared sample scales have no dimensions, so use simple stub scales with
  // real ranges to exercise the hover geometry
  const makeStubProps = (props = {}) => {
    // One row per category - the sample pivot data repeats category values, which
    // would put several rows at the same x position
    const data = pivotSampleProps.data.filter(
      (row, index, rows) =>
        rows.findIndex((r) => r[pivotSampleProps.stringColumnIndex] === row[pivotSampleProps.stringColumnIndex]) ===
        index,
    )
    const categories = data.map((row) => row[pivotSampleProps.stringColumnIndex])
    const bandWidth = 400 / categories.length

    const xScale = (value) => categories.indexOf(value) * bandWidth
    xScale.getValue = xScale
    xScale.tickSize = bandWidth
    xScale.domain = () => categories
    xScale.range = () => [0, 400]

    const yScale = (value) => 200 - Number(value) / 100
    yScale.domain = () => [0, 20000]
    yScale.range = () => [200, 0]

    return { ...pivotSampleProps, data, xScale, yScale, enableAreaHover: true, ...props }
  }

  test('does not render hover area unless enabled', () => {
    const wrapper = setup(makeStubProps({ enableAreaHover: false }))
    expect(wrapper.find('.line-chart-hover-area').exists()).toBe(false)
  })

  test('renders hover area covering the plot when enabled', () => {
    const wrapper = setup(makeStubProps())
    const hoverArea = wrapper.find('.line-chart-hover-area')
    expect(hoverArea.exists()).toBe(true)
    expect(hoverArea.prop('width')).toBe(400)
    expect(hoverArea.prop('height')).toBe(200)
  })

  test('snaps to the vertex closest to the cursor', () => {
    const wrapper = setup(makeStubProps())
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    // Cursor is nowhere near the line itself, only close to it horizontally
    const closest = instance.getClosestPoint({ x: target.x + 1, y: target.y + 100 })
    expect(closest.key).toBe(target.key)
  })

  test('hovering the area sets the hovered vertex and tooltip', () => {
    const wrapper = setup(makeStubProps())
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    instance.getLocalCoords = () => ({ x: target.x, y: target.y + 100 })
    instance.onHoverAreaMouseMove({})

    expect(wrapper.state('hoveredKey')).toBe(target.key)
    expect(wrapper.state('hoveredVertex')).toEqual({ x: target.x, y: target.y, color: target.color })
    expect(wrapper.state('hoveredTooltip')).toBe(target.tooltip)

    instance.onHoverAreaMouseLeave()
    expect(wrapper.state('hoveredKey')).toBe(null)
    expect(wrapper.state('hoveredTooltip')).toBe(null)
  })

  test('clicking near a vertex drills down on it', () => {
    const onChartClick = jest.fn()
    const wrapper = setup(makeStubProps({ onChartClick }))
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    instance.getLocalCoords = () => ({ x: target.x, y: target.y + 5 })
    instance.onHoverAreaClick({})

    expect(onChartClick).toHaveBeenCalledTimes(1)
    expect(onChartClick.mock.calls[0][0].activeKey).toBe(target.key)
  })

  test('clicking the area far from the vertex still drills down on the hovered vertex', () => {
    const onChartClick = jest.fn()
    const wrapper = setup(makeStubProps({ onChartClick }))
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    instance.getLocalCoords = () => ({ x: target.x, y: target.y + 150 })
    instance.onHoverAreaClick({})

    expect(onChartClick).toHaveBeenCalledTimes(1)
    expect(onChartClick.mock.calls[0][0].activeKey).toBe(target.key)
  })
})

describe('multi series hover (AQLP-1098)', () => {
  // Fixture plot area: y=0 (top) to y=200 (x-axis)
  const getDotsAtX = (wrapper, category) => {
    const { xScale } = wrapper.instance().props
    const x = xScale.getValue(category) + xScale.tickSize / 2
    return wrapper.find('g.line-dot').filterWhere((g) => g.find('circle').first().prop('cx') === x)
  }

  const expectCombinedTooltip = (tooltip, props, rowIndex) => {
    expect(tooltip).toContain(props.data[rowIndex][0])
    ;[1, 2, 3].forEach((colIndex) => {
      const formatted = formatElement({
        element: props.data[rowIndex][colIndex],
        column: props.columns[colIndex],
        isChart: true,
      })
      expect(tooltip).toContain(`</strong> ${formatted}</div>`)
    })
    expect(tooltip).toContain('Sales &lt;b&gt;')
  }

  test('every vertex at one x shares a tooltip listing every series value', () => {
    const props = makeMultiSeriesVerticalProps()
    const wrapper = setup(props)
    const dots = getDotsAtX(wrapper, 'Beta')
    expect(dots.length).toBe(3)

    const tooltips = dots.map((dot) => dot.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(1)
    expectCombinedTooltip(tooltips[0], props, 1)
  })

  test('area hover shows the combined tooltip for every series at that x', () => {
    const props = makeMultiSeriesVerticalProps({ enableAreaHover: true })
    const wrapper = setup(props)
    const { points } = wrapper.instance().hoverPoints[2]
    expect(points.length).toBe(3)
    expect(new Set(points.map((point) => point.tooltip)).size).toBe(1)
    expectCombinedTooltip(points[0].tooltip, props, 2)
  })

  test('hovering a vertex highlights every vertex at that x', () => {
    const wrapper = setup(makeMultiSeriesVerticalProps())
    getDotsAtX(wrapper, 'Beta').at(0).simulate('mouseenter')
    getDotsAtX(wrapper, 'Beta').forEach((dot) => expect(dot.hasClass('hovered')).toBe(true))
    getDotsAtX(wrapper, 'Alpha').forEach((dot) => expect(dot.hasClass('hovered')).toBe(false))
  })

  test('pivot data keeps per-vertex tooltips and hover', () => {
    const wrapper = setup(toPivotProps(makeMultiSeriesVerticalProps()))
    const dots = getDotsAtX(wrapper, 'Beta')
    expect(new Set(dots.map((dot) => dot.prop('data-tooltip-html'))).size).toBe(3)

    dots.at(0).simulate('mouseenter')
    expect(getDotsAtX(wrapper, 'Beta').filterWhere((dot) => dot.hasClass('hovered')).length).toBe(1)
  })

  test('split-by series keep per-vertex tooltips', () => {
    const wrapper = setup(toSplitProps(makeMultiSeriesVerticalProps()))
    const dots = getDotsAtX(wrapper, 'Beta')
    expect(new Set(dots.map((dot) => dot.prop('data-tooltip-html'))).size).toBe(3)
  })
})

describe('hover line spans the plot height (AQLP-1098)', () => {
  const variants = {
    'multi series': (props) => props,
    pivot: toPivotProps,
    'single series': (props) => ({ ...props, numberColumnIndices: [2] }),
  }

  Object.entries(variants).forEach(([name, toProps]) => {
    test(`${name}: hovered vertex line runs from the top of the plot to the x-axis`, () => {
      const wrapper = setup(toProps(makeMultiSeriesVerticalProps()))
      wrapper.setState({ hoveredKey: '2-1-0', hoveredVertex: { x: 150, y: 120, color: 'red' } })
      const line = wrapper.find('.line-hover-indicator')
      expect(line.length).toBe(1)
      expect(line.prop('y1')).toBe(0)
      expect(line.prop('y2')).toBe(200)
      expect(line.prop('x1')).toBe(150)
      expect(line.prop('x2')).toBe(150)
    })

    test(`${name}: active vertex line runs from the top of the plot to the x-axis`, () => {
      // Active vertex: series 2 ("Cost") at row 1 ("Beta")
      const wrapper = setup(toProps(makeMultiSeriesVerticalProps({ activeChartElementKey: '2-1-0' })))
      expect(wrapper.state('activeVertex')).toBeTruthy()
      const line = wrapper.find('.line-hover-indicator')
      expect(line.length).toBe(1)
      expect(line.prop('y1')).toBe(0)
      expect(line.prop('y2')).toBe(200)
    })
  })
})
