import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../../test/testUtils'
import HistogramColumns from './HistogramColumns'
import sampleProps from '../../chartTestData'
import histogramTestProps from '../testData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const scales = {
  xScale: sampleProps.list.stringScale(),
  yScale: sampleProps.list.numberScale(),
  ...histogramTestProps,
}

const listSampleProps = {
  ...sampleProps.list,
  ...scales,
}

const defaultProps = HistogramColumns.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<HistogramColumns {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const histogramColumnsComponent = findByTestAttr(wrapper, 'columns')
    expect(histogramColumnsComponent.exists()).toBe(true)
  })
})
