export class PerformanceOptimizer {
  static applyPassiveEventPatch() {
    if (window._chataTablePassiveEventPatchApplied) return

    try {
      const original = EventTarget.prototype.addEventListener
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === 'wheel' && (!options || typeof options === 'boolean')) {
          options = typeof options === 'boolean' ? { capture: options, passive: true } : { passive: true }
        } else if (type === 'wheel' && typeof options === 'object' && options.passive === undefined) {
          options = { ...options, passive: true }
        }
        return original.call(this, type, listener, options)
      }
      window._chataTablePassiveEventPatchApplied = true
    } catch (error) {
      // Fail silently
    }
  }

  static applyScrollOptimizations(tableId) {
    const tableContainer = document.querySelector(`#react-autoql-table-container-${tableId}`)
    if (!tableContainer) return

    const tabulatorElement = tableContainer.querySelector('.tabulator')
    const tableHolder = tableContainer.querySelector('.tabulator-tableholder')

    if (tabulatorElement) {
      Object.assign(tabulatorElement.style, {
        touchAction: 'auto',
        scrollBehavior: 'auto',
        willChange: 'scroll-position',
      })
    }

    if (tableHolder) {
      Object.assign(tableHolder.style, {
        touchAction: 'auto',
        scrollBehavior: 'auto',
      })
    }
  }
}
