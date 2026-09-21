import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'
import { parseJwt } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import SpeechToTextButtonBrowser from '../SpeechToTextButton/SpeechToTextButtonBrowser'
import { authenticationType } from '../../props/types'

// ModelSelect is still in the tree, just not rendered - see the composer toolbar
// below.
import './AgentComposer.scss'

const MAX_HEIGHT_PX = 120
// Same depth QueryInput keeps for the regular messenger.
const MAX_HISTORY = 5

// Its own store rather than QueryInput's 'query-history-*': the two pages take
// different kinds of question, and mixing them makes both histories worse.
const HISTORY_KEY = 'agent-query-history'

// Scoped to the user and project when the token says who they are, as QueryInput
// does; an unparseable or absent token falls back to one shared store rather than
// dropping the history altogether.
const getHistoryID = (authentication) => {
  if (!authentication?.token) {
    return HISTORY_KEY
  }

  try {
    const tokenInfo = parseJwt(authentication.token)

    if (!tokenInfo?.user_id && !tokenInfo?.project_id) {
      return HISTORY_KEY
    }

    return `${HISTORY_KEY}-${tokenInfo.user_id}-${tokenInfo.project_id}`
  } catch (error) {
    return HISTORY_KEY
  }
}

const getHistory = (authentication) => {
  try {
    const id = getHistoryID(authentication)
    const historyStr = id ? localStorage.getItem(id) : undefined

    if (!historyStr) {
      return []
    }

    const history = JSON.parse(historyStr)

    return Array.isArray(history) ? history : []
  } catch (error) {
    console.error(error)
    return []
  }
}

