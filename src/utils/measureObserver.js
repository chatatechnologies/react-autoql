/**
 * Observes a container element for dimension changes using ResizeObserver
 * with debounced callbacks to optimize performance
 * @param {HTMLElement} container - The container element to observe
 * @param {Function} callback - Function to call with dimension updates
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 200)
 * @returns {Function} Cleanup function to stop observing
 */
export function observeContainer(container, callback, debounceMs = 200) {
  if (!container || typeof callback !== 'function') {
    throw new Error('observeContainer requires a container element and callback function')
  }

  let timeoutId = null
  let lastDimensions = null

  // ResizeObserver to detect container size changes
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      const newDimensions = { width, height }

      // Only debounce if dimensions actually changed
      if (!lastDimensions || lastDimensions.width !== width || lastDimensions.height !== height) {
        lastDimensions = newDimensions

        // Clear existing timeout to debounce
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        // Debounce the callback
        timeoutId = setTimeout(() => {
          callback(newDimensions)
          timeoutId = null
        }, debounceMs)
      }
    }
  })

  observer.observe(container)

  // Return cleanup function
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    observer.disconnect()
  }
}

/**
 * Hook to observe container dimensions in React components
 * @param {React.RefObject} containerRef - Reference to the container element
 * @param {Function} callback - Function to call with dimension updates
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 200)
 */
export function useContainerObserver(containerRef, callback, debounceMs = 200) {
  const React = require('react')

  React.useEffect(() => {
    const container = containerRef?.current
    if (!container) {
      return
    }

    const cleanup = observeContainer(container, callback, debounceMs)
    return cleanup
  }, [containerRef, callback, debounceMs])
}
