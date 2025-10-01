import React, { useEffect } from 'react'
import { uuidv4 } from 'autoql-fe-utils'
import { isMobile } from 'react-device-detect'
import { Tooltip as ReactTooltip } from 'react-tooltip'

import './Tooltip.scss'

export function EnhancedTooltip(props = {}) {
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

  // This is our enhanced render function that applies styles based on content
  const enhancedRender = ({ content, activeAnchor }) => {
    let style = {}

    // Apply specific styling based on content
    if (content === 'Copied!') {
      style = {
        color: 'white',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '3px',
        fontFamily: 'var(--react-autoql-font-family, sans-serif)',
      }
    } else if (content === 'Failed to copy') {
      style = {
        backgroundColor: 'var(--react-autoql-error-color, #F44336)',
        color: 'white',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '3px',
        fontFamily: 'var(--react-autoql-font-family, sans-serif)',
      }
    } else if (content === 'Right-click to copy value') {
      style = {
        backgroundColor: 'var(--react-autoql-tooltip-bg-color, #222)',
        color: 'white',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '3px',
        fontFamily: 'var(--react-autoql-font-family, sans-serif)',
      }
    }

    // Use the existing render function if provided, otherwise render with our custom styles
    if (props.render) {
      return props.render({ content, activeAnchor })
    }

    return <div style={style}>{content}</div>
  }

  return (
    <ReactTooltip
      place='top'
      effect='solid'
      delayShow={100}
      globalCloseEvents={{ scroll: true }}
      {...props}
      render={enhancedRender}
      id={props.tooltipId ?? DEFAULT_TOOLTIP_ID}
      className={`react-autoql-tooltip${props.className ? ` ${props.className}` : ''}`}
      border={props.border ? '1px solid var(--react-autoql-border-color)' : undefined}
      setIsOpen={setIsOpen}
      closeOnEsc={false}
      isOpen={undefined} // Ensures hover works correctly
      float={true}
    />
  )
}

export default EnhancedTooltip
