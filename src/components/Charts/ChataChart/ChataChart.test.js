import React from 'react'
import { shallow, mount } from 'enzyme'
import ChataChart from './ChataChart'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import testCases from '../../../../test/responseTestCases'
import * as chartHelpers from '../helpers'

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list

const defaultProps = ChataChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  describe('list data', () => {
    test('bar', () => {
      const wrapper = setup({ ...listSampleProps, type: 'bar' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })

  describe('pivot data', () => {
    test('stacked-column', () => {
      const wrapper = setup({ ...pivotSampleProps, type: 'stacked-column' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })

  describe('date pivot data', () => {
    test('heatmap', () => {
      const wrapper = setup({ ...datePivotSampleProps, type: 'heatmap' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })
})

describe('tooltip content renders correctly for pivot table data', () => {
  const testTooltipForDisplayType = async (displayType) => {
    const tooltipContentSpy = jest.spyOn(chartHelpers, 'getTooltipContent')
    const wrapper = mount(
      <QueryOutput queryResponse={testCases[11]} initialDisplayType={displayType} height={100} width={100} />,
    )
    await currentEventLoopEnd()
    const getTooltipContentResult = () => tooltipContentSpy.mock.results[0]?.value
    wrapper.update()

    const tooltipContent = getTooltipContentResult()
    jest.clearAllMocks()
    expect(tooltipContent).toMatchSnapshot()
  }

  test('column tooltip renders as expected', () => {
    testTooltipForDisplayType('column')
  })
  test('bar tooltip renders as expected', () => {
    testTooltipForDisplayType('bar')
  })
  test('line tooltip renders as expected', () => {
    testTooltipForDisplayType('line')
  })
  test('stacked column tooltip renders as expected', () => {
    testTooltipForDisplayType('stacked_column')
  })
  test('stacked bar tooltip renders as expected', () => {
    testTooltipForDisplayType('stacked_bar')
  })
  test('stacked line tooltip renders as expected', () => {
    testTooltipForDisplayType('stacked_line')
  })
  test('heatmap tooltip renders as expected', () => {
    testTooltipForDisplayType('heatmap')
  })
  test('bubble tooltip renders as expected', () => {
    testTooltipForDisplayType('bubble')
  })
})
