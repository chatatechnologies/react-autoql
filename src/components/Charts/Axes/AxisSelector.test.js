import React from 'react'
import { mount } from 'enzyme'
import AxisSelector from './AxisSelector'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'

const pivotSampleProps = sampleProps.pivot
const defaultProps = AxisSelector.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <AxisSelector {...setupProps} />
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders number axis selector if number column provided', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      column: {
        display_name: 'Total Volume',
        groupable: false,
        is_visible: true,
        multi_series: false,
        name: 'sum(v_volume.volume)',
        type: 'QUANTITY',
      },
    })
    const numberSelector = findByTestAttr(wrapper, 'number-axis-selector')
    expect(numberSelector.exists()).toBe(true)
  })

  test('renders string axis selector if number column provided', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      column: {
        display_name: 'Sector',
        groupable: true,
        is_visible: true,
        multi_series: false,
        name: 'company.sector',
        type: 'STRING',
      },
    })
    const stringSelector = findByTestAttr(wrapper, 'string-axis-selector')
    expect(stringSelector.exists()).toBe(true)
  })
})
