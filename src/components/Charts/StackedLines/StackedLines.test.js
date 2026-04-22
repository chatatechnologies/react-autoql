import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import StackedLines from './StackedLines'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = StackedLines.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<StackedLines {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders regular pivot chart data correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      xScale: pivotSampleProps.stringScale(),
      yScale: pivotSampleProps.numberScale(),
    })
    const stackedLinesComponent = findByTestAttr(wrapper, 'stacked-lines')
    expect(stackedLinesComponent.exists()).toBe(true)
  })
})
