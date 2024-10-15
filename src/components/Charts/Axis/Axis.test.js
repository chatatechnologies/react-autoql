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
      scale: listSampleProps.stringScale({
        title: listSampleProps.columns[listSampleProps.stringColumnIndex].display_name,
        column: listSampleProps.columns[listSampleProps.stringColumnIndex],
      }),
      orient: 'left',
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders pivot data chart correctly', () => {
    const wrapper = setup({
      ...pivotSampleProps,
      col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
      scale: pivotSampleProps.numberScale({
        title: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name,
      }),
      orient: 'bottom',
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })

  test('renders date pivot data chart correctly', () => {
    const wrapper = setup({
      ...datePivotSampleProps,
      scale: datePivotSampleProps.stringScale({
        column: datePivotSampleProps.columns[datePivotSampleProps.stringColumnIndex],
      }),
      orient: 'left',
    })
    const axisComponent = findByTestAttr(wrapper, 'axis')
    expect(axisComponent.exists()).toBe(true)
  })
})

describe('after mount', () => {
  describe('renders axis labels correctly', () => {
    describe('short titles - pivot data', () => {
      test('renders string axis label', () => {
        const scale = pivotSampleProps.stringScale({
          title: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex].display_name,
        })

        const wrapper = setup({
          ...pivotSampleProps,
          col: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex],
          scale,
          orient: 'left',
        })

        const labelText = findByTestAttr(wrapper, 'axis-label')
        expect(labelText.text()).toEqual(pivotSampleProps.columns[pivotSampleProps.stringColumnIndex].display_name)
      })

      describe('number axis', () => {
        const wrapper = setup({
          ...pivotSampleProps,
          col: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex],
          scale: pivotSampleProps.numberScale({
            title: pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name,
          }),
          orient: 'bottom',
        })

        test('renders number axis label', () => {
          const labelText = findByTestAttr(wrapper, 'axis-label')
          expect(labelText.text()).toEqual(pivotSampleProps.columns[pivotSampleProps.numberColumnIndex].display_name)
        })

        test('does not render dropdowns by default', () => {
          const labelArrow = findByTestAttr(wrapper, 'dropdown-arrow')
          expect(labelArrow.exists()).toBe(false)
        })

        test('does not render dropdown even with props if there is only 1 column to choose from', () => {
          const scale = pivotSampleProps.stringScale({
            title: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex].display_name,
            hasDropdown: true,
          })

          const wrapper2 = setup({
            ...pivotSampleProps,
            col: pivotSampleProps.columns[pivotSampleProps.stringColumnIndex],
            scale,
            orient: 'bottom',
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
        orient: 'bottom',
        scale: pivotSampleProps.numberScale({
          title: 'x title test loooong title to test a very very very very very very very long title',
        }),
      })

      test('renders long axis label with ellipsis', () => {
        const labelText = findByTestAttr(wrapper, 'axis-label')
        expect(labelText.text()).toEqual('x title test loooong title to test ...')
      })
    })
  })
})
