import React from 'react'
import ReactTooltip from 'react-tooltip'
import { isMobile } from 'react-device-detect'

export const TOOLTIP_TIMER_KEY = 'react-autoql-tooltip-rebuild-timer'

export const rebuildTooltips = (delay = 500) => {
  const timerID = sessionStorage.getItem(TOOLTIP_TIMER_KEY)

  if (!timerID) {
    // No need to delay if it is the first call
    ReactTooltip.rebuild()
  }

  clearTimeout(timerID)
  sessionStorage.setItem(
    TOOLTIP_TIMER_KEY,
    setTimeout(() => {
      sessionStorage.removeItem(TOOLTIP_TIMER_KEY)
      if (timerID) {
        ReactTooltip.rebuild()
      }
    }, delay),
  )
}

export const hideTooltips = () => {
  ReactTooltip.hide()
}

export function Tooltip(props) {
  if (isMobile) {
    return null
  }
  return <ReactTooltip {...props} html />
}

export default Tooltip
