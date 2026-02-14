import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Squares from './Squares'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = sampleProps.pivot
const defaultProps = Squares.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Squares {...setupProps} />)
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
      yScale: pivotSampleProps.stringScale(),
    })
    const squaresComponent = findByTestAttr(wrapper, 'squares')
    expect(squaresComponent.exists()).toBe(true)
  })
})
