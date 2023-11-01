import React from 'react'
import { isMobile } from 'react-device-detect'
import { Tooltip as ReactTooltip } from 'react-tooltip'

export function Tooltip(props = {}) {
  if (isMobile) {
    return null
  }

  return (
    <ReactTooltip
      place='top'
      effect='solid'
      {...props}
      // id={props.tooltipId ?? TOOLTIP_ID}
      // setIsOpen={setIsOpen}
      className={`react-autoql-tooltip${props.className ? ` ${props.className}` : ''}`}
      border={props.border ? '1px solid var(--react-autoql-border-color)' : undefined}
    />
  )
}

export default Tooltip
