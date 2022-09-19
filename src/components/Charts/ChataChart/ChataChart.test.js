import React from 'react'
import { shallow } from 'enzyme'
import ChataChart from './ChataChart'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'
import { QueryOutput } from '../../QueryOutput/QueryOutput'
import testCases from '../../../../test/responseTestCases'

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list

const defaultProps = ChataChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  describe('list data', () => {
    test('bar', () => {
      const wrapper = setup({ ...listSampleProps, type: 'bar' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })

  describe('pivot data', () => {
    test('stacked-column', () => {
      const wrapper = setup({ ...pivotSampleProps, type: 'stacked-column' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })

  describe('date pivot data', () => {
    test('heatmap', () => {
      const wrapper = setup({ ...datePivotSampleProps, type: 'heatmap' })
      const chartComponent = findByTestAttr(wrapper, 'react-autoql-chart')
      expect(chartComponent.exists()).toBe(true)
    })
  })
})

// describe('tooltip content', () => {
//   const wrapper = mount(
//     <QueryOutput queryResponse={testCases[11]} initialDisplayType="text" />
//   )
// })
