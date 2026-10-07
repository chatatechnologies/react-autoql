import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Tooltip } from '../Tooltip'
import { SessionTabs } from '../SessionTabs'
import { withTheme } from '../../theme'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { authenticationType, dataFormattingType } from '../../props/types'
import { useIsScreenSize } from '../../hooks/useIsScreenSize'

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
 * Threads show in SessionTabs - literally the Data Messenger's session strip, over
 * threads instead of chats - which also owns the swap to the ThreadSwitcher dropdown
 * on a phone.
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
  // Phone-sized screens get the dropdown instead of the strip. Deliberately the
  // screen and not the drawer: a narrow drawer on a desktop still has a pointer,
  // hover and a real scrollbar, which is what the strip needs to work.
  const isSmallScreen = useIsScreenSize('sm')
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
    // shouldRender, not isLaidOut: the page stays laid out with the drawer shut
    // (and rc-drawer keeps its content mounted), so focusing on isLaidOut took
    // focus off the host page on load with defaultTab='agent', sending the user's
    // keystrokes - and an Enter - into a textarea they couldn't see. ChatContent
    // gates the same focus the same way.
    // The iOS keyboard misbehaves on autofocus, so mobile is left alone.
    if (shouldRender && !isMobile) {
      composerRef.current?.focus()
    }
  }, [shouldRender, activeThread?.id])

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
      composerRef.current?.clearDraft(threadId)
      onThreadClose?.(threadId)
    },
    [closeThread, onThreadClose],
  )

  const onNewThread = useCallback(() => {
    openThread()
  }, [openThread])

  const onKeyDown = useCallback(
    (event) => {
      if (!isLaidOut) {
        return
      }

      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return
      }

      // Option/Alt puts a character in the composer and, on Windows, reaches for the
      // menu bar, so both branches have to preventDefault even when nothing happens.
      if (event.code === 'KeyT') {
        event.preventDefault()
        onNewThread()
      } else if (event.code === 'KeyW') {
        event.preventDefault()

        if (activeThread) {
          onCloseThread(activeThread.id)
        }
      }
    },
    [isLaidOut, onNewThread, onCloseThread, activeThread],
  )

  // Alt/Option rather than Cmd/Ctrl: the browser keeps Cmd/Ctrl+T and Cmd/Ctrl+W for
  // its own tabs and ignores preventDefault on them, so Cmd+W would have closed the
  // whole page along with the thread. Scoped to the panel as well, so the host app's
  // own shortcuts are only shadowed while focus is inside the messenger.
  useEffect(() => {
    if (!containerElement) {
      return
    }

    containerElement.addEventListener('keydown', onKeyDown)
    return () => containerElement.removeEventListener('keydown', onKeyDown)
  }, [containerElement, onKeyDown])

  const getLastUserText = useCallback((thread) => {
    const lastUserMessage = [...(thread?.messages ?? [])].reverse().find((message) => message.role === 'user')
    return lastUserMessage?.items?.[0]?.data?.text
  }, [])

  // "Try again" on an error item re-sends the question that failed - the user
  // message just above the errored one, not the most recent question in the
  // thread. Those differ as soon as the user asks something else after an error
  // and then scrolls back to retry the older one.
  const onRetry = useCallback(
    (messageId) => {
      const messages = activeThread?.messages ?? []
      const failedIndex = messages.findIndex((message) => message.id === messageId)
      const precedingUserMessage =
        failedIndex > 0
          ? [...messages.slice(0, failedIndex)].reverse().find((message) => message.role === 'user')
          : undefined

      const text = precedingUserMessage?.items?.[0]?.data?.text ?? getLastUserText(activeThread)

      if (text) {
        onSubmit(text)
      }
    },
    [activeThread, onSubmit, getLastUserText],
  )

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
        <SessionTabs
          items={threads.map((thread) => ({
            id: thread.id,
            title: thread.title,
            // Closing the last thread resets it rather than leaving the page with
            // nothing - so on an empty one there would be nothing to reset, and
            // the click would look like it did nothing.
            canClose: threads.length > 1 || !!thread.messages.length,
            closeLabel: `Close ${thread.title}`,
          }))}
          activeId={activeThread?.id}
          highlightId={justOpenedId}
          onSelect={activateThread}
          onClose={onCloseThread}
          onNew={onNewThread}
          canAddNew={threads.length < maxThreads}
          newLabel='New thread'
          closeItemTooltip='Close thread'
          tooltipID={tooltipIdRef.current}
          isSmallScreen={isSmallScreen}
        />

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
              // Called with the thread's own id, not the active one: an item can
              // finish revealing while the user is looking at another tab.
              onItemRevealed={markItemRevealed}
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
          // The composer keeps a draft per thread, so it has to know which one it
          // is writing for.
          threadId={activeThread?.id}
          placeholder={placeholder}
          isSending={isSending}
          isSessionComplete={!!activeThread?.isSessionComplete}
          endedMessage={sessionEndedMessage}
          // At the thread limit there is nowhere to send them, so the offer is
          // withheld rather than rendered as a button that does nothing.
          onStartNewSession={threads.length >= maxThreads ? undefined : onStartNewSession}
          enableVoiceRecord={enableVoiceRecord}
          // Not isLaidOut: that stays true with the drawer shut. The mic is the
          // one control that matters off screen, because every
          // SpeechToTextButtonBrowser shares a recogniser and the last one
          // mounted receives the transcript - a mic here while the chat is on
          // screen would take dictation meant for the chat's input.
          isOnScreen={shouldRender}
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
  // Where to fetch the model list from. No request is made without one - the
  // default endpoint isn't live yet - and the built-in list is used instead.
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
  // "Ask a question" is the Data Messenger's job. The first message here is
  // usually a half-formed one that gets sharpened over the next few turns, so the
  // prompt says that's fine rather than asking for a finished question.
  placeholder: 'Start with a rough question…',
  // Deliberately not the Data Messenger's "What would you like to know?": that page
  // answers one question at a time, and this one is for the questions it can't -
  // several datasets, several steps, sharpened over a few turns. Without saying so
  // up front, the page reads as a slower version of the tab beside it.
  emptyStateTitle: 'What are you trying to figure out?',
  emptyStateSubtitle:
    'Best for questions that need a few datasets, some calculations on top, or a comparison over time. Start rough and narrow it down from there.',
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
