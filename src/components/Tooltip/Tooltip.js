import React, { useMemo } from 'react'
import ReactDOM from 'react-dom'
import { uuidv4 } from 'autoql-fe-utils'
import { isMobile } from 'react-device-detect'
import { Tooltip as ReactTooltip } from 'react-tooltip'

import './Tooltip.scss'

export function Tooltip(props = {}) {
  // Keep the fallback id stable across renders so the tooltip doesn't lose its anchors
  const defaultTooltipId = useMemo(() => `react-autoql-tooltip-default-id-${uuidv4()}`, [])

  if (isMobile) {
    return null
  }

  const tooltip = (
    <ReactTooltip
      place='top'
      effect='solid'
      delayShow={800}
      globalCloseEvents={{ scroll: true }}
      render={({ content, activeAnchor }) => {
        return content
      }}
      {...props}
      id={props.tooltipId ?? defaultTooltipId}
      className={`react-autoql-tooltip${props.className ? ` ${props.className}` : ''}`}
      border={props.border ? '1px solid var(--react-autoql-border-color)' : undefined}
    />
  )

  // Rendered inline, the tooltip is trapped in its parent's stacking context and painted over by
  // body-level portals (popover menus, modals). Anchors resolve globally via `data-tooltip-id` and
  // theme vars live on documentElement, so portalling to <body> is safe and fixes it everywhere.
  if (typeof document === 'undefined' || !document.body) {
    return tooltip
  }

  return ReactDOM.createPortal(tooltip, document.body)
}

export const triggerGlobalTooltipClose = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('scroll'))
    }
  } catch (e) {
    // Ignore errors from environments without window
  }
}

export default Tooltip
