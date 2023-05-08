import React from 'react'
import ReactTooltip from 'react-tooltip'
import { TOOLTIP_TIMER_KEY } from '../../js/Constants'

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
  return <ReactTooltip {...props} html />
}

export default Tooltip
