// Helper: safe getBoundingClientRect wrapper
function safeRect(el) {
  try {
    const r = el.getBoundingClientRect()
    return { width: r.width, height: r.height }
  } catch (e) {
    return { width: el.clientWidth || 0, height: el.clientHeight || 0 }
  }
}

// observeContainer(container, cb, options)
// - Uses ResizeObserver (debounced) when available.
// - If ResizeObserver is not available, performs an immediate measurement and returns a noop cleanup.
// - options:
//    - debounceMs: number (ms) to debounce ResizeObserver callback (default 60)
//    - pollMs: optional number to enable a polling fallback when ResizeObserver is unavailable
export function observeContainer(container, cb, options = {}) {
  if (!container) return () => {}

  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 60

  // ResizeObserver path (debounced)
  if (typeof ResizeObserver !== 'undefined') {
    let timer = null
    const ro = new ResizeObserver((entries) => {
      // Batch entries into a single debounced callback
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        try {
          // Report bounding rects (or contentRect) for each target.
          for (const entry of entries) {
            const rect = entry.contentRect || safeRect(entry.target)
            cb({ width: rect.width, height: rect.height })
          }
        } catch (e) {
          // swallow observer callback errors
        }
      }, debounceMs)
    })

    try {
      ro.observe(container)
    } catch (e) {
      // If observing fails, fall through to immediate measurement
    }

    // Fire initial measurement synchronously (best-effort)
    try {
      cb(safeRect(container))
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        ro.disconnect()
      } catch (e) {}
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }

  // Fallback: No ResizeObserver available - immediate measurement + optional polling
  try {
    cb(safeRect(container))
  } catch (e) {}

  if (typeof options.pollMs === 'number' && options.pollMs > 0) {
    let last = safeRect(container)
    const pollInterval = options.pollMs
    const id = setInterval(() => {
      const cur = safeRect(container)
      if (cur.width !== last.width || cur.height !== last.height) {
        last = cur
        try {
          cb(cur)
        } catch (e) {}
      }
    }, pollInterval)
    return () => clearInterval(id)
  }

  // No live updates possible, return noop cleanup
  return () => {}
}

export default observeContainer
