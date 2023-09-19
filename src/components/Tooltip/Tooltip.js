import React from 'react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { isMobile } from 'react-device-detect'

export function Tooltip(props = {}) {
  if (isMobile) {
    return null
  }

  return (
    <ReactTooltip
      place='top'
      effect='solid'
      {...props}
      border={props.border ? '1px solid var(--react-autoql-border-color)' : undefined}
    />
  )
}

export default Tooltip
