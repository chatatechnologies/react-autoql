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

      // Mock getBoundingClientRect
      element.getBoundingClientRect = jest.fn(() => ({
        bottom: 150,
        left: 200,
      }))
      tableContainer.getBoundingClientRect = jest.fn(() => ({
        top: 50,
        left: 100,
      }))

      const result = computePivotAxisSelectorLocation(element, tableContainer)

      expect(result).toEqual({
        top: 100, // 150 - 50
        left: 100, // 200 - 100
      })

      document.body.removeChild(element)
      document.body.removeChild(tableContainer)
    })

    test('uses default table container position when tableContainer is null', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)

      element.getBoundingClientRect = jest.fn(() => ({
        bottom: 150,
        left: 200,
      }))

      const result = computePivotAxisSelectorLocation(element, null)

      expect(result).toEqual({
        top: 150, // 150 - 0
        left: 200, // 200 - 0
      })

      document.body.removeChild(element)
    })

    test('uses default table container position when tableContainer is undefined', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)

      element.getBoundingClientRect = jest.fn(() => ({
        bottom: 100,
        left: 150,
      }))

      const result = computePivotAxisSelectorLocation(element, undefined)

      expect(result).toEqual({
        top: 100,
        left: 150,
      })

      document.body.removeChild(element)
    })
  })
})
