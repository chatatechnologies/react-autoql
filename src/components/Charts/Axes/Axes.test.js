// This is a component meant to be used inside an SVG
// You must wrap it in an svg element and use mount for it to work properly

import React from 'react'
import { mount } from 'enzyme'
import Axes from './Axes'
import sampleProps from '../chartTestData'
import { findByTestAttr, ignoreConsoleErrors } from '../../../../test/testUtils'

var yLabelRef

const pivotSampleProps = {
  ...sampleProps.pivot,
  xScale: sampleProps.pivot.numberScale,
  yScale: sampleProps.pivot.stringScale,
  xCol: sampleProps.pivot.columns[sampleProps.pivot.numberColumnIndex],
  yCol: sampleProps.pivot.columns[sampleProps.pivot.stringColumnIndex],
}

const datePivotSampleProps = {
  ...sampleProps.datePivot,
  xScale: sampleProps.datePivot.stringScale,
  yScale: sampleProps.datePivot.numberScale,
  xCol: sampleProps.datePivot.columns[sampleProps.datePivot.stringColumnIndex],
  yCol: sampleProps.datePivot.columns[sampleProps.datePivot.numberColumnIndex],
}

const listSampleProps = {
  ...sampleProps.list,
  xScale: sampleProps.list.stringScale,
  yScale: sampleProps.list.numberScale,
  xCol: sampleProps.list.columns[sampleProps.list.stringColumnIndex],
  yCol: sampleProps.list.columns[sampleProps.list.numberColumnIndex],
}

const defaultProps = Axes.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg width="300px" height="300px">
      <Axes {...setupProps} />
    </svg>
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

describe('after mount', () => {
  describe('renders axis labels correctly', () => {
    describe('short titles - pivot data', () => {
      const wrapper = setup(pivotSampleProps)
      test('renders x axis label', () => {
        const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const xLabelText = findByTestAttr(xLabel, 'axis-label')
        expect(xLabelText.text()).toEqual(
          pivotSampleProps.columns[pivotSampleProps.numberColumnIndex]
            .display_name
        )
      })
      test('renders y axis label', () => {
        const yLabel = findByTestAttr(wrapper, 'y-axis-label')
        const yLabelText = findByTestAttr(yLabel, 'axis-label')
        expect(yLabelText.text()).toEqual(
          pivotSampleProps.columns[pivotSampleProps.stringColumnIndex]
            .display_name
        )
      })
      test('does not render dropdowns by default', () => {
        const xLabelArrow = findByTestAttr(wrapper, 'dropdown-arrow')
        expect(xLabelArrow.exists()).toBe(false)
      })
    })

    describe('long titles - date pivot data', () => {
      const wrapper = setup({
        ...datePivotSampleProps,
        xCol: {
          ...datePivotSampleProps.xCol,
          display_name:
            'x title test loooong title to test a very very very very very very very long title',
        },
        yCol: {
          ...datePivotSampleProps.yCol,
          display_name:
            'y title test loooong title to test a very very very very very very very long title',
        },
      })

      test('renders long x axis label with ellipsis', () => {
        const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const xLabelText = findByTestAttr(xLabel, 'axis-label')
        expect(xLabelText.text()).toEqual(
          'x title test loooong title to test ...'
        )
      })
      test('renders long y axis label with ellipsis', () => {
        const yLabel = findByTestAttr(wrapper, 'y-axis-label')
        const yLabelText = findByTestAttr(yLabel, 'axis-label')
        expect(yLabelText.text()).toEqual(
          'y title test loooong title to test ...'
        )
      })
    })
  })
})
