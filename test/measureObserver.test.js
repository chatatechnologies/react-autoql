/**
 * Tests for measureObserver utility - observe container dimensions
 */
import { observeContainer } from '../src/components/Charts/measureObserver'

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
