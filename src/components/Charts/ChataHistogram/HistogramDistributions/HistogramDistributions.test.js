import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../../test/testUtils'
import sampleProps from '../../chartTestData'
import testProps from '../testData'
import HistogramDistributions from './HistogramDistributions'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const histogramSampleProps = {
  xScale: sampleProps.pivot.stringScale(),
  yScale: sampleProps.pivot.numberScale(),
  ...testProps,
}

const listSampleProps = {
  ...sampleProps.list,
  ...histogramSampleProps,
}

const defaultProps = HistogramDistributions.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<HistogramDistributions {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps, { activeDistribution: 'normal' })
    const distributionsComponent = findByTestAttr(wrapper, 'distribution-lines')
    expect(distributionsComponent.exists()).toBe(true)
  })
})
