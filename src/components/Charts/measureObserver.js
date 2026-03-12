import { observeAndRender } from 'autoql-fe-utils'

// Safe getBoundingClientRect with clientWidth/clientHeight fallback
function safeRect(el) {
  try {
    const r = el.getBoundingClientRect()
    return { width: r.width, height: r.height }
  } catch (e) {
    return { width: el.clientWidth || 0, height: el.clientHeight || 0 }
  }
}

// Observe container dimension changes. Prefers observeAndRender if available,
// falls back to ResizeObserver (debounced). Returns cleanup function.
// Options: { debounceMs: number } (default 60ms)
export function observeContainer(container, cb, options = {}) {
  if (!container) return () => {}

  if (typeof observeAndRender === 'function') {
    return observeAndRender(container, cb, options)
  }

  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 60

  if (typeof ResizeObserver !== 'undefined') {
    let timer = null
    const ro = new ResizeObserver((entries) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        try {
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
      // continue if observe fails
    }

    try {
      cb(safeRect(container))
    } catch (e) {
      // swallow callback errors
    }

    return () => {
      try {
        ro.disconnect()
      } catch (e) {}
      if (timer) clearTimeout(timer)
    }
  }

  // ResizeObserver unavailable: immediate measurement only
  try {
    cb(safeRect(container))
  } catch (e) {}

  return () => {}
}

export default observeContainer
