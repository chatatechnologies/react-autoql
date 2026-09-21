import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { ConfirmPopover } from '../ConfirmPopover'
import { withTheme } from '../../theme'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { authenticationType, dataFormattingType } from '../../props/types'
import { scrollTabIntoView } from '../../js/scrollTabIntoView'

import AgentThread from './AgentThread'
import AgentComposer from './AgentComposer'
import { useAgentSession } from './useAgentSession'
import { EndedReasons, ThreadStatuses } from './threadsReducer'

import './AgentMessenger.scss'

/**
 * Session-based messenger. Each thread owns a server session: the first message
 * POSTs /sessions, every message after that POSTs /sessions/{id}/resume. Closing a
 * thread discards it - there is no persistence yet, by design.
 *
 * Threads show as a horizontal tab strip, exactly as the Data Messenger's sessions
 * do. Tabs keep their width at any drawer width and the strip scrolls horizontally
 * instead of collapsing into a dropdown - one control that behaves the same way
 * everywhere beats two that swap at a breakpoint.
 */
const AgentMessenger = ({
  authentication,
  dataFormatting,
  placeholder,
  emptyStateTitle,
  emptyStateSubtitle,
  suggestions,
  enableVoiceRecord,
  models,
  modelsEndpoint,
  defaultModelId,
  maxThreads,
  maxMessagesPerThread,
  tableMaxHeight,
  enableTypewriter,
  showPhaseLabels,
  sessionEndedMessage,
  enableMockResponses,
  debug,
  tooltipID,
  onErrorCallback,
  onSessionCreated,
  onSessionStatusChange,
  onThreadClose,
  shouldRender,
  isActivePage,
  isResizing,
}) => {
  const tooltipIdRef = useRef(tooltipID ?? `react-autoql-agent-messenger-tooltip-${uuid()}`)
  const composerRef = useRef(null)
  const tabsRef = useRef(null)
  // State rather than a ref: the model popover needs this element as its parent, and
  // a ref assignment wouldn't re-render to hand it over.
  const [containerElement, setContainerElement] = useState(null)
  const [justOpenedId, setJustOpenedId] = useState(null)

  const {
    activeThread,
    threads,
    models: modelsState,
    submit,
    openThread,
    closeThread,
    closeAllThreads,
    activateThread,
    setThreadModel,
    cancelThreadRequest,
    markItemRevealed,
    lastOpenedThreadId,
  } = useAgentSession({
    authentication,
    models,
    modelsEndpoint,
    defaultModelId,
    maxThreads,
    maxMessagesPerThread,
    enableMockResponses,
    onSessionCreated,
    onSessionStatusChange,
    onErrorCallback,
  })

  // Whether the page occupies layout. Separate from shouldRender the same way
  // ChatContent splits them: a closed drawer keeps its active page laid out so
  // measured children (SimpleTable's column widths) survive being reopened.
  const isLaidOut = isActivePage ?? shouldRender

  useEffect(() => {
    // The iOS keyboard misbehaves on autofocus, so mobile is left alone.
    if (isLaidOut && !isMobile) {
      composerRef.current?.focus()
    }
  }, [isLaidOut, activeThread?.id])

  const onSubmit = useCallback(
    (text) => {
      if (activeThread) {
        submit(activeThread.id, text)
      }
    },
    [activeThread, submit],
  )

  const onCloseThread = useCallback(
    (threadId) => {
      closeThread(threadId)
      onThreadClose?.(threadId)
    },
    [closeThread, onThreadClose],
  )

  // The same end state as closing each tab in turn - one empty thread - reached
  // without the strip reshuffling under the cursor on every click. Integrators hear
  // about each thread that went, the same as a one-at-a-time close.
  const onCloseAllThreads = useCallback(() => {
    const closedIds = threads.map((thread) => thread.id)

    closeAllThreads()
    closedIds.forEach((threadId) => onThreadClose?.(threadId))
  }, [threads, closeAllThreads, onThreadClose])

  const onNewThread = useCallback(() => {
    openThread()
  }, [openThread])

  const onKeyDown = useCallback(
    (event) => {
      if (!isLaidOut) {
        return
      }

      if (!(event.metaKey || event.ctrlKey)) {
        return
      }

      if (event.key === 't') {
        event.preventDefault()
        onNewThread()
      } else if (event.key === 'w' && activeThread) {
        event.preventDefault()
        onCloseThread(activeThread.id)
      }
    },
    [isLaidOut, onNewThread, onCloseThread, activeThread],
  )

  // Scoped to the panel rather than the window: Cmd/Ctrl+T and Cmd/Ctrl+W are
  // ordinary browser shortcuts everywhere else in the host app, so they may only be
  // taken over while focus is actually inside the messenger.
  useEffect(() => {
    if (!containerElement) {
      return
    }

    containerElement.addEventListener('keydown', onKeyDown)
    return () => containerElement.removeEventListener('keydown', onKeyDown)
  }, [containerElement, onKeyDown])

  const onItemRevealed = useCallback(
    (itemId) => {
      if (activeThread) {
        markItemRevealed(activeThread.id, itemId)
      }
    },
    [activeThread, markItemRevealed],
  )

  const getLastUserText = useCallback((thread) => {
    const lastUserMessage = [...(thread?.messages ?? [])].reverse().find((message) => message.role === 'user')
    return lastUserMessage?.items?.[0]?.data?.text
  }, [])

  // "Try again" on an error item re-sends the question that failed.
  const onRetry = useCallback(() => {
    const text = getLastUserText(activeThread)

    if (text) {
      onSubmit(text)
    }
  }, [activeThread, onSubmit, getLastUserText])

  // Offered when a thread's session has ended. The question moves to a new thread as
  // a draft rather than being sent: it's often a follow-up that only made sense
  // against the old conversation, and the fresh session has none of that history - so
  // the user gets to reword it before it goes. The dead thread is left intact behind
  // them, which is what they'd be referring back to while they edit.
  const onStartNewSession = useCallback(() => {
    // Only a question the old session turned away is worth carrying over. When the
    // agent finished the job instead, the last question already has its answer above -
    // re-drafting it would ask the new session to redo work the user just read.
    const text = activeThread?.endedReason === EndedReasons.EXPIRED ? getLastUserText(activeThread) : ''

    openThread()
    composerRef.current?.setText(text ?? '')
  }, [activeThread, openThread, getLastUserText])

  // Flash the newly opened tab briefly: with two empty threads the transcript looks
  // identical either way, so the toolbar has to carry the feedback.
  useEffect(() => {
    if (!lastOpenedThreadId) {
      return undefined
    }

    setJustOpenedId(lastOpenedThreadId)
    const timeout = setTimeout(() => setJustOpenedId(null), 900)
    return () => clearTimeout(timeout)
  }, [lastOpenedThreadId])

  // Reveal the selected thread's tab: opened while the strip is already full, a new
  // thread would otherwise land off the right edge with nothing to say it exists.
  useEffect(() => {
    const list = tabsRef.current
    const tab = list?.querySelector('.react-autoql-agent-tab.is-active')

    if (!list || !tab) {
      return undefined
    }

    return scrollTabIntoView(list, tab)
  }, [activeThread?.id, threads.length])

  // Messages record the model id they were sent with; the transcript should show the
  // human label the picker uses, not "gpt-4.1".
  const getModelLabel = useCallback(
    (modelId) => modelsState.list.find((model) => model.id === modelId)?.label ?? modelId,
    [modelsState.list],
  )

  const isSending = activeThread?.status === ThreadStatuses.SENDING

  return (
    <ErrorBoundary>
      <div
        ref={setContainerElement}
        className={`react-autoql-agent-messenger${isLaidOut ? '' : ' react-autoql-content-hidden'}${
          isResizing ? ' is-resizing' : ''
        }`}
      >
        {/* The toolbar is the Data Messenger session track - a rounded strip the
            chips sit on, scrolling horizontally once the threads outgrow it. */}
        <div className='react-autoql-agent-toolbar'>
          <div className='react-autoql-agent-tabs' role='tablist' ref={tabsRef}>
            {threads.map((thread) => (
              <div
                key={thread.id}
                role='tab'
                tabIndex={0}
                aria-selected={thread.id === activeThread?.id}
                className={`react-autoql-agent-tab${thread.id === activeThread?.id ? ' is-active' : ''}${
                  thread.id === justOpenedId ? ' is-new' : ''
                }`}
                onClick={() => activateThread(thread.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    activateThread(thread.id)
                  }
                }}
              >
                <span className='react-autoql-agent-tab-dot' aria-hidden='true' />
                {/* Titles are ellipsised, so the full text has to be reachable
                    somewhere - react-tooltip reads it off the anchor. */}
                <span
                  className='react-autoql-agent-tab-title'
                  data-tooltip-content={thread.title}
                  data-tooltip-id={tooltipIdRef.current}
                >
                  {thread.title}
                </span>
                {/* Closing the last thread resets it rather than leaving the page
                    with nothing - so on an empty one there would be nothing to
                    reset, and the click would look like it did nothing. */}
                {(threads.length > 1 || !!thread.messages.length) && (
                  <button
                    className='react-autoql-agent-tab-close'
                    aria-label={`Close ${thread.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseThread(thread.id)
                    }}
                    data-tooltip-content='Close thread'
                    data-tooltip-id={tooltipIdRef.current}
                  >
                    <Icon type='close' />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className='react-autoql-agent-toolbar-right'>
            {/* Only once there are several: with a single thread this is the close
                button already on the tab, under a name that promises more. */}
            {threads.length > 1 && (
              <ConfirmPopover
                className='react-autoql-agent-close-all-wrapper'
                popoverParentElement={containerElement}
                title={`Close all ${threads.length} threads?`}
                text='Your conversations will be cleared and a new thread will be started.'
                confirmText='Close all'
                backText='Cancel'
                danger
                onConfirm={onCloseAllThreads}
                positions={['bottom', 'left', 'top', 'right']}
                align='end'
                tooltipID={tooltipIdRef.current}
              >
                <button
                  className='react-autoql-agent-icon-btn is-close-all'
                  aria-label='Close all threads'
                  data-tooltip-content='Close all threads'
                  data-tooltip-id={tooltipIdRef.current}
                >
                  <Icon type='close-circle' />
                </button>
              </ConfirmPopover>
            )}
            <button
              className='react-autoql-agent-icon-btn react-autoql-agent-tab-new'
              onClick={onNewThread}
              disabled={threads.length >= maxThreads}
              aria-label='New thread'
              data-tooltip-content='New thread'
              data-tooltip-id={tooltipIdRef.current}
            >
              <Icon type='plus' />
            </button>
          </div>
        </div>

        <div className='react-autoql-agent-threads'>
          {/* Every thread stays mounted - an inactive one is hidden, not unmounted, so
              scroll position, already-typed text and table column widths survive a
              thread switch. */}
          {threads.map((thread) => (
            <AgentThread
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThread?.id}
              dataFormatting={dataFormatting}
              tableMaxHeight={tableMaxHeight}
              enableTypewriter={enableTypewriter}
              showPhaseLabels={showPhaseLabels}
              emptyStateTitle={emptyStateTitle}
              emptyStateSubtitle={emptyStateSubtitle}
              suggestions={suggestions}
              onSuggestionClick={onSubmit}
              onItemRevealed={onItemRevealed}
              onRetry={onRetry}
              // At the thread limit there's nowhere to send them, so the offer is
              // withheld rather than rendered as a button that does nothing. The
              // agent's message about the ended session still shows.
              onStartNewSession={threads.length >= maxThreads ? undefined : onStartNewSession}
              getModelLabel={getModelLabel}
              debug={debug}
            />
          ))}
        </div>

        <AgentComposer
          ref={composerRef}
          authentication={authentication}
          placeholder={placeholder}
          isSending={isSending}
          isSessionComplete={!!activeThread?.isSessionComplete}
          endedMessage={sessionEndedMessage}
          // At the thread limit there is nowhere to send them, so the offer is
          // withheld rather than rendered as a button that does nothing.
          onStartNewSession={threads.length >= maxThreads ? undefined : onStartNewSession}
          enableVoiceRecord={enableVoiceRecord}
          models={modelsState.list}
          modelsStatus={modelsState.status}
          llmModel={activeThread?.llmModel}
          onModelChange={(llmModel) => activeThread && setThreadModel(activeThread.id, llmModel)}
          onSubmit={onSubmit}
          onCancel={() => activeThread && cancelThreadRequest(activeThread.id)}
          popoverParentElement={containerElement}
          tooltipID={tooltipIdRef.current}
        />
      </div>
      {!tooltipID && <Tooltip tooltipId={tooltipIdRef.current} positionStrategy='fixed' />}
    </ErrorBoundary>
  )
}

AgentMessenger.propTypes = {
  authentication: authenticationType.isRequired,
  dataFormatting: dataFormattingType,
  placeholder: PropTypes.string,
  emptyStateTitle: PropTypes.string,
  emptyStateSubtitle: PropTypes.string,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  enableVoiceRecord: PropTypes.bool,
  // Provide models to skip the fetch entirely.
  models: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string })),
  modelsEndpoint: PropTypes.string,
  defaultModelId: PropTypes.string,
  maxThreads: PropTypes.number,
  maxMessagesPerThread: PropTypes.number,
  tableMaxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  enableTypewriter: PropTypes.bool,
  // Labels each agent response with the workflow step it came from (meta_data.phase).
  showPhaseLabels: PropTypes.bool,
  // What the composer says once meta_data.session_status closes the session.
  sessionEndedMessage: PropTypes.string,
  // Serves the captured session payloads instead of calling the API - the /sessions
  // endpoints aren't live yet. Development only; never leave it on in production.
  enableMockResponses: PropTypes.bool,
  // Surfaces the session id at the top of each thread so it can be copied into a bug
  // report. Nothing else is exposed by it.
  debug: PropTypes.bool,
  tooltipID: PropTypes.string,
  onErrorCallback: PropTypes.func,
  onSessionCreated: PropTypes.func,
  // Fired with { sessionId, phase, sessionStatus } whenever a response carries
  // meta_data, so an integrator can follow the session without reading our state.
  onSessionStatusChange: PropTypes.func,
  onThreadClose: PropTypes.func,
  shouldRender: PropTypes.bool,
  isActivePage: PropTypes.bool,
  isResizing: PropTypes.bool,
}

AgentMessenger.defaultProps = {
  dataFormatting: dataFormattingDefault,
  placeholder: 'Ask a question…',
  emptyStateTitle: 'What would you like to know?',
  emptyStateSubtitle: 'Ask about your data in plain language.',
  suggestions: [],
  enableVoiceRecord: false,
  models: undefined,
  modelsEndpoint: undefined,
  defaultModelId: undefined,
  maxThreads: 8,
  maxMessagesPerThread: 200,
  tableMaxHeight: 400,
  enableTypewriter: true,
  showPhaseLabels: true,
  sessionEndedMessage: 'This conversation has ended. Start a new one to keep going.',
  enableMockResponses: false,
  debug: false,
  tooltipID: undefined,
  onErrorCallback: undefined,
  onSessionCreated: undefined,
  onSessionStatusChange: undefined,
  onThreadClose: undefined,
  shouldRender: true,
  isActivePage: undefined,
  isResizing: false,
}

export default withTheme(AgentMessenger)
