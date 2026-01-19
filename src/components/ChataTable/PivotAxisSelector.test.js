import React from 'react'
import { shallow } from 'enzyme'

import PivotAxisSelector, { computePivotAxisSelectorLocation } from './PivotAxisSelector'

describe('PivotAxisSelector', () => {
  const mockOptions = [
    { value: 0, label: 'Option 1' },
    { value: 1, label: 'Option 2' },
    { value: 2, label: 'Option 3' },
  ]

  describe('PivotAxisSelector component', () => {
    test('renders null when options is empty', () => {
      const wrapper = shallow(
        <PivotAxisSelector
          isOpen={true}
          options={[]}
          activeIndex={0}
          location={{ top: 0, left: 0 }}
          onClose={jest.fn()}
          onChange={jest.fn()}
        />,
      )
      expect(wrapper.type()).toBe(null)
    })

    test('renders null when options is undefined', () => {
      const wrapper = shallow(
        <PivotAxisSelector
          isOpen={true}
          options={undefined}
          activeIndex={0}
          location={{ top: 0, left: 0 }}
          onClose={jest.fn()}
          onChange={jest.fn()}
        />,
      )
      expect(wrapper.type()).toBe(null)
    })

    test('renders component when options are provided', () => {
      const wrapper = shallow(
        <PivotAxisSelector
          isOpen={true}
          options={mockOptions}
          activeIndex={0}
          location={{ top: 100, left: 200 }}
          onClose={jest.fn()}
          onChange={jest.fn()}
        />,
      )
      // Component should render (not return null)
      expect(wrapper.type()).not.toBe(null)
    })

    test('has correct default props', () => {
      expect(PivotAxisSelector.defaultProps).toEqual({
        isOpen: false,
        options: [],
        activeIndex: undefined,
        location: null,
        onClose: expect.any(Function),
        onChange: expect.any(Function),
      })
    })

    test('has correct propTypes defined', () => {
      expect(PivotAxisSelector.propTypes).toBeDefined()
      expect(PivotAxisSelector.propTypes.isOpen).toBeDefined()
      expect(PivotAxisSelector.propTypes.options).toBeDefined()
      expect(PivotAxisSelector.propTypes.activeIndex).toBeDefined()
      expect(PivotAxisSelector.propTypes.location).toBeDefined()
      expect(PivotAxisSelector.propTypes.onClose).toBeDefined()
      expect(PivotAxisSelector.propTypes.onChange).toBeDefined()
    })
  })

  describe('computePivotAxisSelectorLocation', () => {
    test('returns null when element is null', () => {
      const result = computePivotAxisSelectorLocation(null, document.body)
      expect(result).toBe(null)
    })

    test('returns null when element is undefined', () => {
      const result = computePivotAxisSelectorLocation(undefined, document.body)
      expect(result).toBe(null)
    })

    test('computes location relative to table container', () => {
      const element = document.createElement('div')
      const tableContainer = document.createElement('div')
      document.body.appendChild(tableContainer)
      document.body.appendChild(element)

      // Mock getBoundingClientRect (provide left/top and zero width/height
      // so the center equals left/top). Offsets are applied by the function.
      element.getBoundingClientRect = jest.fn(() => ({
        left: 200,
        top: 100,
        width: 0,
        height: 0,
      }))
      tableContainer.getBoundingClientRect = jest.fn(() => ({
        top: 50,
        left: 100,
      }))

      const result = computePivotAxisSelectorLocation(element, tableContainer)

      // elementCenterX = 200 + 0/2 - 52 = 148; left = 148 - tableLeft(100) = 48
      // elementCenterY = 100 + 0/2 + 35 = 135; top = 135 - tableTop(50) = 85
      expect(result).toEqual({
        top: 85,
        left: 48,
      })

      document.body.removeChild(element)
      document.body.removeChild(tableContainer)
    })

    test('uses default table container position when tableContainer is null', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)

      element.getBoundingClientRect = jest.fn(() => ({
        left: 200,
        top: 150,
        width: 0,
        height: 0,
      }))

      const result = computePivotAxisSelectorLocation(element, null)

      // elementCenterX = 200 - 52 = 148; elementCenterY = 150 + 35 = 185
      expect(result).toEqual({
        top: 185,
        left: 148,
      })

      document.body.removeChild(element)
    })

    test('uses default table container position when tableContainer is undefined', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)

      element.getBoundingClientRect = jest.fn(() => ({
        left: 150,
        top: 100,
        width: 0,
        height: 0,
      }))

      const result = computePivotAxisSelectorLocation(element, undefined)

      // elementCenterX = 150 - 52 = 98; elementCenterY = 100 + 35 = 135
      expect(result).toEqual({
        top: 135,
        left: 98,
      })

      document.body.removeChild(element)
    })
  })
})
