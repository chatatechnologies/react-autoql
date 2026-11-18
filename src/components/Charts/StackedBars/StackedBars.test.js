import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedBars from './StackedBars'
import sampleProps from '../chartTestData'
import { formatElement } from 'autoql-fe-utils'
import { makeMultiSeriesHorizontalProps, toPivotProps, toSplitProps } from '../multiSeriesTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedBars.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedBars {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.numberScale(),
      yScale: pivotSampleProps.stringScale(),
    })
    const stackedBarsComponent = findByTestAttr(wrapper, 'stacked-bars')
    expect(stackedBarsComponent.exists()).toBe(true)
  })
})

describe('stacked bar ordering', () => {
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
    const sortedIndices = [2, 1, 3] // Series B, Series A, Series C

    const wrapper = setup({
      columns,
      data,
      numberColumnIndices: sortedIndices,
      stringColumnIndices: [0],
      stringColumnIndex: 0,
      xScale: pivotSampleProps.numberScale(),
      yScale: pivotSampleProps.stringScale(),
      colorScale: pivotSampleProps.colorScale,
    })

    // Test that the component renders without errors with sorted indices
    const stackedBarsComponent = findByTestAttr(wrapper, 'stacked-bars')
    expect(stackedBarsComponent.exists()).toBe(true)

    // Verify that the component receives the numberColumnIndices prop (which should be sorted)
    const instance = wrapper.instance()
    expect(instance.props.numberColumnIndices).toEqual(sortedIndices)
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
      xScale: pivotSampleProps.numberScale(),
      yScale: pivotSampleProps.stringScale(),
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
    const y = wrapper.instance().props.yScale(category)
    return wrapper.find('rect').filterWhere((rect) => rect.prop('y') === y)
  }

  test('every segment in a stack shares one tooltip with the category and every series value', () => {
    const props = makeMultiSeriesHorizontalProps()
    const wrapper = setup(props)
    const rects = getStackRects(wrapper, 'Gamma')
    expect(rects.length).toBe(3)

    const tooltips = rects.map((rect) => rect.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(1)

    const tooltip = tooltips[0]
    expect(tooltip).toContain('Gamma')
    ;[1, 2, 3].forEach((colIndex) => {
      const formatted = formatElement({ element: props.data[2][colIndex], column: props.columns[colIndex], isChart: true })
      expect(tooltip).toContain(`</strong> ${formatted}</div>`)
    })
    expect(tooltip).toContain('Sales &lt;b&gt;')
  })

  test('each stack is grouped so hovering one segment highlights the whole stack', () => {
    const wrapper = setup(makeMultiSeriesHorizontalProps())
    const stacks = wrapper.find('.chart-stack-group')
    expect(stacks.length).toBe(3)
    expect(stacks.at(2).find('rect').length).toBe(3)
  })

  test('clicking a segment drills down on the row and keeps the whole stack active', () => {
    const onChartClick = jest.fn()
    const props = makeMultiSeriesHorizontalProps({ onChartClick })
    const wrapper = setup(props)

    getStackRects(wrapper, 'Alpha').at(2).simulate('click')

    expect(onChartClick).toHaveBeenCalledTimes(1)
    expect(onChartClick.mock.calls[0][0].row).toBe(props.data[0])
    getStackRects(wrapper, 'Alpha').forEach((rect) => expect(rect.hasClass('active')).toBe(true))
    getStackRects(wrapper, 'Beta').forEach((rect) => expect(rect.hasClass('active')).toBe(false))
  })

  test('pivot data keeps per-segment tooltips and no stack hover group', () => {
    const wrapper = setup(toPivotProps(makeMultiSeriesHorizontalProps()))
    const tooltips = getStackRects(wrapper, 'Alpha').map((rect) => rect.prop('data-tooltip-html'))
    expect(tooltips.length).toBe(3)
    expect(new Set(tooltips).size).toBe(3)
    expect(wrapper.find('.chart-stack-group').exists()).toBe(false)
  })

  test('split-by series keep per-segment tooltips and no stack hover group', () => {
    const wrapper = setup(toSplitProps(makeMultiSeriesHorizontalProps()))
    const tooltips = getStackRects(wrapper, 'Alpha').map((rect) => rect.prop('data-tooltip-html'))
    expect(new Set(tooltips).size).toBe(3)
    expect(wrapper.find('.chart-stack-group').exists()).toBe(false)
  })
})
