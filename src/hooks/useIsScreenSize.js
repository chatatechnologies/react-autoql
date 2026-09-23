import { useEffect, useState } from 'react'

import { isScreenSize, subscribeToScreenSize } from '../js/breakpoints'

/**
 * Whether the screen is currently at or below a breakpoint, kept up to date across
 * resizes and rotations.
 *
 * @param {string} size a key of BREAKPOINTS ('sm', 'md', ...)
 * @returns {boolean}
 */
export const useIsScreenSize = (size) => {
  const [matches, setMatches] = useState(() => isScreenSize(size))

  useEffect(() => {
    // The screen can have crossed the breakpoint between the initial state above
    // and this effect running, so re-read rather than waiting for a change event
    // that already happened.
    setMatches(isScreenSize(size))
    return subscribeToScreenSize(size, setMatches)
  }, [size])

  return matches
}

export default useIsScreenSize
