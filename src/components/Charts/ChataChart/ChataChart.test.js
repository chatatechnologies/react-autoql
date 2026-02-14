import React from 'react'
import { currentEventLoopEnd, getTooltipContent } from 'autoql-fe-utils'
import { shallow, mount } from 'enzyme'
import ChataChart from './ChataChart'
import StringAxisSelector from '../Axes/StringAxisSelector'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import testCases from '../../../../test/responseTestCases'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

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

    test('uses initial chart control values', () => {
      const initialControls = { showAverageLine: true, showRegressionLine: true }
      const wrapper = setup({
        ...listSampleProps,
        type: 'column',
        enableChartControls: true,
        initialChartControls: initialControls,
      })
      expect(wrapper.state('showAverageLine')).toBe(true)
      expect(wrapper.state('showRegressionLine')).toBe(true)
    })

    test('calls onChartControlsChange when toggles are changed', () => {
      const onChartControlsChange = jest.fn()
      const wrapper = setup({
        ...listSampleProps,
        type: 'column',
        enableChartControls: true,
        onChartControlsChange,
      })

      // Toggle average line
      wrapper.instance().toggleAverageLine()
      expect(onChartControlsChange).toHaveBeenCalledWith({
        showAverageLine: true,
        showRegressionLine: false,
      })

      // Toggle regression line (should turn off average line due to radio button behavior)
      wrapper.instance().toggleRegressionLine()
      expect(onChartControlsChange).toHaveBeenCalledWith({
        showAverageLine: false,
        showRegressionLine: true,
      })
    })

    test('does not show regression line toggle for horizontal bar charts', () => {
      const wrapper = setup({
        ...listSampleProps,
        type: 'bar',
        enableChartControls: true,
      })

      // shouldShowRegressionLine should return false for bar charts
      expect(wrapper.instance().shouldShowRegressionLine()).toBe(false)

      // RegressionLineToggle should not be rendered
      const regressionToggle = wrapper.find('RegressionLineToggle')
      expect(regressionToggle.exists()).toBe(false)
    })

    test('shows regression line toggle for supported chart types', () => {
      const supportedTypes = ['column', 'stacked_column', 'line', 'scatterplot']

      supportedTypes.forEach((chartType) => {
        const wrapper = setup({
          ...listSampleProps,
          type: chartType,
          enableChartControls: true,
        })

        expect(wrapper.instance().shouldShowRegressionLine()).toBe(true)
      })
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

describe('stacked chart sorting', () => {
  test('sorts stacked column chart segments by total aggregates (biggest to smallest)', () => {
    const columns = [
      { display_name: 'Category', type: 'STRING', is_visible: true },
      { display_name: 'Series A', type: 'QUANTITY', is_visible: true },
      { display_name: 'Series B', type: 'QUANTITY', is_visible: true },
      { display_name: 'Series C', type: 'QUANTITY', is_visible: true },
    ]
    // Series B has highest total (30), Series A has middle (20), Series C has lowest (10)
    const data = [
      ['Cat1', 5, 10, 2], // Series A: 5, Series B: 10, Series C: 2
      ['Cat2', 10, 15, 5], // Series A: 10, Series B: 15, Series C: 5
      ['Cat3', 5, 5, 3], // Series A: 5, Series B: 5, Series C: 3
    ]
    // Totals: Series A = 20, Series B = 30, Series C = 10
    // Expected order: Series B (30), Series A (20), Series C (10)

    const wrapper = setup({
      columns,
      data,
      type: 'stacked_column',
      numberColumnIndices: [1, 2, 3],
      stringColumnIndex: 0,
      isDataAggregated: true,
    })

    const instance = wrapper.instance()
    // Call getData to trigger sorting calculation
    // getData needs all required props including numberColumnIndex
    const dataResult = instance.getData({
      columns,
      data,
      type: 'stacked_column',
      numberColumnIndices: [1, 2, 3],
      numberColumnIndex: 1,
      stringColumnIndex: 0,
      isDataAggregated: true,
      tableConfig: { stringColumnIndex: 0, numberColumnIndex: 1 },
    })

    // Verify sorted indices are stored
    expect(instance.sortedNumberColumnIndicesForStacked).toEqual([2, 1, 3]) // Series B, Series A, Series C
    expect(dataResult).toBeDefined()
    expect(dataResult.data).toBeDefined()
  })

  test('sorts stacked bar chart segments by total aggregates (biggest to smallest)', () => {
    const columns = [
      { display_name: 'Category', type: 'STRING', is_visible: true },
      { display_name: 'Series A', type: 'QUANTITY', is_visible: true },
      { display_name: 'Series B', type: 'QUANTITY', is_visible: true },
    ]
    const data = [
      ['Cat1', 10, 20], // Series A: 10, Series B: 20
      ['Cat2', 5, 15], // Series A: 5, Series B: 15
    ]
    // Totals: Series A = 15, Series B = 35
    // Expected order: Series B (35), Series A (15)

    const wrapper = setup({
      columns,
      data,
      type: 'stacked_bar',
      numberColumnIndices: [1, 2],
      stringColumnIndex: 0,
      isDataAggregated: true,
    })

    const instance = wrapper.instance()
    // Call getData to trigger sorting calculation
    const dataResult = instance.getData({
      columns,
      data,
      type: 'stacked_bar',
      numberColumnIndices: [1, 2],
      numberColumnIndex: 1,
      stringColumnIndex: 0,
      isDataAggregated: true,
      tableConfig: { stringColumnIndex: 0, numberColumnIndex: 1 },
    })

    // Verify sorted indices are stored
    expect(instance.sortedNumberColumnIndicesForStacked).toEqual([2, 1]) // Series B, Series A
    expect(dataResult).toBeDefined()
    expect(dataResult.data).toBeDefined()
  })

  test('does not sort non-stacked charts', () => {
    const wrapper = setup({
      ...listSampleProps,
      type: 'column',
    })

    const instance = wrapper.instance()
    const dataResult = instance.getData({
      ...listSampleProps,
      type: 'column',
    })

    // Non-stacked charts should not have sorted indices
    expect(instance.sortedNumberColumnIndicesForStacked).toBeNull()
    expect(dataResult).toBeDefined()
  })
})

describe('data limit warning', () => {
  test('shouldShowDataLimitWarning returns true when data is limited', () => {
    const wrapper = setup({
      ...listSampleProps,
      type: 'column',
      isDataLimited: true,
      rowLimit: 100,
      enableChartControls: true,
    })

    const instance = wrapper.instance()
    expect(instance.shouldShowDataLimitWarning()).toBe(true)
  })

  test('shouldShowDataLimitWarning returns false when data is not limited', () => {
    const wrapper = setup({
      ...listSampleProps,
      type: 'column',
      isDataLimited: false,
      enableChartControls: true,
    })

    const instance = wrapper.instance()
    expect(instance.shouldShowDataLimitWarning()).toBe(false)
  })
})

describe('getAllStringColumnIndices for pivot data', () => {
  test('StringAxisSelector returns only groupable string columns when isAggregated is true', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
        { display_name: 'D', groupable: false, type: 'STRING', is_visible: true, index: 3 },
      ],
      numberColumnIndices: [],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: true,
      hidden: false,
    }

    const wrapper = mount(
      <svg>
        <StringAxisSelector {...StringAxisSelector.defaultProps} {...props}>
          <div>test</div>
        </StringAxisSelector>
      </svg>,
    )

    const instance = wrapper.find(StringAxisSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should only return groupable string columns (A and B)
    // Note: isColumnStringType checks the type, so columns with type: 'STRING' should pass
    expect(indices).toEqual([0, 1])
  })

  test('StringAxisSelector returns all non-number columns when isAggregated is false', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: false, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [2],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: false,
      hidden: false,
    }

    const wrapper = mount(
      <svg>
        <StringAxisSelector {...StringAxisSelector.defaultProps} {...props}>
          <div>test</div>
        </StringAxisSelector>
      </svg>,
    )

    const instance = wrapper.find(StringAxisSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should return all string columns not on number axis
    expect(indices).toEqual([0, 1])
  })
})
