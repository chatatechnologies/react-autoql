import React from 'react'
import { mount } from 'enzyme'
import StringAxisSelector from './StringAxisSelector'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

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
      isAggregated: true,
      hidden: false,
    }

    const wrapper = setup(props)
    const instance = wrapper.find(StringAxisSelector).instance()
    expect(instance.getAllStringColumnIndices()).toEqual([0, 1])
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
