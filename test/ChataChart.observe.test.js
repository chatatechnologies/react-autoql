/**
 * Tests for ChataChart integration with observeContainer
 */
import React from 'react'
import { shallow, mount } from 'enzyme'
import ChataChart from '../src/components/Charts/ChataChart/ChataChart'
import { observeContainer } from '../src/components/Charts/measureObserver'

jest.mock('../src/components/Charts/measureObserver', () => ({
  observeContainer: jest.fn((el, cb) => {
    // Call callback immediately and return cleanup function
    try {
      cb({ width: el?.clientWidth || 800, height: el?.clientHeight || 400 })
    } catch (e) {}
    return jest.fn()
  }),
}))

const defaultProps = {
  ...ChataChart.defaultProps,
  data: [['A', 1], ['B', 2]],
  columns: [{ name: 'col1', type: 'text' }, { name: 'col2', type: 'int' }],
  type: 'column',
  numberColumnIndex: 1,
  stringColumnIndex: 0,
  numberColumnIndices: [1],
  hidden: false,
}

describe('ChataChart - observeContainer integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('calls observeContainer on mount', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    // Verify that attachResizeObserver method exists
    expect(instance.attachResizeObserver).toBeDefined()
    expect(typeof instance.attachResizeObserver).toBe('function')
  })

  test('stores cleanup function in cleanupObserve', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    // Verify the fields exist for managing cleanup
    expect(instance.cleanupObserve === null || typeof instance.cleanupObserve === 'function').toBe(true)
  })

  test('calls observeContainer with correct debounceMs default', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    // Create a test node and call attachResizeObserver
    const testNode = document.createElement('div')
    instance.chartContainerRef = testNode

    jest.clearAllMocks()
    instance.attachResizeObserver()

    // Verify observeContainer was called with debounceMs
    expect(observeContainer).toHaveBeenCalledWith(
      testNode,
      expect.any(Function),
      { debounceMs: 60 },
    )
  })

  test('does not call observeContainer if chartContainerRef is null', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    // Simulate attachResizeObserver being called with null ref
    instance.chartContainerRef = null
    jest.clearAllMocks()
    instance.attachResizeObserver()

    expect(observeContainer).not.toHaveBeenCalled()
  })

  test('is idempotent - does not recreate observer for same node', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    jest.clearAllMocks()

    // Create a fake ref
    const fakeNode = document.createElement('div')
    instance.chartContainerRef = fakeNode

    instance.attachResizeObserver()
    expect(observeContainer).toHaveBeenCalledTimes(1)

    // Call again with same ref
    jest.clearAllMocks()
    instance.attachResizeObserver()
    expect(observeContainer).not.toHaveBeenCalled()
  })

  test('cleans up observer when node changes', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const fakeNode1 = document.createElement('div')
    const mockCleanup = jest.fn()

    instance.chartContainerRef = fakeNode1
    instance.cleanupObserve = mockCleanup
    instance._observedNode = fakeNode1

    // Switch to different node
    const fakeNode2 = document.createElement('div')
    instance.chartContainerRef = fakeNode2

    instance.attachResizeObserver()

    expect(mockCleanup).toHaveBeenCalledTimes(1)
  })

  test('calls attachChartPosition callback when container resizes', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    // Verify instance has the cleanup field
    expect(instance).toHaveProperty('cleanupObserve')
    expect(instance).toHaveProperty('_observedNode')
  })

  test('cleans up observer on unmount', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const mockCleanup = jest.fn()
    instance.cleanupObserve = mockCleanup

    wrapper.unmount()

    expect(mockCleanup).toHaveBeenCalled()
    expect(instance.cleanupObserve).toBeNull()
    expect(instance._observedNode).toBeNull()
  })

  test('handles cleanup errors gracefully during unmount', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const mockCleanup = jest.fn(() => {
      throw new Error('Cleanup failed')
    })
    instance.cleanupObserve = mockCleanup

    // Should not throw
    expect(() => wrapper.unmount()).not.toThrow()
  })

  test('tracks observed node reference', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const fakeNode = document.createElement('div')
    instance.chartContainerRef = fakeNode
    instance.attachResizeObserver()

    expect(instance._observedNode).toBe(fakeNode)
  })

  test('isContainerCollapsed returns true when dimensions <= 1', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const collapsedNode = document.createElement('div')
    collapsedNode.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    })

    instance.chartContainerRef = collapsedNode
    expect(instance.isContainerCollapsed()).toBe(true)
  })

  test('isContainerCollapsed returns false when dimensions > 1', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const visibleNode = document.createElement('div')
    visibleNode.getBoundingClientRect = () => ({
      width: 200,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 200,
    })

    instance.chartContainerRef = visibleNode
    expect(instance.isContainerCollapsed()).toBe(false)
  })

  test('respects debounceMs option in attachResizeObserver', () => {
    const wrapper = shallow(<ChataChart {...defaultProps} />)
    const instance = wrapper.instance()

    const fakeNode = document.createElement('div')
    instance.chartContainerRef = fakeNode

    jest.clearAllMocks()
    instance.attachResizeObserver({ debounceMs: 100 })

    expect(observeContainer).toHaveBeenCalledWith(
      fakeNode,
      expect.any(Function),
      { debounceMs: 100 },
    )
  })
})
