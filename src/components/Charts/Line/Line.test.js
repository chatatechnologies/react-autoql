import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Line from './Line'
import sampleProps from '../chartTestData'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'
beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const scales = {
  xScale: sampleProps.pivot.stringScale(),
  yScale: sampleProps.pivot.numberScale(),
}

const pivotSampleProps = {
  ...sampleProps.pivot,
  ...scales,
}

const datePivotSampleProps = {
  ...sampleProps.datePivot,
  ...scales,
}

const listSampleProps = {
  ...sampleProps.list,
  ...scales,
}

const defaultProps = Line.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Line {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const lineComponent = findByTestAttr(wrapper, 'line')
    expect(lineComponent.exists()).toBe(true)
  })
})
