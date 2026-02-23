import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import ChataHistogram from './ChataHistogram'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const listSampleProps = sampleProps.list
const defaultProps = ChataHistogram.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<ChataHistogram {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders correctly with required props', () => {
    const wrapper = setup(listSampleProps)
    const histogramChartComponent = findByTestAttr(wrapper, 'react-autoql-histogram-chart')
    expect(histogramChartComponent.exists()).toBe(true)
  })
})
