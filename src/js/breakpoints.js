export const BREAKPOINTS = {
  xs: 320,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
}

export const isScreenSize = (size) => {
  return window.innerWidth <= BREAKPOINTS[size]
}

export const isLandscape = () => {
  return window.matchMedia('(orientation: landscape)').matches
}

export const isXs = () => isScreenSize('xs')
export const isSm = () => isScreenSize('sm')
export const isMd = () => isScreenSize('md')
export const isLg = () => isScreenSize('lg')
export const isXl = () => isScreenSize('xl')
export const isXxl = () => isScreenSize('xxl')

export const isMobile = () => isScreenSize('lg')
export const isMobileLandscape = () => isMobile() && isLandscape()

/**
 * Watches a breakpoint and calls back whenever the screen crosses it. The
 * isScreenSize helpers above read window.innerWidth once, which is enough for a
 * layout decision made at mount but not for one that has to survive a rotate or a
 * resize — hence matchMedia, which fires only on the crossing rather than on every
 * resize frame.
 *
 * @param {string} size a key of BREAKPOINTS
 * @param {Function} onChange called with the new boolean when the breakpoint is crossed
 * @returns {Function} unsubscribes; call it on unmount
 */
export const subscribeToScreenSize = (size, onChange) => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}
  }

  const query = window.matchMedia(`(max-width: ${BREAKPOINTS[size]}px)`)
  const listener = (event) => onChange(event.matches)

  // Safari only grew addEventListener on MediaQueryList in 14.
  if (query.addEventListener) {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }

  query.addListener(listener)
  return () => query.removeListener(listener)
}
