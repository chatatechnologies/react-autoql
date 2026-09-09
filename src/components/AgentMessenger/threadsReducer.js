import { v4 as uuid } from 'uuid'

import { FALLBACK_MODELS } from './sessionService'

export const NEW_THREAD_TITLE = 'New thread'

export const ThreadStatuses = {
  IDLE: 'idle',
  SENDING: 'sending',
  ERROR: 'error',
}

export const ModelsStatuses = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
}

export const Actions = {
  THREAD_OPEN: 'THREAD_OPEN',
  THREAD_CLOSE: 'THREAD_CLOSE',
  THREAD_ACTIVATE: 'THREAD_ACTIVATE',
  THREAD_MODEL_SET: 'THREAD_MODEL_SET',
  MESSAGE_SENDING: 'MESSAGE_SENDING',
  SESSION_ESTABLISHED: 'SESSION_ESTABLISHED',
  RESPONSE_RECEIVED: 'RESPONSE_RECEIVED',
  REQUEST_FAILED: 'REQUEST_FAILED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  ITEM_REVEALED: 'ITEM_REVEALED',
  MODELS_LOADING: 'MODELS_LOADING',
  MODELS_LOADED: 'MODELS_LOADED',
  MODELS_FAILED: 'MODELS_FAILED',
}

// Kept whole rather than clipped to a fixed length: the tab, pill and menu row all
// ellipsise in CSS to whatever width they have, and the untruncated title is what the
// hover tooltip shows. Clipping here would make that tooltip repeat the same cut-off
// text the tab already shows.
export const getThreadTitle = (text) => {
  const trimmed = `${text ?? ''}`.trim().replace(/\s+/g, ' ')
  return trimmed || NEW_THREAD_TITLE
}

// Untitled threads are numbered so two fresh ones are never called the same thing -
// otherwise opening a second empty thread looks like nothing happened. The number is
// dropped as soon as the first message renames the thread.
export const getUntitledTitle = (existingTitles = []) => {
  if (!existingTitles.includes(NEW_THREAD_TITLE)) {
    return NEW_THREAD_TITLE
  }

  let n = 2
  while (existingTitles.includes(`${NEW_THREAD_TITLE} ${n}`)) {
    n += 1
  }

  return `${NEW_THREAD_TITLE} ${n}`
}

export const createThread = ({ llmModel, title } = {}) => ({
  id: uuid(),
  title: title ?? NEW_THREAD_TITLE,
  sessionId: null,
  llmModel: llmModel ?? FALLBACK_MODELS[0].id,
  messages: [],
  status: ThreadStatuses.IDLE,
  error: null,
  revealedItemIds: {},
})

export const createInitialState = ({ defaultModelId } = {}) => {
  const thread = createThread({ llmModel: defaultModelId })

  return {
    threads: { [thread.id]: thread },
    order: [thread.id],
    activeThreadId: thread.id,
    lastOpenedThreadId: null,
    models: { list: [], status: ModelsStatuses.IDLE },
  }
}

const createMessage = ({ role, items, llmModel }) => ({
  id: uuid(),
  role,
  items: items ?? [],
  llmModel,
  createdAt: Date.now(),
})

// response_items is an ordered, mixed list that may repeat a type, so items are keyed
// by position rather than by type.
const withItemIds = (messageId, responseItems) => {
  return (responseItems ?? []).map((item, index) => ({
    id: `${messageId}-${index}`,
    type: item?.type,
    data: item?.data ?? {},
  }))
}

const updateThread = (state, threadId, updater) => {
  const thread = state.threads[threadId]

  if (!thread) {
    return state
  }

  return {
    ...state,
    threads: { ...state.threads, [threadId]: { ...thread, ...updater(thread) } },
  }
}

const appendMessage = (thread, message, maxMessages) => {
  const messages = [...thread.messages, message]
  return messages.length > maxMessages ? messages.slice(-maxMessages) : messages
}

const closeThread = (state, threadId) => {
  const index = state.order.indexOf(threadId)

  if (index === -1) {
    return state
  }

  const order = state.order.filter((id) => id !== threadId)
  const threads = { ...state.threads }
  const closedThread = threads[threadId]
  delete threads[threadId]

  // Closing the last thread would leave the page blank, so replace it with an empty
  // one that inherits the closed thread's model.
  if (!order.length) {
    const thread = createThread({ llmModel: closedThread?.llmModel })

    return { ...state, threads: { [thread.id]: thread }, order: [thread.id], activeThreadId: thread.id }
  }

  let activeThreadId = state.activeThreadId

  if (activeThreadId === threadId) {
    // Prefer the neighbour to the right, the way browser tabs behave.
    activeThreadId = order[Math.min(index, order.length - 1)]
  }

  return { ...state, threads, order, activeThreadId }
}

