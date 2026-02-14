import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataScatterplotChart from './ChataScatterplotChart'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const listSampleProps = sampleProps.list
const defaultProps = ChataScatterplotChart.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataScatterplotChart {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup(listSampleProps)
    const scatterplotChartComponent = findByTestAttr(wrapper, 'react-autoql-scatterplot-chart')
    expect(scatterplotChartComponent.exists()).toBe(true)
  })
})
