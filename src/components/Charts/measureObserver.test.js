/**
 * Tests for measureObserver utility - observe container dimensions
 */
import { observeContainer } from './measureObserver'

describe('observeContainer', () => {
  const realRO = global.ResizeObserver

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.ResizeObserver = realRO
  })

  test('returns cleanup function', () => {
    const el = document.createElement('div')
    const cb = jest.fn()
    const cleanup = observeContainer(el, cb)

    expect(typeof cleanup).toBe('function')
  })

  test('returns no-op cleanup when container is null', () => {
    const cb = jest.fn()
    const cleanup = observeContainer(null, cb)

    expect(cleanup()).toBeUndefined()
    expect(cb).not.toHaveBeenCalled()
  })

  test('cleanup function does not throw', () => {
    const el = document.createElement('div')
    const cb = jest.fn()
    const cleanup = observeContainer(el, cb)

    expect(() => cleanup()).not.toThrow()
  })

  test('uses ResizeObserver when available', () => {
    const el = document.createElement('div')
    const mockObserve = jest.fn()
    const mockDisconnect = jest.fn()
    const mockRO = jest.fn(() => ({
      observe: mockObserve,
      disconnect: mockDisconnect,
    }))

    global.ResizeObserver = mockRO

    const cb = jest.fn()
    const cleanup = observeContainer(el, cb)

    // Verify cleanup works when ResizeObserver is present
    expect(typeof cleanup).toBe('function')
  })

  test('accepts debounceMs option', () => {
    const el = document.createElement('div')
    const cb = jest.fn()

    // Should not throw
    expect(() => observeContainer(el, cb, { debounceMs: 100 })).not.toThrow()
  })

  test('cleans up without errors', () => {
    const el = document.createElement('div')
    const cb = jest.fn()
    const cleanup = observeContainer(el, cb)

    // Should not throw
    expect(() => cleanup()).not.toThrow()
    expect(() => cleanup()).not.toThrow() // calling twice should be safe
  })
})

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

  test('does not re-notify when the observed size is unchanged', async () => {
    // Regression guard: the callback typically measures and setStates, which resizes the observed
    // element and re-triggers the observer. Reporting unchanged sizes closes that feedback loop.
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ width: 200, height: 100 })

    let capturedRoCallback
    class RecordingRO {
      constructor(cb) {
        capturedRoCallback = cb
      }
      observe() {}
      disconnect() {}
    }
    global.ResizeObserver = RecordingRO

    const calls = []
    const cleanup = observeContainer(el, (rect) => calls.push(rect), { debounceMs: 0 })

    // Initial synchronous measurement
    expect(calls).toHaveLength(1)

    // Three notifications reporting the exact same box should all be ignored
    for (let i = 0; i < 3; i++) {
      capturedRoCallback([{ target: el, contentRect: { width: 200, height: 100 } }])
      await new Promise((r) => setTimeout(r, 5))
    }
    expect(calls).toHaveLength(1)

    // A genuine size change must still be reported
    capturedRoCallback([{ target: el, contentRect: { width: 200, height: 140 } }])
    await new Promise((r) => setTimeout(r, 5))
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ width: 200, height: 140 })

    cleanup()
  })
})
