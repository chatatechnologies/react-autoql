import React from 'react'
import { mount } from 'enzyme'
import Axis from './Axis'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list

const defaultProps = Axis.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg>
      <Axis {...setupProps} />
    </svg>
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup({
      ...listSampleProps,
      col: listSampleProps.columns[listSampleProps.stringColumnIndex],
      scale: listSampleProps.stringScale,
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
      scale: pivotSampleProps.numberScale,
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup({
      ...datePivotSampleProps,
      col: datePivotSampleProps.columns[datePivotSampleProps.stringColumnIndex],
      scale: datePivotSampleProps.stringScale,
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })
})
