// This is a component meant to be used inside an SVG
// You must wrap it in an svg element and use mount for it to work properly

import React from 'react'
import { mount } from 'enzyme'
import Axes from './Axes'
import sampleProps from '../chartTestData'
import { findByTestAttr } from '../../../../test/testUtils'
import { installGetBBoxMock, uninstallGetBBoxMock } from '../../../../test/utils/getBBoxShim'

beforeAll(() => installGetBBoxMock())
afterAll(() => uninstallGetBBoxMock())

const pivotSampleProps = {
  ...sampleProps.pivot,
  xScale: sampleProps.pivot.numberScale(),
  yScale: sampleProps.pivot.stringScale(),
}

const datePivotSampleProps = {
  ...sampleProps.datePivot,
  xScale: sampleProps.datePivot.stringScale(),
  yScale: sampleProps.datePivot.numberScale(),
}

const listSampleProps = {
  ...sampleProps.list,
  xScale: sampleProps.list.stringScale(),
  yScale: sampleProps.list.numberScale(),
}

const defaultProps = Axes.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width='300px' height='300px'>
      <Axes {...setupProps}></Axes>
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders pivot data axes correctly', () => {
    const wrapper = setup(pivotSampleProps)
    const axesComponent = findByTestAttr(wrapper, 'react-autoql-axes')
    expect(axesComponent.exists()).toBe(true)
  })

  test('renders date pivot data axes correctly', () => {
    const wrapper = setup(datePivotSampleProps)
    const axesComponent = findByTestAttr(wrapper, 'react-autoql-axes')
    expect(axesComponent.exists()).toBe(true)
  })

  test('renders list axes correctly', () => {
    const wrapper = setup(listSampleProps)
    const axesComponent = findByTestAttr(wrapper, 'react-autoql-axes')
    expect(axesComponent.exists()).toBe(true)
  })
})
