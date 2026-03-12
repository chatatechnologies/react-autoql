/**
 * Helper utilities for chart container management
 */

// Minimum threshold for considering a container "collapsed"
// Using 2 instead of 1 to account for rounding errors and browser inconsistencies
export const CONTAINER_MIN_DIMENSION = 2

/**
 * Check if a container element is effectively collapsed or hidden
 * @param {HTMLElement} containerRef - DOM reference to container
 * @returns {boolean} true if container is collapsed/hidden
 */
export function isContainerCollapsed(containerRef) {
  if (!containerRef) return true

  try {
    // Check computed styles for visibility/display
    const computedStyle = window.getComputedStyle(containerRef)
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return true
    }

    // Check if offsetParent is null (element is hidden)
    if (containerRef.offsetParent === null) {
      return true
    }

    // Check dimensions
    const rect = containerRef.getBoundingClientRect()
    if (rect.width < CONTAINER_MIN_DIMENSION || rect.height < CONTAINER_MIN_DIMENSION) {
      return true
    }

    return false
  } catch (e) {
    // If we can't determine, assume not collapsed to be safe
    return false
  }
}

/**
 * Get safe container dimensions with fallbacks
 * @param {HTMLElement} containerRef - DOM reference to container
 * @param {number} clientWidth - fallback width from clientWidth property
 * @param {number} clientHeight - fallback height from clientHeight property
 * @returns {object} {width, height} dimensions
 */
export function getSafeContainerDimensions(containerRef, clientWidth, clientHeight) {
  const result = { width: clientWidth, height: clientHeight }

  if (!containerRef) return result

  try {
    const rect = containerRef.getBoundingClientRect()
    // Prefer getBoundingClientRect if dimensions are valid
    if (rect.width > CONTAINER_MIN_DIMENSION) {
      result.width = Math.ceil(rect.width)
    }
    if (rect.height > CONTAINER_MIN_DIMENSION) {
      result.height = Math.ceil(rect.height)
    }
  } catch (e) {
    // Fall through to use clientWidth/Height fallback
  }

  return result
}
