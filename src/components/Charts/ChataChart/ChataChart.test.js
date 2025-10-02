import React from 'react'
import { currentEventLoopEnd, getTooltipContent } from 'autoql-fe-utils'
import { shallow, mount } from 'enzyme'
import ChataChart from './ChataChart'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import testCases from '../../../../test/responseTestCases'

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

  describe('chart controls', () => {
    test('shows chart controls when enableChartControls is true', () => {
      const wrapper = setup({ ...listSampleProps, type: 'column', enableChartControls: true })
      const chartControls = wrapper.find('.chart-control-buttons')
      expect(chartControls.exists()).toBe(true)
    })

    test('hides chart controls when enableChartControls is false', () => {
      const wrapper = setup({ ...listSampleProps, type: 'column', enableChartControls: false })
      const chartControls = wrapper.find('.chart-control-buttons')
      expect(chartControls.exists()).toBe(false)
    })
  })

  describe('pivot data', () => {
    test('stacked-column', () => {
      const wrapper = setup({ ...pivotSampleProps, type: 'stacked_column' })
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
    const tooltipContentSpy = jest.spyOn({ getTooltipContent }, 'getTooltipContent')
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
