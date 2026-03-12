// Small wrapper that prefers the project's observeAndRender helper
// but falls back to ResizeObserver when not available. Returns cleanup function.
// Debounces ResizeObserver callback to prevent excessive recalculations.
export default function observeContainer(container, cb, options = {}) {
  if (!container) return () => {}

  // Try to use the project's observeAndRender helper if available
  const { observeAndRender } = require('autoql-fe-utils').default || {}
  if (typeof observeAndRender === 'function') {
    return observeAndRender(container, cb, options)
  }

  // Check if ResizeObserver is available (not in all environments)
  if (typeof ResizeObserver === 'undefined') {
    // Fallback for environments without ResizeObserver - just invoke once
    try {
      const rect = container.getBoundingClientRect()
      cb({ width: rect.width, height: rect.height })
    } catch (e) {
      // ignore
    }
    return () => {} // no-op cleanup
  }

  // Debounce timer for ResizeObserver fallback
  let debounceTimer = null
  const debounceMs = options.debounce ?? 120

  // Fallback: use ResizeObserver with debouncing
  const ro = new ResizeObserver((entries) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      for (const entry of entries) {
        const rect = entry.contentRect || entry.target.getBoundingClientRect()
        cb({ width: rect.width, height: rect.height })
      }
    }, debounceMs)
  })

  ro.observe(container)

  try {
    const rect = container.getBoundingClientRect()
    cb({ width: rect.width, height: rect.height })
  } catch (e) {
    // ignore
  }

  return () => {
    clearTimeout(debounceTimer)
    ro.disconnect()
  }
}
