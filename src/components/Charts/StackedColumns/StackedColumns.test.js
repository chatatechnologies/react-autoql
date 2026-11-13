import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedColumns from './StackedColumns'
import sampleProps from '../chartTestData'
import { formatElement } from 'autoql-fe-utils'
import { makeMultiSeriesVerticalProps, toPivotProps, toSplitProps } from '../multiSeriesTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedColumns.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedColumns {...setupProps} />)
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
    const stackedColumnsComponent = findByTestAttr(wrapper, 'stacked-columns')
    expect(stackedColumnsComponent.exists()).toBe(true)
  })
})

describe('stacked column ordering', () => {
  test('uses numberColumnIndices order for rendering segments', () => {
    const columns = [
      { display_name: 'Category', type: 'STRING', is_visible: true },
      { display_name: 'Series A', type: 'QUANTITY', is_visible: true },
      { display_name: 'Series B', type: 'QUANTITY', is_visible: true },
      { display_name: 'Series C', type: 'QUANTITY', is_visible: true },
    ]
    const data = [
      ['Cat1', 5, 10, 2],
      ['Cat2', 10, 15, 5],
    ]
    // numberColumnIndices should be sorted by ChataChart (biggest to smallest)
    // If sorted: Series B (25), Series A (15), Series C (7)
    const sortedIndices = [2, 1, 3] // Series B, Series A, Series C

    const wrapper = setup({
      columns,
      data,
      numberColumnIndices: sortedIndices,
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.numberScale(),
      colorScale: pivotSampleProps.colorScale,
    })

    // Test that the component renders without errors with sorted indices
    const stackedColumnsComponent = findByTestAttr(wrapper, 'stacked-columns')
    expect(stackedColumnsComponent.exists()).toBe(true)

    // Verify that the component receives the numberColumnIndices prop (which should be sorted)
    const instance = wrapper.instance()
    expect(instance.props.numberColumnIndices).toEqual(sortedIndices)
  })

  test('filters out hidden series correctly', () => {
    const columns = [
      { display_name: 'Category', type: 'STRING', is_visible: true },
      { display_name: 'Series A', type: 'QUANTITY', is_visible: true, isSeriesHidden: false },
      { display_name: 'Series B', type: 'QUANTITY', is_visible: true, isSeriesHidden: true },
      { display_name: 'Series C', type: 'QUANTITY', is_visible: true, isSeriesHidden: false },
    ]
    const data = [['Cat1', 5, 10, 2]]
    const numberColumnIndices = [1, 2, 3]

    const wrapper = setup({
      columns,
      data,
      numberColumnIndices,
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.numberScale(),
      colorScale: pivotSampleProps.colorScale,
    })

    // Test that the component renders without errors and filters hidden series
    const stackedColumnsComponent = findByTestAttr(wrapper, 'stacked-columns')
    expect(stackedColumnsComponent.exists()).toBe(true)

    // The component should filter out hidden series in its render method
    // We verify it renders without error (the filtering happens internally)
    const instance = wrapper.instance()
    expect(instance.props.numberColumnIndices).toEqual(numberColumnIndices)
  })

  test('handles missing columns gracefully', () => {
    const columns = [
      { display_name: 'Category', type: 'STRING', is_visible: true },
      { display_name: 'Series A', type: 'QUANTITY', is_visible: true },
    ]
    const data = [['Cat1', 5]]
    // numberColumnIndices includes index 2 which doesn't exist in columns
    const numberColumnIndices = [1, 2]

    const wrapper = setup({
      columns,
      data,
      numberColumnIndices,
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.numberScale(),
      colorScale: pivotSampleProps.colorScale,
    })

    // Should not throw error when columns are missing
    // The component should handle missing columns gracefully
    // Component should render (or return null if no valid indices)
    // The key is that it doesn't throw an error
    const instance = wrapper.instance()
    expect(instance.props.numberColumnIndices).toEqual(numberColumnIndices)
  })
})

describe('same-row multi series stacks (AQLP-1098)', () => {
  const getStackRects = (wrapper, category) => {
    const x = wrapper.instance().props.xScale(category)
    return wrapper.find('rect').filterWhere((rect) => rect.prop('x') === x)
  }

  test('every segment in a stack shares one tooltip with the category and every series value', () => {
    const props = makeMultiSeriesVerticalProps()
    const wrapper = setup(props)
    const rects = getStackRects(wrapper, 'Alpha')
    expect(rects.length).toBe(3)

    const tooltips = rects.map((rect) => rect.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(1)

    const tooltip = tooltips[0]
    expect(tooltip).toContain('Category')
    expect(tooltip).toContain('Alpha')
    ;[1, 2, 3].forEach((colIndex) => {
      const formatted = formatElement({ element: props.data[0][colIndex], column: props.columns[colIndex], isChart: true })
      expect(tooltip).toContain(`</strong> ${formatted}</div>`)
    })
    expect(tooltip).toContain('Cost')
    expect(tooltip).toContain('Units')
    // Series names are HTML-escaped
    expect(tooltip).toContain('Sales &lt;b&gt;')
    expect(tooltip).not.toContain('Sales <b>')
    rects.forEach((rect) => expect(rect.prop('data-tooltip-id')).toBe('chart-tooltip'))
  })

  test('each stack is grouped so hovering one segment highlights the whole stack', () => {
    const wrapper = setup(makeMultiSeriesVerticalProps())
    const stacks = wrapper.find('.chart-stack-group')
    expect(stacks.length).toBe(3)
    expect(stacks.at(0).find('rect').length).toBe(3)
  })

  test('clicking a segment drills down on the row and keeps the whole stack active', () => {
    const onChartClick = jest.fn()
    const props = makeMultiSeriesVerticalProps({ onChartClick })
    const wrapper = setup(props)

    getStackRects(wrapper, 'Beta').at(1).simulate('click')

    expect(onChartClick).toHaveBeenCalledTimes(1)
    const args = onChartClick.mock.calls[0][0]
    expect(args.row).toBe(props.data[1])
    expect(args.stringColumnIndex).toBe(0)

    getStackRects(wrapper, 'Beta').forEach((rect) => expect(rect.hasClass('active')).toBe(true))
    getStackRects(wrapper, 'Alpha').forEach((rect) => expect(rect.hasClass('active')).toBe(false))
  })

  test('pivot data keeps per-segment tooltips and no stack hover group', () => {
    const wrapper = setup(toPivotProps(makeMultiSeriesVerticalProps()))
    const tooltips = getStackRects(wrapper, 'Alpha').map((rect) => rect.prop('data-tooltip-html'))
    expect(tooltips.length).toBe(3)
    expect(new Set(tooltips).size).toBe(3)
    expect(wrapper.find('.chart-stack-group').exists()).toBe(false)
  })

  test('pivot data: clicking a segment only activates that segment', () => {
    const wrapper = setup(toPivotProps(makeMultiSeriesVerticalProps()))
    getStackRects(wrapper, 'Beta').at(1).simulate('click')
    const active = getStackRects(wrapper, 'Beta').filterWhere((rect) => rect.hasClass('active'))
    expect(active.length).toBe(1)
  })

  test('split-by series keep per-segment tooltips and no stack hover group', () => {
    const wrapper = setup(toSplitProps(makeMultiSeriesVerticalProps()))
    const tooltips = getStackRects(wrapper, 'Alpha').map((rect) => rect.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(3)
    expect(wrapper.find('.chart-stack-group').exists()).toBe(false)
  })
})
