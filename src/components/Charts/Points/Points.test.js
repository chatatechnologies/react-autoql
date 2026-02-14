import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Points from './Points'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const listSampleProps = sampleProps.list
const defaultProps = Points.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Points {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list chart data correctly', () => {
    const wrapper = setup({
      ...listSampleProps,
      xScale: listSampleProps.stringScale(),
      yScale: listSampleProps.stringScale(),
    })
    const pointsComponent = findByTestAttr(wrapper, 'points')
    expect(pointsComponent.exists()).toBe(true)
  })
})
