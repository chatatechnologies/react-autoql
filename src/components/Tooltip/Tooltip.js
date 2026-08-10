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

  // react-tooltip renders inline by default, which traps it inside whatever stacking
  // context its parent creates (toolbars, drawers, etc). Anything rendered through a
  // body-level portal - react-tiny-popover menus, modals - then paints on top of it
  // regardless of z-index. Anchors are resolved globally via `data-tooltip-id`, so
  // portalling to <body> is safe and fixes the stacking for every consumer at once.
  // Theme CSS variables are set on documentElement, so styling is unaffected.
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
