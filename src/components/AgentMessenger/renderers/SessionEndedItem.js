import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'

const DEFAULT_LABEL = 'Start a new conversation'

/**
 * The way out of a thread whose session has closed, rendered inside the transcript.
 * The composer carries this offer now - meta_data.session_status tells us the session
 * closed as it closes, so the affordance belongs where the next question would have
 * been typed. This renderer stays for a `session_ended` item sent by the server.
 *
 * It's an offer rather than an automatic restart on purpose: the message that hit the
 * dead session is often a follow-up ("compare it to last season"), and a new session
 * has none of the earlier turns to resolve it against - so re-sending it verbatim
 * would produce a confident answer to the wrong question.
 */
const SessionEndedItem = ({ data, onStartNewSession, onRevealComplete, onProgress }) => {
  const completedRef = useRef(false)

  useEffect(() => {
    if (completedRef.current) {
      return
    }

    completedRef.current = true
    onProgress?.()
    onRevealComplete?.()
  }, [])

  if (!onStartNewSession) {
    return null
  }

  return (
    <div className='react-autoql-agent-session-ended-item'>
      <button className='react-autoql-agent-session-ended-btn' onClick={onStartNewSession}>
        <Icon type='plus' />
        <span>{data?.label ?? DEFAULT_LABEL}</span>
      </button>
    </div>
  )
}

SessionEndedItem.propTypes = {
  data: PropTypes.shape({ label: PropTypes.string }),
  onStartNewSession: PropTypes.func,
  onRevealComplete: PropTypes.func,
  onProgress: PropTypes.func,
}

SessionEndedItem.defaultProps = {
  data: {},
  onStartNewSession: undefined,
  onRevealComplete: undefined,
  onProgress: undefined,
}

export default SessionEndedItem
