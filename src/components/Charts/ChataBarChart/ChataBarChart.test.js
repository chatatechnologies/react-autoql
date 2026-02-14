import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataBarChart from './ChataBarChart'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list

const defaultProps = ChataBarChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataBarChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const barChartComponent = findByTestAttr(wrapper, 'react-autoql-bar-chart')
    expect(barChartComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const barChartComponent = findByTestAttr(wrapper, 'react-autoql-bar-chart')
    expect(barChartComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const barChartComponent = findByTestAttr(wrapper, 'react-autoql-bar-chart')
    expect(barChartComponent.exists()).toBe(true)
  })
})
