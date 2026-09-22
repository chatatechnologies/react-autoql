import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Line from './Line'
import sampleProps from '../chartTestData'
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

  test('clicking the area drills down on the closest vertex', () => {
    const onChartClick = jest.fn()
    const wrapper = setup(makeStubProps({ onChartClick }))
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    instance.getLocalCoords = () => ({ x: target.x, y: target.y + 50 })
    instance.onHoverAreaClick({})

    expect(onChartClick).toHaveBeenCalledTimes(1)
    expect(onChartClick.mock.calls[0][0].activeKey).toBe(target.key)
  })
})
