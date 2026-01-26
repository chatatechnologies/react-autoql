import React from 'react'
import { mount } from 'enzyme'
import StringAxisSelector from './StringAxisSelector'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'

const pivotSampleProps = sampleProps.pivot
const defaultProps = StringAxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <StringAxisSelector {...setupProps}>
        <div data-test='string-axis-selector'>test</div>
      </StringAxisSelector>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders string axis selector if string column provided', () => {
    const wrapper = setup(pivotSampleProps)
    const stringSelector = findByTestAttr(wrapper, 'string-axis-selector')
    expect(stringSelector.exists()).toBe(true)
  })
})

describe('behavior', () => {
  test('calls changeLegendColumnIndex when useLegendHandler is true', () => {
    const changeLegend = jest.fn()
    const changeString = jest.fn()
    const closeSelector = jest.fn()

    const columns = [
      { display_name: 'A', is_visible: true, groupable: true, isStringType: true, index: 0 },
      { display_name: 'B', is_visible: true, groupable: true, isStringType: true, index: 1 },
    ]

    const props = {
      columns,
      numberColumnIndices: [],
      hasSecondAxis: false,
      dateColumnsOnly: false,
      hidden: false,
      isOpen: true,
      popoverParentElement: null,
      positions: ['bottom'],
      align: 'center',
      scale: { column: { index: 0 } },
      closeSelector,
      changeLegendColumnIndex: changeLegend,
      changeStringColumnIndex: changeString,
      useLegendHandler: true,
      axisSelectorRef: () => {},
      chartContainerRef: { clientHeight: 500 },
    }

    const wrapper = mount(
      <svg width='300px' height='300px'>
        <StringAxisSelector {...props}>
          <div data-test='string-axis-selector'>test</div>
        </StringAxisSelector>
      </svg>,
    )

    const instance = wrapper.find(StringAxisSelector).instance()
    const content = instance.renderSelectorContent({})
    const mountedContent = mount(content)

    const firstItem = mountedContent.find('li.string-select-list-item').first()
    firstItem.simulate('click')

    expect(closeSelector).toHaveBeenCalled()
    expect(changeLegend).toHaveBeenCalledWith(0)
    expect(changeString).not.toHaveBeenCalled()
  })
})

describe('getAllStringColumnIndices edge cases', () => {
  test('returns only groupable columns when grouped', () => {
    const props = {
      columns: [
        { display_name: 'A', groupable: true, type: 'STRING', is_visible: true },
        { display_name: 'B', groupable: true, type: 'STRING', is_visible: true },
        { display_name: 'C', groupable: false, type: 'QUANTITY', is_visible: true },
      ],
      numberColumnIndices: [],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: false,
      hidden: false,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(StringAxisSelector).instance()
    expect(instance.getAllStringColumnIndices()).toEqual([0, 1])
  })

  test('resolves originalColumns by display_name when canonical ids differ', () => {
    const props = {
      columns: [
        { display_name: 'Dim', index: 10, type: 'STRING', is_visible: true },
        { display_name: 'Num', index: 11, type: 'QUANTITY', is_visible: true },
      ],
      originalColumns: [
        { display_name: 'Dim', index: 100 },
        { display_name: 'Num', index: 101 },
      ],
      numberColumnIndices: [101],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: false,
      hidden: false,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(StringAxisSelector).instance()
    expect(instance.getAllStringColumnIndices()).toEqual([0])
  })

  test('uses positional indices when col.index is undefined', () => {
    const props = {
      columns: [
        { display_name: 'Dim', type: 'STRING', is_visible: true },
        { display_name: 'Num', type: 'QUANTITY', is_visible: true },
      ],
      numberColumnIndices: [1],
      numberColumnIndices2: [],
      hasSecondAxis: false,
      isAggregated: false,
      hidden: false,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(StringAxisSelector).instance()
    expect(instance.getAllStringColumnIndices()).toEqual([0])
  })

  test('respects second axis numberColumnIndices2 when hasSecondAxis is true', () => {
    const props = {
      columns: [
        { display_name: 'Dim', type: 'STRING', is_visible: true },
        { display_name: 'Num', type: 'QUANTITY', is_visible: true },
      ],
      numberColumnIndices: [],
      numberColumnIndices2: [0],
      hasSecondAxis: true,
      isAggregated: false,
      hidden: false,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(StringAxisSelector).instance()
    // column 0 is on the second numeric axis but is string-typed, so included;
    // column 1 is not marked on any number axis here so included as well
    expect(instance.getAllStringColumnIndices()).toEqual([0, 1])
  })
})
