import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import { getAuthentication } from 'autoql-fe-utils'

import { createSession, resumeSession, fetchModels, isCancelError, FALLBACK_MODELS } from './sessionService'
import { getMockSessionResponse } from './mockSessionResponses'
import { Actions, createInitialState, threadsReducer } from './threadsReducer'

// Long enough for the thinking indicator to be visible, short enough not to annoy.
const MOCK_LATENCY_MS = 900

/**
 * Stands in for an axios cancel source so mock mode goes through exactly the same
 * cancel path as a real request: the stop button and closing a thread both just call
 * cancel() on whatever the thread has in flight.
 */
const createMockRequest = (value, delay) => {
  let timer = null
  let cancelled = false

  return {
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
    },
    promise: new Promise((resolve, reject) => {
      timer = setTimeout(() => (cancelled ? reject({ isCancelled: true }) : resolve(value)), delay)
    }),
  }
}

/**
 * Owns the thread store, the create/resume request cycle and the one-time model
 * fetch. Kept out of the components so the state machine can be tested on its own.
 */
export const useAgentSession = ({
  authentication,
  models: modelsProp,
  modelsEndpoint,
  defaultModelId,
  maxThreads,
  maxMessagesPerThread,
  enableMockResponses,
  onSessionCreated,
  onErrorCallback,
}) => {
  const [state, dispatch] = useReducer(threadsReducer, { defaultModelId }, createInitialState)

  const mountedRef = useRef(true)
  // One cancel source per thread: sending again, or closing the thread, aborts the
  // request that thread already has in flight.
  const cancelSourcesRef = useRef({})

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      Object.values(cancelSourcesRef.current).forEach((source) => source?.cancel?.())
      cancelSourcesRef.current = {}
    }
  }, [])

  const cancelThreadRequest = useCallback((threadId) => {
    cancelSourcesRef.current[threadId]?.cancel?.()
    delete cancelSourcesRef.current[threadId]
  }, [])

  const submit = useCallback(
    (threadId, userInquiry) => {
      const text = `${userInquiry ?? ''}`.trim()
      const thread = state.threads[threadId]

      if (!text || !thread || thread.status === 'sending') {
        return
      }

      cancelThreadRequest(threadId)

      dispatch({
        type: Actions.MESSAGE_SENDING,
        threadId,
        userInquiry: text,
        messageId: uuid(),
        maxMessages: maxMessagesPerThread,
      })

      let source
      let request

      if (enableMockResponses) {
        // No network at all: the /sessions endpoints aren't live yet, so the captured
        // payloads stand in - create for the thread's first message, resume after.
        const mock = createMockRequest(getMockSessionResponse(!thread.sessionId), MOCK_LATENCY_MS)
        source = mock
        request = mock.promise
      } else {
        source = axios.CancelToken?.source()

        const params = {
          userInquiry: text,
          authentication,
          cancelToken: source?.token,
        }

        request = thread.sessionId ? resumeSession({ ...params, sessionId: thread.sessionId }) : createSession(params)
      }

      cancelSourcesRef.current[threadId] = source

      request
        .then(({ sessionId, responseItems }) => {
          if (!mountedRef.current || cancelSourcesRef.current[threadId] !== source) {
            return
          }

          delete cancelSourcesRef.current[threadId]

          if (sessionId) {
            dispatch({ type: Actions.SESSION_ESTABLISHED, threadId, sessionId })
            onSessionCreated?.(sessionId)
          }

          dispatch({
            type: Actions.RESPONSE_RECEIVED,
            threadId,
            responseItems,
            maxMessages: maxMessagesPerThread,
          })
        })
        .catch((error) => {
          if (!mountedRef.current) {
            return
          }

          // A cancel is either the user sending again or closing the thread - neither
          // is an error worth showing.
          if (error?.isCancelled || isCancelError(error)) {
            dispatch({ type: Actions.REQUEST_CANCELLED, threadId })
            return
          }

          if (cancelSourcesRef.current[threadId] !== source) {
            return
          }

          delete cancelSourcesRef.current[threadId]

          // A conversational reply - the ended session included - is shown in the
          // transcript as the agent speaking, so firing onErrorCallback too would put
          // the same sentence in the integrator's error toast right beside it.
          if (!error?.isConversational && !error?.isSessionExpired) {
            onErrorCallback?.(error)
          }

          dispatch({
            type: Actions.REQUEST_FAILED,
            threadId,
            error: error?.message,
            isConversational: error?.isConversational,
            isSessionExpired: error?.isSessionExpired,
            maxMessages: maxMessagesPerThread,
          })
        })
    },
    [
      state.threads,
      authentication,
      maxMessagesPerThread,
      enableMockResponses,
      cancelThreadRequest,
      onSessionCreated,
      onErrorCallback,
    ],
  )

  const openThread = useCallback(() => dispatch({ type: Actions.THREAD_OPEN, maxThreads }), [maxThreads])

  const closeThread = useCallback(
    (threadId) => {
      cancelThreadRequest(threadId)
      dispatch({ type: Actions.THREAD_CLOSE, threadId })
    },
    [cancelThreadRequest],
  )

  const activateThread = useCallback((threadId) => dispatch({ type: Actions.THREAD_ACTIVATE, threadId }), [])

  const setThreadModel = useCallback(
    (threadId, llmModel) => dispatch({ type: Actions.THREAD_MODEL_SET, threadId, llmModel }),
    [],
  )

  const markItemRevealed = useCallback(
    (threadId, itemId) => dispatch({ type: Actions.ITEM_REVEALED, threadId, itemId }),
    [],
  )

  // The models prop bypasses the fetch entirely; otherwise fetch once, and again if
  // the integrator swaps credentials on us. Depending on the flattened credentials
  // rather than the object keeps a new-but-equal prop from refetching every render.
  const authKey = useMemo(() => {
    const { domain, apiKey, token } = getAuthentication(authentication)
    return `${domain}|${apiKey}|${token}`
  }, [authentication])

  const authRef = useRef(authentication)
  authRef.current = authentication

  useEffect(() => {
    if (modelsProp?.length) {
      dispatch({ type: Actions.MODELS_LOADED, models: modelsProp, defaultModelId })
      return
    }

    // Mock mode makes no requests, so don't call an endpoint that isn't live either.
    if (enableMockResponses) {
      dispatch({ type: Actions.MODELS_LOADED, models: FALLBACK_MODELS, defaultModelId })
      return
    }

    const source = axios.CancelToken?.source()
    dispatch({ type: Actions.MODELS_LOADING })

    fetchModels({ authentication: authRef.current, endpoint: modelsEndpoint, cancelToken: source?.token })
      .then((models) => {
        if (!mountedRef.current) {
          return
        }

        // An empty list is treated the same as no endpoint: fall back rather than
        // leaving the picker with nothing to show.
        dispatch({ type: Actions.MODELS_LOADED, models: models?.length ? models : FALLBACK_MODELS, defaultModelId })
      })
      .catch((error) => {
        if (!mountedRef.current || error?.isCancelled) {
          return
        }

        // A missing models endpoint must not block the chat, and must not make the
        // picker vanish either - fall back to the built-in list.
        dispatch({ type: Actions.MODELS_LOADED, models: FALLBACK_MODELS, defaultModelId })
      })

    return () => source?.cancel?.()
  }, [modelsProp, modelsEndpoint, defaultModelId, authKey, enableMockResponses])

  const activeThread = state.threads[state.activeThreadId]

  return {
    state,
    activeThread,
    lastOpenedThreadId: state.lastOpenedThreadId,
    threads: state.order.map((id) => state.threads[id]),
    models: state.models,
    fallbackModelId: FALLBACK_MODELS[0].id,
    submit,
    openThread,
    closeThread,
    activateThread,
    setThreadModel,
    cancelThreadRequest,
    markItemRevealed,
  }
}
