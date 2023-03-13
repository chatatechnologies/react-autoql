import React from 'react'
import ReactTooltip from 'react-tooltip'

export const rebuildTooltips = () => {
  ReactTooltip.rebuild()
}

export const hideTooltips = () => {
  ReactTooltip.hide()
}

export function Tooltip(props) {
  return <ReactTooltip {...props} html />
}

export default Tooltip
