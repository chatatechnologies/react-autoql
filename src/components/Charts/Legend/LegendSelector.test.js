import React from 'react'
import { mount } from 'enzyme'
import LegendSelector from './LegendSelector'
import { findByTestAttr } from '../../../../test/testUtils'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const defaultProps = LegendSelector.defaultProps

const setup = (props = {}) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <LegendSelector {...setupProps}>
      <div data-test='legend-selector'>test</div>
    </LegendSelector>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders legend selector', () => {
    const wrapper = setup({
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
      ],
      legendColumn: { display_name: 'A', index: 0 },
      tableConfig: { numberColumnIndices: [], numberColumnIndices2: [] },
    })
    const selector = findByTestAttr(wrapper, 'legend-selector')
    expect(selector.exists()).toBe(true)
  })
})

describe('getAllStringColumnIndices for pivot data', () => {
  test('returns only groupable columns when isAggregated is true', () => {
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
      tableConfig: { numberColumnIndices: [], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should only return groupable columns (A and B)
    expect(indices).toEqual([0, 1])
  })

  test('excludes non-groupable number columns when isAggregated is true', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [2],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: true,
      tableConfig: { numberColumnIndices: [2], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should only return groupable columns, not number columns
    expect(indices).toEqual([0, 1])
  })

  test('returns all non-number columns when isAggregated is false', () => {
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
      tableConfig: { numberColumnIndices: [2], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should return all string columns not on number axis
    expect(indices).toEqual([0, 1])
  })
})

describe('pivot axis swapping', () => {
  const pivotProps = (overrides = {}) => ({
    columns: [
      { display_name: 'Year', groupable: true, type: 'QUANTITY', is_visible: true, index: 0 },
      { display_name: 'Product', groupable: true, type: 'STRING', is_visible: true, index: 1 },
      { display_name: 'Sales', groupable: false, type: 'DOLLAR_AMT', is_visible: true, index: 2 },
    ],
    isAggregated: true,
    // In pivot mode these are pivot column indices, not indices into the columns above
    numberColumnIndices: [1, 2, 3],
    numberColumnIndices2: [],
    tableConfig: { stringColumnIndex: 1, numberColumnIndices: [1, 2, 3], numberColumnIndices2: [] },
    stringColumnIndex: 1,
    legendColumn: { display_name: 'Year', index: 0 },
    ...overrides,
  })

  test('includes groupable columns that are not string typed', () => {
    const instance = setup(pivotProps()).find(LegendSelector).instance()
    expect(instance.getAllStringColumnIndices()).toContain(0)
  })

  test('keeps the column on the string axis so it can be swapped onto the legend', () => {
    const instance = setup(pivotProps()).find(LegendSelector).instance()
    expect(instance.getAllStringColumnIndices()).toEqual([0, 1])
  })

  test('does not filter original columns by pivot column indices', () => {
    const instance = setup(pivotProps()).find(LegendSelector).instance()
    // Product is original index 1, which is also a pivot number column index — it must survive
    expect(instance.getAllStringColumnIndices()).toContain(1)
  })
})

describe('renderSelectorContent', () => {
  test('uses getAllStringColumnIndices when isAggregated is true', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: true,
      tableConfig: { numberColumnIndices: [], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
      isOpen: true,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()

    // Mock getAllStringColumnIndices to verify it's called
    const getAllStringColumnIndicesSpy = jest.spyOn(instance, 'getAllStringColumnIndices')
    getAllStringColumnIndicesSpy.mockReturnValue([0, 1])

    instance.renderSelectorContent()

    // Should call getAllStringColumnIndices when isAggregated is true
    expect(getAllStringColumnIndicesSpy).toHaveBeenCalled()

    getAllStringColumnIndicesSpy.mockRestore()
  })
})
