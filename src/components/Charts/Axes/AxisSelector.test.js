import React from 'react'
import { mount } from 'enzyme'
import AxisSelector from './AxisSelector'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'
import { getBandScale, getLinearScale, getNumberColumnIndices, getStringColumnIndices } from 'autoql-fe-utils'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = AxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <AxisSelector {...setupProps}>
        <div>test</div>
      </AxisSelector>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders axis selector if linear scale', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      scale: getLinearScale({
        ...pivotSampleProps,
        columnIndices: getNumberColumnIndices(pivotSampleProps.columns)?.numberColumnIndices,
      }),
      // scale: pivotSampleProps.numberScale({
      //   column: {
      //     display_name: 'Total Volume',
      //     groupable: false,
      //     is_visible: true,
      //     multi_series: false,
      //     name: 'sum(v_volume.volume)',
      //     type: 'QUANTITY',
      //   },
      // }),
    })
    const numberSelector = findByTestAttr(wrapper, 'number-axis-selector')
    expect(numberSelector.exists()).toBe(true)
  })

  test('renders string axis selector if band scale', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      scale: getBandScale({
        ...pivotSampleProps,
        stringColumnIndices: getStringColumnIndices(pivotSampleProps.columns)?.stringColumnIndices,
      }),
      // pivotSampleProps.stringScale({
      //   column: {
      //     display_name: 'Sector',
      //     groupable: true,
      //     is_visible: true,
      //     multi_series: false,
      //     name: 'company.sector',
      //     type: 'STRING',
      //   },
      // }),
    })
    const stringSelector = findByTestAttr(wrapper, 'string-axis-selector')
    expect(stringSelector.exists()).toBe(true)
  })
})
