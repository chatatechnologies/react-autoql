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
  test('does not render hover area unless enabled', () => {
    const wrapper = setup(listSampleProps)
    expect(wrapper.find('.line-chart-hover-area').exists()).toBe(false)
  })

  test('renders hover area covering the plot when enabled', () => {
    const wrapper = setup({ ...listSampleProps, enableAreaHover: true })
    const hoverArea = wrapper.find('.line-chart-hover-area')
    expect(hoverArea.exists()).toBe(true)
    expect(hoverArea.prop('width')).toBeGreaterThan(0)
    expect(hoverArea.prop('height')).toBeGreaterThan(0)
  })

  test('snaps to the vertex closest to the cursor', () => {
    const wrapper = setup({ ...listSampleProps, enableAreaHover: true })
    const instance = wrapper.instance()
    const target = instance.hoverPoints[1].points[0]

    // Cursor is nowhere near the line itself, only near it horizontally
    const closest = instance.getClosestPoint({ x: target.x + 1, y: target.y + 100 })
    expect(closest.key).toBe(target.key)
  })

  test('hovering the area sets the hovered vertex and tooltip', () => {
    const wrapper = setup({ ...listSampleProps, enableAreaHover: true })
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
})