export const threadsReducer = (state, action) => {
  switch (action.type) {
    case Actions.THREAD_OPEN: {
      if (action.maxThreads && state.order.length >= action.maxThreads) {
        return state
      }

      // A new thread inherits the model in use so switching isn't repeated work.
      const activeThread = state.threads[state.activeThreadId]
      const thread = createThread({
        llmModel: action.llmModel ?? activeThread?.llmModel,
        title: getUntitledTitle(state.order.map((id) => state.threads[id].title)),
      })

      return {
        ...state,
        threads: { ...state.threads, [thread.id]: thread },
        order: [...state.order, thread.id],
        activeThreadId: thread.id,
        // Lets the UI flag the tab as just-created, so opening one is visible even
        // when the transcript below is empty either way.
        lastOpenedThreadId: thread.id,
      }
    }

    case Actions.THREAD_CLOSE:
      return closeThread(state, action.threadId)

    case Actions.THREAD_ACTIVATE:
      return state.threads[action.threadId] ? { ...state, activeThreadId: action.threadId } : state

    case Actions.THREAD_MODEL_SET:
      return updateThread(state, action.threadId, () => ({ llmModel: action.llmModel }))

    case Actions.MESSAGE_SENDING:
      return updateThread(state, action.threadId, (thread) => {
        const message = createMessage({
          role: 'user',
          items: [{ id: `${action.messageId}-0`, type: 'text', data: { text: action.userInquiry } }],
          llmModel: thread.llmModel,
        })
        message.id = action.messageId

        return {
          status: ThreadStatuses.SENDING,
          error: null,
          title: thread.messages.length ? thread.title : getThreadTitle(action.userInquiry),
          messages: appendMessage(thread, message, action.maxMessages),
          // The user's own text is never typed out - only agent responses are.
          revealedItemIds: { ...thread.revealedItemIds, [`${action.messageId}-0`]: true },
        }
      })

    case Actions.SESSION_ESTABLISHED:
      // Only ever set from a create response. Resume responses carry no session_id,
      // and must not clear the id the thread already has.
      return action.sessionId ? updateThread(state, action.threadId, () => ({ sessionId: action.sessionId })) : state

    case Actions.RESPONSE_RECEIVED:
      return updateThread(state, action.threadId, (thread) => {
        const message = createMessage({ role: 'agent', llmModel: thread.llmModel })
        message.items = withItemIds(message.id, action.responseItems)

        return {
          status: ThreadStatuses.IDLE,
          error: null,
          messages: appendMessage(thread, message, action.maxMessages),
        }
      })

    case Actions.REQUEST_FAILED:
      return updateThread(state, action.threadId, (thread) => {
        const message = createMessage({ role: 'agent', llmModel: thread.llmModel })
        message.items = withItemIds(message.id, [{ type: 'error', data: { text: action.error } }])

        return {
          status: ThreadStatuses.ERROR,
          error: action.error,
          messages: appendMessage(thread, message, action.maxMessages),
        }
      })

    case Actions.REQUEST_CANCELLED:
      return updateThread(state, action.threadId, () => ({ status: ThreadStatuses.IDLE }))

    case Actions.ITEM_REVEALED:
      return updateThread(state, action.threadId, (thread) => ({
        revealedItemIds: { ...thread.revealedItemIds, [action.itemId]: true },
      }))

    case Actions.MODELS_LOADING:
      return { ...state, models: { ...state.models, status: ModelsStatuses.LOADING } }

    case Actions.MODELS_LOADED: {
      const list = action.models ?? []
      const defaultModelId = action.defaultModelId

      // Threads start on a fallback id, which may not be one the server offers. Once
      // the real list lands, move any thread that hasn't sent a message yet onto a
      // valid model instead of letting its first request fail.
      const preferred = list.find((model) => model.id === defaultModelId)?.id ?? list[0]?.id
      let threads = state.threads

      if (preferred) {
        threads = { ...state.threads }
        state.order.forEach((threadId) => {
          const thread = threads[threadId]
          const isUntouched = !thread.messages.length
          const isUnknownModel = !list.some((model) => model.id === thread.llmModel)

          if (isUntouched && isUnknownModel) {
            threads[threadId] = { ...thread, llmModel: preferred }
          }
        })
      }

      return { ...state, threads, models: { list, status: ModelsStatuses.READY } }
    }

    case Actions.MODELS_FAILED:
      return { ...state, models: { list: [], status: ModelsStatuses.ERROR } }

    default:
      return state
  }
}
