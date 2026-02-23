import React from 'react'
import { shallow } from 'enzyme'
import { findByTestAttr } from '../../../../test/testUtils'
import Columns from './Columns'
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

const defaultProps = Columns.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = shallow(<Columns {...setupProps} />)
  if (state) {
    wrapper.setState(state)
  }
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup(listSampleProps)
    const columnsComponent = findByTestAttr(wrapper, 'columns')
    expect(columnsComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const columnsComponent = findByTestAttr(wrapper, 'columns')
    expect(columnsComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const columnsComponent = findByTestAttr(wrapper, 'columns')
    expect(columnsComponent.exists()).toBe(true)
  })
})
