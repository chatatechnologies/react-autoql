import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataLineChart from './ChataLineChart'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list
const defaultProps = ChataLineChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataLineChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const lineChartComponent = findByTestAttr(wrapper, 'react-autoql-line-chart')
    expect(lineChartComponent.exists()).toBe(true)
  })

  test('renders list data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const lineChartComponent = findByTestAttr(wrapper, 'react-autoql-line-chart')
    expect(lineChartComponent.exists()).toBe(true)
  })

  test('renders list data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const lineChartComponent = findByTestAttr(wrapper, 'react-autoql-line-chart')
    expect(lineChartComponent.exists()).toBe(true)
  })
})
