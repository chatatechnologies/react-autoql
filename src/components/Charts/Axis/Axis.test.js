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

describe('legend', () => {
  // test('does not render right legend by default', () => {
  //   const wrapper = setup()
  //   const legendElement = findByTestAttr(wrapper, 'right-legend')
  //   expect(legendElement.exists()).toBe(false)
  // })
  // test('does not render bottom legend by default', () => {
  //   const wrapper = setup()
  //   const legendElement = findByTestAttr(wrapper, 'bottom-legend')
  //   expect(legendElement.exists()).toBe(false)
  // })
  // todo: find a different way to test the d3 dom stuff because this doesnt work
  // test('renders right legend without title', () => {
  //   const wrapper = setup({ hasRightLegend: true, legendLabels })
  //   const legendElement = findByTestAttr(wrapper, 'right-legend')
  //   expect(legendElement.exists()).toBe(true)
  // })
  // test('renders bottom legend without title', () => {
  //   const wrapper = setup({ hasBottomLegend: true, legendLabels })
  //   const legendElement = findByTestAttr(wrapper, 'bottom-legend')
  //   expect(legendElement.exists()).toBe(true)
  // })
  // test('renders right legend with title', () => {
  //   const wrapper = setup({
  //     hasRightLegend: true,
  //     legendTitle: 'Legend',
  //     legendLabels,
  //   })
  //   const legendTitle = findByTestAttr(wrapper, 'legend-title')
  //   expect(legendTitle.exists()).toBe(true)
  // })
})
