import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataStackedBarChart from './ChataStackedBarChart'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = ChataStackedBarChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...sampleProps, ...props }
  const wrapper = shallow(<ChataStackedBarChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup(pivotSampleProps)
    const stackedBarChartComponent = findByTestAttr(wrapper, 'react-autoql-stacked-bar-chart')
    expect(stackedBarChartComponent.exists()).toBe(true)
  })
})
