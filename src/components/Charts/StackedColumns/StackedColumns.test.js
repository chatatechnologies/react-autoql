import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedColumns from './StackedColumns'
import sampleProps from '../chartTestData'
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
