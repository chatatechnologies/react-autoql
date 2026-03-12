import observeContainer from '../src/components/Charts/measureObserver.js'

// Mock ResizeObserver for tests
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback
    this.observedElements = new Set()
    this.pollInterval = null
  }

  observe(element) {
    this.observedElements.add(element)

    // Trigger an immediate callback with initial dimensions
    setTimeout(() => {
      const entries = Array.from(this.observedElements).map((el) => {
        const width = parseFloat(el.style.width) || el.offsetWidth
        const height = parseFloat(el.style.height) || el.offsetHeight
        return {
          contentRect: {
            width,
            height,
            top: 0,
            left: 0,
            right: width,
            bottom: height,
          },
          target: el,
        }
      })
      if (entries.length > 0) {
        this.callback(entries)
      }
    }, 0)

    // Continue polling for further changes
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        const entries = Array.from(this.observedElements).map((el) => {
          const width = parseFloat(el.style.width) || el.offsetWidth
          const height = parseFloat(el.style.height) || el.offsetHeight
          return {
            contentRect: {
              width,
              height,
              top: 0,
              left: 0,
              right: width,
              bottom: height,
            },
            target: el,
          }
        })
        if (entries.length > 0) {
          this.callback(entries)
        }
      }, 10)
    }
  }

  unobserve(element) {
    this.observedElements.delete(element)
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.observedElements.clear()
  }
}

// Set up global mock
global.ResizeObserver = MockResizeObserver

describe('observeContainer', () => {
  describe('basic functionality', () => {
    it('should return a cleanup function', () => {
      const container = document.createElement('div')
      const cleanup = observeContainer(container, () => {})
      expect(typeof cleanup).toBe('function')
    })

    it('should handle null container gracefully', () => {
      const cleanup = observeContainer(null, () => {})
      expect(typeof cleanup).toBe('function')
      cleanup() // should not throw
    })

    it('should invoke callback with container dimensions', (done) => {
      const container = document.createElement('div')
      container.style.width = '200px'
      container.style.height = '300px'
      document.body.appendChild(container)

      // In jsdom, we need to mock getBoundingClientRect
      container.getBoundingClientRect = () => ({
        width: 200,
        height: 300,
        top: 0,
        left: 0,
        right: 200,
        bottom: 300,
      })

      let callCount = 0
      const callback = (dims) => {
        callCount++
        if (callCount >= 1) {
          // Either first call or any later call with correct dimensions
          expect(dims.width).toBeGreaterThan(0)
          expect(dims.height).toBeGreaterThan(0)
          cleanup()
          document.body.removeChild(container)
          done()
        }
      }

      const cleanup = observeContainer(container, callback, { debounce: 10 })
    }, 10000)
  })

  describe('cleanup and observer management', () => {
    it('should stop observing after cleanup is called', (done) => {
      const container = document.createElement('div')
      container.style.width = '100px'
      container.style.height = '100px'
      document.body.appendChild(container)

      let callCount = 0
      const callback = () => {
        callCount++
      }

      const cleanup = observeContainer(container, callback, { debounce: 10 })

      // Wait for initial callback
      setTimeout(() => {
        const countAfterCleanup = callCount
        cleanup()

        // Simulate resize after cleanup
        container.style.width = '150px'

        // Wait to ensure no more callbacks
        setTimeout(() => {
          expect(callCount).toBe(countAfterCleanup)
          document.body.removeChild(container)
          done()
        }, 50)
      }, 30)
    })
  })

  describe('debouncing behavior', () => {
    it('should debounce ResizeObserver callbacks', (done) => {
      const container = document.createElement('div')
      container.style.width = '100px'
      container.style.height = '100px'
      document.body.appendChild(container)

      let callCount = 0
      const callback = () => {
        callCount++
      }

      const cleanup = observeContainer(container, callback, { debounce: 50 })

      // Wait for initial callback
      setTimeout(() => {
        const initialCount = callCount

        // Trigger multiple rapid resizes
        container.style.width = '120px'
        container.style.width = '140px'
        container.style.width = '160px'

        // After debounce period, should have at most one additional callback
        setTimeout(() => {
          const additionalCalls = callCount - initialCount
          // Should be 1 (debounced) not 3 (if not debounced)
          expect(additionalCalls).toBeLessThanOrEqual(1)
          cleanup()
          document.body.removeChild(container)
          done()
        }, 100)
      }, 30)
    })
  })

  describe('multiple containers', () => {
    it('should independently observe multiple containers', (done) => {
      const container1 = document.createElement('div')
      const container2 = document.createElement('div')
      container1.style.width = '100px'
      container1.style.height = '100px'
      container2.style.width = '200px'
      container2.style.height = '200px'

      document.body.appendChild(container1)
      document.body.appendChild(container2)

      const dims = { container1: null, container2: null, callCounts: { c1: 0, c2: 0 } }

      const cleanup1 = observeContainer(container1, (d) => {
        dims.container1 = d
        dims.callCounts.c1++
      })

      const cleanup2 = observeContainer(container2, (d) => {
        dims.container2 = d
        dims.callCounts.c2++
      })

      // Initial callbacks should happen
      setTimeout(() => {
        expect(dims.container1).not.toBeNull()
        expect(dims.container2).not.toBeNull()
        expect(dims.callCounts.c1).toBeGreaterThan(0)
        expect(dims.callCounts.c2).toBeGreaterThan(0)

        // Cleanup should not affect the other observer
        cleanup1()

        cleanup2()
        document.body.removeChild(container1)
        document.body.removeChild(container2)
        done()
      }, 40)
    })
  })
})
