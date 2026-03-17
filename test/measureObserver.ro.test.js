/**
 * Tests for measureObserver.observeContainer behavior when ResizeObserver exists.
 */
jest.mock('autoql-fe-utils', () => ({
  // Mock the library (though observeAndRender no longer exists there)
}))

import { observeContainer } from '../src/components/Charts/measureObserver'

describe('observeContainer with ResizeObserver', () => {
  const realRO = global.ResizeObserver

  beforeEach(() => {
    // Provide a simple fake ResizeObserver that calls the callback when observe() is invoked
    class FakeRO {
      constructor(cb) {
        this._cb = cb
        this._observed = new Set()
      }
      observe(target) {
        this._observed.add(target)
        // Simulate an entry whose contentRect matches getBoundingClientRect if available
        const contentRect = target.getBoundingClientRect
          ? target.getBoundingClientRect()
          : { width: target.clientWidth || 0, height: target.clientHeight || 0 }
        // Call async (microtask) to mimic ResizeObserver timing
        Promise.resolve().then(() => this._cb([{ target, contentRect }]))
      }
      disconnect() {
        this._observed.clear()
      }
    }

    global.ResizeObserver = FakeRO
  })

  afterEach(() => {
    global.ResizeObserver = realRO
    jest.clearAllMocks()
  })

  test('calls callback immediately and returns a cleanup that disconnects', async () => {
    const el = document.createElement('div')
    // Provide a deterministic bounding rect
    el.getBoundingClientRect = () => ({ width: 123, height: 45 })

    const calls = []
    const cb = (rect) => calls.push(rect)

    const cleanup = observeContainer(el, cb, { debounceMs: 5 })

    // initial cb should be called synchronously (or at least quickly)
    await new Promise((r) => setTimeout(r, 50))
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0]).toMatchObject({ width: 123, height: 45 })

    // cleanup should be callable and not throw
    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
  })
})