const addToHistory = (authentication, message) => {
  try {
    const id = getHistoryID(authentication)

    if (!id) {
      return
    }

    // Newest first, and a repeat of an older message moves up rather than
    // appearing twice.
    const history = [message, ...getHistory(authentication).filter((entry) => entry !== message)]
    localStorage.setItem(id, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch (error) {
    console.error(error)
  }
}

/**
 * The composer. Deliberately not QueryInput: there's no autocomplete, validation or
 * topics machinery in a session conversation, just text in and a model choice.
 */
const AgentComposer = forwardRef(
  (
    {
      authentication,
      threadId,
      placeholder,
      isSending,
      isSessionComplete,
      endedMessage,
      onStartNewSession,
      enableVoiceRecord,
      // models, modelsStatus, llmModel, onModelChange and popoverParentElement are
      // still accepted (see propTypes) but unused while the picker is off.
      onSubmit,
      onCancel,
      tooltipID,
    },
    ref,
  ) => {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const textareaRef = useRef(null)
    // Where the arrow keys are in the stored history: -1 is the live draft.
    const historyIndexRef = useRef(-1)

    // One composer serves every thread, so the draft has to be parked per thread on
    // the way out and restored on the way back in - otherwise unsent text follows
    // the user across tabs.
    const draftsRef = useRef({})
    const lastThreadIdRef = useRef(threadId)
    // Read inside the thread-switch effect, which must see the text as it stands at
    // that moment rather than whatever it was when the effect was last created.
    const valueRef = useRef(value)
    valueRef.current = value
    // Set by setText: a draft meant for the thread we are about to switch *to*, so
    // it has to survive the restore below instead of being overwritten by it.
    const pendingTextRef = useRef(null)

    useEffect(() => {
      const lastThreadId = lastThreadIdRef.current

      if (lastThreadId === threadId) {
        return
      }

      lastThreadIdRef.current = threadId
      historyIndexRef.current = -1

      if (pendingTextRef.current !== null) {
        // The carried-over text is already in the input; the thread it came from
        // keeps whatever draft it had rather than a copy of this one.
        pendingTextRef.current = null
        return
      }

      if (lastThreadId !== undefined) {
        draftsRef.current[lastThreadId] = valueRef.current
      }

      setValue(draftsRef.current[threadId] ?? '')
    }, [threadId])

    // A recalled message is only worth stepping past when the caret has nowhere
    // left to go, so the arrows keep working inside a multi-line draft.
    const isCaretOnFirstLine = () => {
      const textarea = textareaRef.current

      if (!textarea || textarea.selectionStart !== textarea.selectionEnd) {
        return false
      }

      return !textarea.value.slice(0, textarea.selectionStart).includes('\n')
    }

    const isCaretOnLastLine = () => {
      const textarea = textareaRef.current

      if (!textarea || textarea.selectionStart !== textarea.selectionEnd) {
        return false
      }

      return !textarea.value.slice(textarea.selectionEnd).includes('\n')
    }

    const focus = useCallback(() => {
      textareaRef.current?.focus()
    }, [])

    // setText puts a draft in without sending it - used when a thread's session has
    // ended and the question moves to a new thread for the user to adjust and send.
    const setText = useCallback((text) => {
      historyIndexRef.current = -1
      // Flagged as pending so the thread switch that follows leaves it alone.
      pendingTextRef.current = text ?? ''
      setValue(text ?? '')

      // Caret at the end, so they can keep typing rather than land mid-draft.
      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current
        const end = textarea?.value?.length ?? 0
        textarea?.setSelectionRange(end, end)
      })
    }, [])

    // A closed thread is gone for good, so its parked draft goes with it.
    const clearDraft = useCallback((id) => {
      delete draftsRef.current[id]
    }, [])

    useImperativeHandle(ref, () => ({ focus, setText, clearDraft }), [focus, setText, clearDraft])

    // Grow with the content up to MAX_HEIGHT_PX, then let the textarea scroll.
    const resize = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(MAX_HEIGHT_PX, textarea.scrollHeight)}px`
    }, [])

    useEffect(() => {
      resize()
    }, [value, resize])

    const submit = () => {
      const text = value.trim()

      if (!text || isSending) {
        return
      }

      addToHistory(authentication, text)
      historyIndexRef.current = -1
      setValue('')
      onSubmit(text)
    }

    // Walk the recent messages with the arrow keys, as QueryInput does. -1 is the
    // live (unsent) text; 0 is the most recent message.
    const recallHistory = (direction) => {
      const textarea = textareaRef.current
      const history = getHistory(authentication)

      if (!history.length) {
        return false
      }

      const nextIndex = historyIndexRef.current + direction

      if (nextIndex < -1 || nextIndex >= history.length) {
        return false
      }

      historyIndexRef.current = nextIndex
      setValue(nextIndex === -1 ? '' : history[nextIndex])

      // The value change moves the caret to the start otherwise, which makes the
      // recalled text awkward to edit.
      window.requestAnimationFrame(() => {
        const end = textarea?.value?.length ?? 0
        textarea?.setSelectionRange(end, end)
      })

      return true
    }

    const onKeyDown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submit()
        return
      }

      // Only when the caret can't go any further in that direction - inside a
      // multi-line draft the arrows still move the caret.
      if (event.key === 'ArrowUp' && isCaretOnFirstLine() && recallHistory(1)) {
        event.preventDefault()
      } else if (event.key === 'ArrowDown' && isCaretOnLastLine() && recallHistory(-1)) {
        event.preventDefault()
      }
    }

    const canSend = !!value.trim()

    // A closed session rejects anything sent to it, so the input is taken away rather
    // than left to look usable - the point of reading session_status off the response
    // is that the user learns the conversation is over before typing into it, not
    // after. The offer of a new thread takes the input's place, so the way forward is
    // where the question would have gone.
    if (isSessionComplete) {
      return (
        <div className='react-autoql-agent-composer is-session-complete'>
          <div className='react-autoql-agent-composer-ended'>
            <div className='react-autoql-agent-composer-ended-text'>
              <Icon type='info' />
              <span>{endedMessage}</span>
            </div>
            {!!onStartNewSession && (
              <button className='react-autoql-agent-composer-ended-btn' onClick={onStartNewSession}>
                <Icon type='plus' />
                <span>Start a new conversation</span>
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className={`react-autoql-agent-composer${isSending ? ' is-sending' : ''}`}>
        <div
          className={`react-autoql-agent-composer-input-row${isFocused && !isSending ? ' is-focused' : ''}${
            isSending ? ' is-sending' : ''
          }`}
        >
          <textarea
            ref={textareaRef}
            className='react-autoql-agent-composer-input'
            rows={1}
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              // Typing over a recalled message makes it the draft again.
              historyIndexRef.current = -1
              setValue(event.target.value)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label={placeholder}
          />
          {!isMobile && enableVoiceRecord && !isSending && (
            <div className='react-autoql-agent-composer-microphone'>
              <SpeechToTextButtonBrowser
                authentication={authentication}
                onTranscriptChange={(transcript) => setValue(transcript)}
                onFinalTranscript={(transcript) => setValue(transcript)}
                tooltipID={tooltipID}
              />
            </div>
          )}
          {isSending ? (
            <button
              className='react-autoql-agent-composer-btn is-stop'
              onClick={onCancel}
              aria-label='Stop generating'
              data-tooltip-content='Stop'
              data-tooltip-id={tooltipID}
            >
              <span className='react-autoql-agent-stop-glyph' />
            </button>
          ) : (
            <button
              className={`react-autoql-agent-composer-btn is-send${canSend ? ' can-send' : ''}`}
              onClick={submit}
              disabled={!canSend}
              aria-label='Send message'
            >
              <Icon type='send' />
            </button>
          )}
        </div>

        {/* The toolbar row - model picker and the "↵ to send" hint - is turned off
            for now; it was mostly empty space under the input. The model still
            comes through on llmModel, so turning it back on is putting this row
            back. */}
      </div>
    )
  },
)

AgentComposer.displayName = 'AgentComposer'

AgentComposer.propTypes = {
  authentication: authenticationType,
  threadId: PropTypes.string,
  placeholder: PropTypes.string,
  isSending: PropTypes.bool,
  isSessionComplete: PropTypes.bool,
  endedMessage: PropTypes.string,
  onStartNewSession: PropTypes.func,
  enableVoiceRecord: PropTypes.bool,
  models: PropTypes.array,
  modelsStatus: PropTypes.string,
  llmModel: PropTypes.string,
  onModelChange: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  popoverParentElement: PropTypes.any,
  tooltipID: PropTypes.string,
}

AgentComposer.defaultProps = {
  authentication: undefined,
  threadId: undefined,
  placeholder: 'Ask a question…',
  isSending: false,
  isSessionComplete: false,
  endedMessage: 'This conversation has ended. Start a new one to keep going.',
  onStartNewSession: undefined,
  enableVoiceRecord: false,
  models: [],
  modelsStatus: undefined,
  llmModel: undefined,
  onModelChange: () => {},
  onCancel: () => {},
  popoverParentElement: undefined,
  tooltipID: undefined,
}

export default AgentComposer
