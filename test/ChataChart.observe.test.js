/**
 * Ensure ChataChart uses observeContainer and calls cleanup on unmount.
 * This test instantiates ChataChart as a class (without mounting into React DOM)
 * and verifies that attachResizeObserver stores the cleanup and that componentWillUnmount
 * calls it.
 */
jest.mock('../src/components/Charts/measureObserver', () => {
  return {
    observeContainer: jest.fn((node, cb) => {
      // simulate initial callback
      try {
        const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 1, height: 1 }
        cb(rect)
      } catch (e) {}
      // return a cleanup that records it was called
      const cleanup = jest.fn()
      cleanup._wasCalled = false
      const wrapper = jest.fn(() => {
        cleanup._wasCalled = true
      })
      wrapper._wasCalled = false
      wrapper._inner = cleanup
      return wrapper
    }),
  }
})

import ChataChart from '../src/components/Charts/ChataChart/ChataChart'
import { observeContainer } from '../src/components/Charts/measureObserver'

describe('ChataChart observe lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('attachResizeObserver calls observeContainer and componentWillUnmount calls cleanup', () => {
    // Create an instance of the class without rendering
    const inst = new ChataChart({})
    // Mark mounted to allow callbacks to proceed
    inst._isMounted = true

    // Provide a fake DOM node with getBoundingClientRect
    const node = {
      getBoundingClientRect: () => ({ width: 300, height: 200 }),
    }

    // assign the node and call the attach method
    inst.chartContainerRef = node
    expect(inst.cleanupObserve).toBeNull()
    inst.attachResizeObserver()

    // observeContainer should have been called once with our node
    expect(observeContainer).toHaveBeenCalledTimes(1)
    expect(observeContainer).toHaveBeenCalledWith(node, expect.any(Function), { debounceMs: 0 })

    // The instance should have stored the cleanup function
    expect(typeof inst.cleanupObserve).toBe('function')

    // Call componentWillUnmount which should call cleanup
    const wrapper = inst.cleanupObserve
    expect(wrapper.mock.calls.length).toBe(0)

    inst.componentWillUnmount()

    // After unmount, wrapper should have been called
    expect(wrapper.mock.calls.length).toBeGreaterThan(0)
    expect(inst.cleanupObserve).toBeNull()
    expect(inst._observedNode).toBeNull()
  })

  test('multiple instances each get observed and cleaned up independently', () => {
    const instA = new ChataChart({})
    const instB = new ChataChart({})
    instA._isMounted = true
    instB._isMounted = true

    const nodeA = { getBoundingClientRect: () => ({ width: 10, height: 10 }) }
    const nodeB = { getBoundingClientRect: () => ({ width: 20, height: 20 }) }

    instA.chartContainerRef = nodeA
    instB.chartContainerRef = nodeB

    instA.attachResizeObserver()
    instB.attachResizeObserver()

    expect(observeContainer).toHaveBeenCalledTimes(2)
    expect(observeContainer).toHaveBeenNthCalledWith(1, nodeA, expect.any(Function), { debounceMs: 0 })
    expect(observeContainer).toHaveBeenNthCalledWith(2, nodeB, expect.any(Function), { debounceMs: 0 })

    const wrapA = instA.cleanupObserve
    const wrapB = instB.cleanupObserve
    expect(wrapA).not.toBe(wrapB)

    const initialCallsA = wrapA.mock.calls.length
    const initialCallsB = wrapB.mock.calls.length

    instA.componentWillUnmount()
    expect(wrapA.mock.calls.length).toBeGreaterThan(initialCallsA)
    expect(wrapB.mock.calls.length).toBe(initialCallsB)

    instB.componentWillUnmount()
    expect(wrapB.mock.calls.length).toBeGreaterThan(initialCallsB)
  })
})
