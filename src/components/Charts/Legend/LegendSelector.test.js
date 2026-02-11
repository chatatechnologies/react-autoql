import React from 'react'
import { mount } from 'enzyme'
import LegendSelector from './LegendSelector'
import { findByTestAttr } from '../../../../test/testUtils'

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
  test('returns only groupable string columns when isAggregation is true', () => {
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
      isAggregation: true,
      tableConfig: { numberColumnIndices: [], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should only return groupable string columns (A and B)
    // Note: checks col.type === 'STRING' and col.groupable
    expect(indices).toEqual([0, 1])
  })

  test('excludes number columns when isAggregation is true', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [2],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregation: true,
      tableConfig: { numberColumnIndices: [2], numberColumnIndices2: [] },
      legendColumn: { display_name: 'A', index: 0 },
    }

    const wrapper = setup(props)
    const instance = wrapper.find(LegendSelector).instance()
    const indices = instance.getAllStringColumnIndices()
    // Should only return groupable string columns, not number columns
    expect(indices).toEqual([0, 1])
  })

  test('returns all non-number columns when isAggregation is false', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: false, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [2],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregation: false,
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

describe('renderSelectorContent', () => {
  test('uses getAllStringColumnIndices when isAggregation is true', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true, index: 0 },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true, index: 1 },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true, index: 2 },
      ],
      numberColumnIndices: [],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregation: true,
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

    // Should call getAllStringColumnIndices when isAggregation is true
    expect(getAllStringColumnIndicesSpy).toHaveBeenCalled()

    getAllStringColumnIndicesSpy.mockRestore()
  })
})
