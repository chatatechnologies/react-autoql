import React from 'react'
import { mount } from 'enzyme'
import Axis from './Axis'
import { findByTestAttr } from '../../../../test/testUtils'
import sampleProps from '../chartTestData'

const pivotSampleProps = sampleProps.pivot
const datePivotSampleProps = sampleProps.datePivot
const listSampleProps = sampleProps.list

const defaultProps = Axis.defaultProps

const setup = (props = {}, state = null) => {
  const setupProps = { ...defaultProps, ...props }
  const wrapper = mount(
    <svg>
      <Axis {...setupProps} />
    </svg>,
  )
  return wrapper
}

describe('renders correctly', () => {
  test('renders list data chart correctly', () => {
    const wrapper = setup({
      ...listSampleProps,
      col: listSampleProps.columns[listSampleProps.stringColumnIndex],
      scale: listSampleProps.stringScale,
      orient: 'Left',
      title: listSampleProps.columns[listSampleProps.stringColumnIndex].display_name,
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
      scale: pivotSampleProps.numberScale,
      orient: 'Bottom',
      title: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name,
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup({
      ...datePivotSampleProps,
      col: datePivotSampleProps.columns[datePivotSampleProps.stringColumnIndex],
      scale: datePivotSampleProps.stringScale,
      orient: 'Left',
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })
})

describe('after mount', () => {
  describe('renders axis labels correctly', () => {
    describe('short titles - pivot data', () => {
      test('renders string axis label', () => {
        const wrapper = setup({
          ...pivotSampleProps,
          col: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex],
          scale: pivotSampleProps.stringScale,
          orient: 'Left',
          title: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex].display_name,
        })

        // const xLabel = findByTestAttr(wrapper, 'x-axis-label')
        const labelText = findByTestAttr(wrapper, 'axis-label')
        expect(labelText.text()).toEqual(pivotSampleProps.columns[pivotSampleProps.stringColumnIndex].display_name)
      })

      describe('number axis', () => {
        const wrapper = setup({
          ...pivotSampleProps,
          col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
          scale: pivotSampleProps.numberScale,
          orient: 'Bottom',
          title: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name,
        })

        test('renders number axis label', () => {
          const labelText = findByTestAttr(wrapper, 'axis-label')
          expect(labelText.text()).toEqual(pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name)
        })

        test('does not render dropdowns by default', () => {
          const labelArrow = findByTestAttr(wrapper, 'dropdown-arrow')
          expect(labelArrow.exists()).toBe(false)
        })

        test('renders dropdown with props', () => {
          const wrapper2 = setup({
            ...pivotSampleProps,
            col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
            scale: pivotSampleProps.numberScale,
            orient: 'Bottom',
            title: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name,
            hasDropdown: true,
          })

          const labelArrow = findByTestAttr(wrapper2, 'dropdown-arrow')
          expect(labelArrow.exists()).toBe(true)
        })
      })
    })

    describe('long titles - date pivot data', () => {
      const wrapper = setup({
        ...datePivotSampleProps,
        col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
        scale: pivotSampleProps.numberScale,
        orient: 'Bottom',
        title: 'x title test loooong title to test a very very very very very very very long title',
      })

      test('renders long axis label with ellipsis', () => {
        const labelText = findByTestAttr(wrapper, 'axis-label')
        expect(labelText.text()).toEqual('x title test loooong title to test ...')
      })
    })
  })
})
