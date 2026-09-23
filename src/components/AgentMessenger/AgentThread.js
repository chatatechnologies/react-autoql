import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { CustomScrollbars } from '../CustomScrollbars'
import { dataFormattingType } from '../../props/types'

import AgentMessage from './AgentMessage'
import SessionDebugLine from './SessionDebugLine'
import { SESSION_ENDED_NOTICE, ThreadStatuses } from './threadsReducer'

import './AgentThread.scss'

const AT_BOTTOM_THRESHOLD = 24
const SCROLL_DURATION = 300

/**
 * One thread's scroll area. Autoscroll only follows new content when the reader is
 * already at the bottom - scrolling up to re-read an earlier answer must not be
 * yanked back down while text is still typing out.
 */
const AgentThread = ({
  thread,
  isActive,
  dataFormatting,
  tableMaxHeight,
  enableTypewriter,
  showPhaseLabels,
  emptyStateTitle,
  emptyStateSubtitle,
  suggestions,
  onSuggestionClick,
  onItemRevealed,
  onRetry,
  onStartNewSession,
  getModelLabel,
  debug,
}) => {
  const scrollComponentRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const [skipAnimations, setSkipAnimations] = useState(false)

  const getContainer = () => scrollComponentRef.current?.getContainer()

  const checkIfAtBottom = useCallback(() => {
    const container = getContainer()
    if (!container) {
      return
    }

    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < AT_BOTTOM_THRESHOLD

    isAtBottomRef.current = atBottom
    setIsAtBottom((current) => (current === atBottom ? current : atBottom))
  }, [])

  useEffect(() => {
    const container = getContainer()
    if (!container) {
      return undefined
    }

    container.addEventListener('scroll', checkIfAtBottom, { passive: true })
    checkIfAtBottom()

    return () => container.removeEventListener('scroll', checkIfAtBottom)
  }, [checkIfAtBottom, isActive])

  const scrollToBottom = useCallback(() => {
    const container = getContainer()
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight - container.clientHeight
    scrollComponentRef.current?.update()
  }, [])

  // Eased scroll, matching the feel of the same affordance in ChatContent.
  const smoothScrollToBottom = useCallback(() => {
    const container = getContainer()
    if (!container) {
      return
    }

    const startScrollTop = container.scrollTop
    const distance = container.scrollHeight - container.clientHeight - startScrollTop
    const startTime = performance.now()

    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / SCROLL_DURATION, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      container.scrollTop = startScrollTop + distance * easeOut
      scrollComponentRef.current?.update()

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        checkIfAtBottom()
      }
    }

    requestAnimationFrame(animate)
  }, [checkIfAtBottom])

  // Called on every reveal tick, so it has to stay cheap. Two things keep it that way:
  // repeated calls within one frame collapse into a single scroll write, and
  // perfect-scrollbar's update() - which forces a full reflow - is throttled instead
  // of running per tick. settleScroll() does the final accurate update once typing
  // stops.
  const followRafRef = useRef(null)
  const lastUpdateRef = useRef(0)

  const followContent = useCallback(() => {
    if (!isAtBottomRef.current || followRafRef.current) {
      return
    }

    followRafRef.current = requestAnimationFrame(() => {
      followRafRef.current = null

      const container = getContainer()
      if (!container) {
        return
      }

      container.scrollTop = container.scrollHeight - container.clientHeight

      const now = performance.now()
      if (now - lastUpdateRef.current > 150) {
        lastUpdateRef.current = now
        scrollComponentRef.current?.update()
      }
    })
  }, [])

  const settleScroll = useCallback(() => {
    scrollComponentRef.current?.update()

    if (isAtBottomRef.current) {
      scrollToBottom()
    }
  }, [scrollToBottom])

  useEffect(() => {
    return () => {
      if (followRafRef.current) {
        cancelAnimationFrame(followRafRef.current)
      }
    }
  }, [])

  // When an item finishes revealing, do the one accurate scrollbar update that the
  // throttled follow path deliberately skipped.
  const onItemSettled = useCallback(
    (itemId) => {
      // The owning thread's id travels with the item: a response can finish
      // revealing while the user is on another tab, and the reveal has to be
      // recorded against this thread rather than whichever one is active.
      onItemRevealed?.(thread.id, itemId)
      settleScroll()
    },
    [onItemRevealed, settleScroll, thread.id],
  )

  const messageCount = thread.messages.length

  useEffect(() => {
    // A new message always counts as something the reader asked for.
    isAtBottomRef.current = true
    requestAnimationFrame(scrollToBottom)
  }, [messageCount, scrollToBottom])

  useEffect(() => {
    if (isActive) {
      scrollComponentRef.current?.update()
    }
  }, [isActive])

  // Clicking the transcript or pressing Escape gives up on the typing animation.
  const skip = useCallback(() => setSkipAnimations(true), [])

  useEffect(() => {
    setSkipAnimations(false)
  }, [messageCount])

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        skip()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, skip])

  const isSending = thread.status === ThreadStatuses.SENDING
  const isEmpty = !messageCount && !isSending

  return (
    <div className={`react-autoql-agent-thread${isActive ? '' : ' is-hidden'}`}>
      <CustomScrollbars ref={scrollComponentRef} className='react-autoql-agent-thread-scrollbars' suppressScrollX>
        <div className='react-autoql-agent-thread-content' onClick={skip}>
          {debug && !!thread.sessionId && <SessionDebugLine sessionId={thread.sessionId} />}
          {isEmpty ? (
            <div className='react-autoql-agent-empty-state'>
              <Icon type='react-autoql-logo' className='react-autoql-agent-empty-state-logo' />
              <h3 className='react-autoql-agent-empty-state-title'>{emptyStateTitle}</h3>
              {!!emptyStateSubtitle && <p className='react-autoql-agent-empty-state-subtitle'>{emptyStateSubtitle}</p>}
              {!!suggestions?.length && (
                <div className='react-autoql-agent-suggestions'>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className='react-autoql-agent-suggestion'
                      onClick={(event) => {
                        event.stopPropagation()
                        onSuggestionClick(suggestion)
                      }}
                    >
                      <span>{suggestion}</span>
                      <span className='react-autoql-agent-suggestion-arrow'>→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            thread.messages.map((message, index) => {
              const previous = thread.messages[index - 1]

              return (
                <AgentMessage
                  key={message.id}
                  message={message}
                  isFirst={index === 0}
                  // A change of speaker gets more air than a continuation.
                  followsSameRole={!!previous && previous.role === message.role}
                  dataFormatting={dataFormatting}
                  tableMaxHeight={tableMaxHeight}
                  enableTypewriter={enableTypewriter && !skipAnimations}
                  showPhaseLabel={showPhaseLabels}
                  // Off for now: the model is hardcoded on the backend, so labelling
                  // a response with it tells the reader nothing. Flip this back to
                  // "changed since the previous agent message" when it's selectable
                  // again.
                  showModelLabel={false}
                  modelLabel={getModelLabel ? getModelLabel(message.llmModel) : message.llmModel}
                  revealedItemIds={thread.revealedItemIds}
                  onItemRevealed={onItemSettled}
                  onItemProgress={followContent}
                  onRetry={onRetry}
                  onStartNewSession={onStartNewSession}
                />
              )
            })
          )}
          {/* Closure for the transcript itself. The way out lives in the composer,
              which stays put while this scrolls away with the rest of the history. */}
          {thread.isSessionComplete && !isSending && (
            <div className='react-autoql-agent-ended-divider'>
              <span>{SESSION_ENDED_NOTICE}</span>
            </div>
          )}
          {isSending && (
            <div className='react-autoql-agent-thinking'>
              <div className='react-autoql-agent-avatar'>
                <Icon type='react-autoql-logo' />
              </div>
              <div className='react-autoql-agent-thinking-dots'>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </CustomScrollbars>
      {!isAtBottom && (
        <button
          className='react-autoql-agent-scroll-to-bottom'
          onClick={smoothScrollToBottom}
          aria-label='Scroll to latest'
        >
          <Icon type='caret-down' />
          <span>Latest</span>
        </button>
      )}
    </div>
  )
}

AgentThread.propTypes = {
  thread: PropTypes.shape({
    id: PropTypes.string,
    messages: PropTypes.array,
    status: PropTypes.string,
    revealedItemIds: PropTypes.shape({}),
    sessionId: PropTypes.string,
    isSessionComplete: PropTypes.bool,
  }).isRequired,
  isActive: PropTypes.bool,
  dataFormatting: dataFormattingType,
  tableMaxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  enableTypewriter: PropTypes.bool,
  showPhaseLabels: PropTypes.bool,
  emptyStateTitle: PropTypes.string,
  emptyStateSubtitle: PropTypes.string,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  onSuggestionClick: PropTypes.func,
  onItemRevealed: PropTypes.func,
  onRetry: PropTypes.func,
  onStartNewSession: PropTypes.func,
  getModelLabel: PropTypes.func,
  debug: PropTypes.bool,
}

AgentThread.defaultProps = {
  isActive: true,
  dataFormatting: dataFormattingDefault,
  tableMaxHeight: 400,
  enableTypewriter: true,
  showPhaseLabels: true,
  emptyStateTitle: 'What would you like to know?',
  emptyStateSubtitle: 'Ask about your data in plain language.',
  suggestions: [],
  onSuggestionClick: () => {},
  onItemRevealed: undefined,
  onRetry: undefined,
  onStartNewSession: undefined,
  getModelLabel: undefined,
  debug: false,
}

export default AgentThread
