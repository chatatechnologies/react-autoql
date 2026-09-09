import { Actions, ModelsStatuses, ThreadStatuses, createInitialState, threadsReducer } from './threadsReducer'

const send = (state, threadId, text, maxMessages = 200) =>
  threadsReducer(state, {
    type: Actions.MESSAGE_SENDING,
    threadId,
    userInquiry: text,
    messageId: `msg-${text}`,
    maxMessages,
  })

describe('threadsReducer', () => {
  it('starts with a single active empty thread', () => {
    const state = createInitialState({})

    expect(state.order).toHaveLength(1)
    expect(state.activeThreadId).toBe(state.order[0])
    expect(state.threads[state.activeThreadId].messages).toHaveLength(0)
  })

  describe('threads', () => {
    it("opens a thread that inherits the active thread's model and becomes active", () => {
      let state = createInitialState({ defaultModelId: 'gpt-4.1' })
      state = threadsReducer(state, {
        type: Actions.THREAD_MODEL_SET,
        threadId: state.activeThreadId,
        llmModel: 'gpt-5',
      })
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 8 })

      expect(state.order).toHaveLength(2)
      expect(state.activeThreadId).toBe(state.order[1])
      expect(state.threads[state.activeThreadId].llmModel).toBe('gpt-5')
    })

    it('refuses to open past maxThreads', () => {
      let state = createInitialState({})
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 1 })

      expect(state.order).toHaveLength(1)
    })

    it('activates the neighbour to the right when the active thread is closed', () => {
      let state = createInitialState({})
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 8 })
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 8 })

      const [first, second, third] = state.order
      state = threadsReducer(state, { type: Actions.THREAD_ACTIVATE, threadId: second })
      state = threadsReducer(state, { type: Actions.THREAD_CLOSE, threadId: second })

      expect(state.order).toEqual([first, third])
      expect(state.activeThreadId).toBe(third)
      expect(state.threads[second]).toBeUndefined()
    })

    it('falls back to the thread on the left when the last one is closed', () => {
      let state = createInitialState({})
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 8 })

      const [first, second] = state.order
      state = threadsReducer(state, { type: Actions.THREAD_CLOSE, threadId: second })

      expect(state.activeThreadId).toBe(first)
    })

    it('replaces the final thread with a fresh one so the page is never blank', () => {
      let state = createInitialState({})
      const [only] = state.order
      state = threadsReducer(state, { type: Actions.THREAD_CLOSE, threadId: only })

      expect(state.order).toHaveLength(1)
      expect(state.order[0]).not.toBe(only)
      expect(state.threads[state.order[0]].messages).toHaveLength(0)
    })
  })

  describe('messages', () => {
    it('titles the thread from the first message only', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = send(state, threadId, 'How did the Eagles do against the spread?')
      const title = state.threads[threadId].title
      // Stored whole - the tab ellipsises in CSS and the tooltip needs the full text.
      expect(title).toBe('How did the Eagles do against the spread?')

      state = threadsReducer(state, { type: Actions.RESPONSE_RECEIVED, threadId, responseItems: [], maxMessages: 200 })
      state = send(state, threadId, 'And the season before?')

      expect(state.threads[threadId].title).toBe(title)
    })

    it('keeps the session id when a resume response carries none', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = threadsReducer(state, { type: Actions.SESSION_ESTABLISHED, threadId, sessionId: 'abc-123' })
      state = threadsReducer(state, { type: Actions.SESSION_ESTABLISHED, threadId, sessionId: null })

      expect(state.threads[threadId].sessionId).toBe('abc-123')
    })

    it('gives each response item a stable id in order', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = threadsReducer(state, {
        type: Actions.RESPONSE_RECEIVED,
        threadId,
        responseItems: [
          { type: 'table', data: {} },
          { type: 'text', data: { text: 'hi' } },
        ],
        maxMessages: 200,
      })

      const [message] = state.threads[threadId].messages
      expect(message.items.map((item) => item.type)).toEqual(['table', 'text'])
      expect(message.items[0].id).toBe(`${message.id}-0`)
      expect(message.items[1].id).toBe(`${message.id}-1`)
    })

    it('renders a failure as an error item on the same message path', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = threadsReducer(state, { type: Actions.REQUEST_FAILED, threadId, error: 'Oops', maxMessages: 200 })

      const [message] = state.threads[threadId].messages
      expect(state.threads[threadId].status).toBe(ThreadStatuses.ERROR)
      expect(message.items[0]).toMatchObject({ type: 'error', data: { text: 'Oops' } })
    })

    it('trims the oldest messages past maxMessagesPerThread', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = send(state, threadId, 'one', 2)
      state = send(state, threadId, 'two', 2)
      state = send(state, threadId, 'three', 2)

      const texts = state.threads[threadId].messages.map((message) => message.items[0].data.text)
      expect(texts).toEqual(['two', 'three'])
    })
  })

  describe('models', () => {
    it('moves untouched threads onto a real model once the list loads', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId

      state = threadsReducer(state, {
        type: Actions.MODELS_LOADED,
        models: [{ id: 'gpt-5', label: 'GPT-5' }],
        defaultModelId: 'gpt-5',
      })

      expect(state.models.status).toBe(ModelsStatuses.READY)
      expect(state.threads[threadId].llmModel).toBe('gpt-5')
    })

    it('leaves a thread that already has messages on its own model', () => {
      let state = createInitialState({})
      const threadId = state.activeThreadId
      const original = state.threads[threadId].llmModel

      state = send(state, threadId, 'hello')
      state = threadsReducer(state, {
        type: Actions.MODELS_LOADED,
        models: [{ id: 'gpt-5', label: 'GPT-5' }],
        defaultModelId: 'gpt-5',
      })

      expect(state.threads[threadId].llmModel).toBe(original)
    })

    it('changes the model for one thread only', () => {
      let state = createInitialState({})
      state = threadsReducer(state, { type: Actions.THREAD_OPEN, maxThreads: 8 })

      const [first, second] = state.order
      const firstModel = state.threads[first].llmModel
      state = threadsReducer(state, { type: Actions.THREAD_MODEL_SET, threadId: second, llmModel: 'gpt-5' })

      expect(state.threads[second].llmModel).toBe('gpt-5')
      expect(state.threads[first].llmModel).toBe(firstModel)
    })
  })
})
