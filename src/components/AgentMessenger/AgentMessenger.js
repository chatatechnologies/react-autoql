import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { withTheme } from '../../theme'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { authenticationType, dataFormattingType } from '../../props/types'

import AgentThread from './AgentThread'
import AgentComposer from './AgentComposer'
import { useAgentSession } from './useAgentSession'
import { ThreadStatuses } from './threadsReducer'

import './AgentMessenger.scss'

// An inactive chip is 148px wide plus the 4px gap; below that the strip can't lay
// its tabs out at all and the dropdown is the better control.
const MIN_TAB_WIDTH = 152
// The + button, the track's padding and margins, and the extra 40px the active chip
// takes over an inactive one.
const TOOLBAR_CHROME_WIDTH = 116

/**
 * Session-based messenger. Each thread owns a server session: the first message
 * POSTs /sessions, every message after that POSTs /sessions/{id}/resume. Closing a
 * thread discards it - there is no persistence yet, by design.
 *
 * Threads show as a horizontal tab strip while the drawer is wide enough to give
 * each tab a readable title, and collapse to a single pill + dropdown when it isn't
 * - the drawer goes down to 400px, where a strip of tabs costs more than it earns.
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
  enableMockResponses,
  tooltipID,
  onErrorCallback,
  onSessionCreated,
  onThreadClose,
  shouldRender,
  isActivePage,
  isResizing,
}) => {
  const tooltipIdRef = useRef(tooltipID ?? `react-autoql-agent-messenger-tooltip-${uuid()}`)
  const composerRef = useRef(null)
  // State rather than a ref: the model popover needs this element as its parent, and
  // a ref assignment wouldn't re-render to hand it over.
  const [containerElement, setContainerElement] = useState(null)
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false)
  const [showTabs, setShowTabs] = useState(true)
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

  const onNewThread = useCallback(() => {
    openThread()
    setIsThreadMenuOpen(false)
  }, [openThread])

  const onKeyDown = useCallback(
    (event) => {
      if (!isLaidOut) {
        return
      }

      if (event.key === 'Escape' && isThreadMenuOpen) {
        setIsThreadMenuOpen(false)
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
    [isLaidOut, onNewThread, onCloseThread, activeThread, isThreadMenuOpen],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const onItemRevealed = useCallback(
    (itemId) => {
      if (activeThread) {
        markItemRevealed(activeThread.id, itemId)
      }
    },
    [activeThread, markItemRevealed],
  )

  // "Try again" on an error item re-sends the question that failed.
  const onRetry = useCallback(() => {
    const lastUserMessage = [...(activeThread?.messages ?? [])].reverse().find((message) => message.role === 'user')
    const text = lastUserMessage?.items?.[0]?.data?.text

    if (text) {
      onSubmit(text)
    }
  }, [activeThread, onSubmit])

  // Tabs while they fit, dropdown once they don't. Deciding from the container width
  // and a per-tab minimum keeps this a pure calculation - measuring rendered tabs
  // would mean the strip has to exist to know whether the strip can exist.
  useEffect(() => {
    const element = containerElement
    if (!element) {
      return undefined
    }

    const measure = () => {
      const width = element.clientWidth
      if (!width) {
        return
      }

      setShowTabs(width >= threads.length * MIN_TAB_WIDTH + TOOLBAR_CHROME_WIDTH)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [containerElement, threads.length])

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
        {/* With tabs showing, the toolbar itself is the Data Messenger session
            track - a rounded strip the chips sit on. Collapsed it is a plain row
            holding the pill, so the track styling only applies in tab mode. */}
        <div className={`react-autoql-agent-toolbar${showTabs ? ' has-tabs' : ''}`}>
          {showTabs ? (
            <div className='react-autoql-agent-tabs' role='tablist'>
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
          ) : (
            <button
              className={`react-autoql-agent-thread-pill${isThreadMenuOpen ? ' is-open' : ''}${
                justOpenedId ? ' is-new' : ''
              }`}
              onClick={() => setIsThreadMenuOpen((open) => !open)}
              aria-haspopup='menu'
              aria-expanded={isThreadMenuOpen}
            >
              <span className='react-autoql-agent-thread-dot' />
              <span
                className='react-autoql-agent-thread-pill-title'
                data-tooltip-content={activeThread?.title}
                data-tooltip-id={tooltipIdRef.current}
              >
                {activeThread?.title}
              </span>
              <Icon type={isThreadMenuOpen ? 'caret-up' : 'caret-down'} className='react-autoql-agent-thread-caret' />
            </button>
          )}
          <div className='react-autoql-agent-toolbar-right'>
            {!showTabs && <span className='react-autoql-agent-thread-count'>{threads.length}</span>}
            <button
              className={`react-autoql-agent-icon-btn${showTabs ? ' react-autoql-agent-tab-new' : ''}`}
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
          {isThreadMenuOpen && (
            <>
              <div className='react-autoql-agent-menu-scrim' onClick={() => setIsThreadMenuOpen(false)} />
              <div className='react-autoql-agent-thread-menu' role='menu'>
                <div className='react-autoql-agent-menu-label'>Threads</div>
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    role='menuitem'
                    tabIndex={0}
                    className={`react-autoql-agent-menu-row${thread.id === activeThread?.id ? ' is-active' : ''}`}
                    onClick={() => {
                      activateThread(thread.id)
                      setIsThreadMenuOpen(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        activateThread(thread.id)
                        setIsThreadMenuOpen(false)
                      }
                    }}
                  >
                    <span className='react-autoql-agent-thread-dot' />
                    <span
                      className='react-autoql-agent-menu-row-title'
                      data-tooltip-content={thread.title}
                      data-tooltip-id={tooltipIdRef.current}
                    >
                      {thread.title}
                    </span>
                    {/* Same rule as the tabs: nothing to close on the last thread
                        while it's still empty. */}
                    {(threads.length > 1 || !!thread.messages.length) && (
                      <button
                        className='react-autoql-agent-menu-row-close'
                        aria-label={`Close ${thread.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onCloseThread(thread.id)
                        }}
                      >
                        <Icon type='close' />
                      </button>
                    )}
                  </div>
                ))}
                <div className='react-autoql-agent-menu-divider' />
                <div
                  role='menuitem'
                  tabIndex={0}
                  className='react-autoql-agent-menu-row is-new'
                  onClick={onNewThread}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      onNewThread()
                    }
                  }}
                >
                  <Icon type='plus' />
                  <span>New thread</span>
                </div>
              </div>
            </>
          )}

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
              emptyStateTitle={emptyStateTitle}
              emptyStateSubtitle={emptyStateSubtitle}
              suggestions={suggestions}
              onSuggestionClick={onSubmit}
              onItemRevealed={onItemRevealed}
              onRetry={onRetry}
              getModelLabel={getModelLabel}
            />
          ))}
        </div>

        <AgentComposer
          ref={composerRef}
          authentication={authentication}
          placeholder={placeholder}
          isSending={isSending}
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
  // Serves the captured session payloads instead of calling the API - the /sessions
  // endpoints aren't live yet. Development only; never leave it on in production.
  enableMockResponses: PropTypes.bool,
  tooltipID: PropTypes.string,
  onErrorCallback: PropTypes.func,
  onSessionCreated: PropTypes.func,
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
  enableMockResponses: false,
  tooltipID: undefined,
  onErrorCallback: undefined,
  onSessionCreated: undefined,
  onThreadClose: undefined,
  shouldRender: true,
  isActivePage: undefined,
  isResizing: false,
}

export default withTheme(AgentMessenger)
