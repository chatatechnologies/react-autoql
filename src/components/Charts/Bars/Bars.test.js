import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Bars from './Bars'
import sampleProps from '../chartTestData'

const scales = {
  xScale: sampleProps.pivot.numberScale,
  yScale: sampleProps.pivot.stringScale,
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

const defaultProps = Bars.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Bars {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })

  test('renders correctly when min value is greater than 0', () => {
    const wrapper = setup(listSampleProps)
    const barsComponent = findByTestAttr(wrapper, 'bars')
    expect(barsComponent.exists()).toBe(true)
  })

  test('renders first bar correctly', () => {
    const wrapper = setup(listSampleProps)
    const firstBar = findByTestAttr(wrapper, 'bar-0-0')
    expect(firstBar.exists()).toBe(true)
  })

  describe('active key', () => {
    test('no active key by default', () => {
      const wrapper = setup(listSampleProps)
      const activeKey = wrapper.state(['activeKey'])
      expect(activeKey).toBeUndefined()
    })
  })

  describe('on bar click', () => {
    test('does not crash when onChartClick is not provided', () => {
      const wrapper = setup(listSampleProps)
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
    })

    test('calls onChartClick when bar is clicked', () => {
      const onChartClick = jest.fn()
      const wrapper = setup({ ...listSampleProps, onChartClick })
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
      expect(onChartClick).toHaveBeenCalled()
    })

    test('sets active bar when clicked', () => {
      const wrapper = setup(listSampleProps)
      const firstBar = findByTestAttr(wrapper, 'bar-0-0')
      firstBar.simulate('click')
      const activeKey = wrapper.state(['activeKey'])
      expect(activeKey).toBeDefined()
    })
  })
})
