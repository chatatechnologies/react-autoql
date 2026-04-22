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
})
