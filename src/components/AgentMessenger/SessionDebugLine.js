import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'

const COPIED_DURATION = 1500

/**
 * Debug affordance only - shown once per thread, above the transcript, when the
 * `debug` prop is on and the session has been established. Support asks for the
 * session id constantly and there is otherwise no way for a user to read it.
 */
const SessionDebugLine = ({ sessionId }) => {
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  const copy = useCallback(
    async (event) => {
      // The transcript swallows clicks to skip the typing animation.
      event.stopPropagation()

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(sessionId)
        } else {
          // Older Safari and any non-secure context.
          const textarea = document.createElement('textarea')
          textarea.value = sessionId
          textarea.className = 'hidden-clipboard-textarea'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }

        setIsCopied(true)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_DURATION)
      } catch (error) {
        console.error(error)
      }
    },
    [sessionId],
  )

  return (
    <div className='react-autoql-agent-session-debug'>
      <span className='react-autoql-agent-session-debug-label'>Session</span>
      <span className='react-autoql-agent-session-debug-id'>{sessionId}</span>
      <button
        className={`react-autoql-agent-session-debug-copy${isCopied ? ' is-copied' : ''}`}
        onClick={copy}
        aria-label={isCopied ? 'Session ID copied' : 'Copy session ID'}
      >
        <Icon type={isCopied ? 'check' : 'copy'} />
      </button>
    </div>
  )
}

SessionDebugLine.propTypes = {
  sessionId: PropTypes.string.isRequired,
}

export default SessionDebugLine
