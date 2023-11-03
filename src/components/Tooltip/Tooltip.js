import React, { useEffect } from 'react'
import { uuidv4 } from 'autoql-fe-utils'
import { isMobile } from 'react-device-detect'
import { Tooltip as ReactTooltip } from 'react-tooltip'

import './Tooltip.scss'

export function Tooltip(props = {}) {
  if (isMobile) {
    return null
  }

  const DEFAULT_TOOLTIP_ID = `react-autoql-tooltip-default-id-${uuidv4()}`

  const setIsOpen = (isOpen) => isOpen

  useEffect(() => {
    return () => {
      setIsOpen(false)
    }
  }, [])

  return (
    <ReactTooltip
      place='top'
      effect='solid'
      delayShow={500}
      globalCloseEvents={{ scroll: true }}
      {...props}
      id={props.tooltipId ?? DEFAULT_TOOLTIP_ID}
      className={`react-autoql-tooltip${props.className ? ` ${props.className}` : ''}`}
      border={props.border ? '1px solid var(--react-autoql-border-color)' : undefined}
      setIsOpen={setIsOpen}
    />
  )
}

export default Tooltip
