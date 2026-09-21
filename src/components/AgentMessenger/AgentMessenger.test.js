import React from 'react'
import axios from 'axios'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
// This repo's jest setup doesn't register jest-dom globally, so pull in the matchers here.
import '@testing-library/jest-dom'

import { testAuthentication } from '../../../test/testData'
import {
  MOCK_CREATE_SESSION_RESPONSE as createSessionResponse,
  MOCK_RESUME_SESSION_RESPONSE as resumeSessionResponse,
} from './mockSessionResponses'
import { AgentMessenger } from './index'

jest.mock('axios')

// Captured API payloads, used verbatim: create carries a session_id and a single text
// item, resume carries no session_id and a 22-column table followed by text.
const CREATE_RESPONSE = { data: createSessionResponse }
const RESUME_RESPONSE = { data: resumeSessionResponse }
const CREATE_TEXT = /To make the comparison precise/
const RESUME_TEXT = /game-level offensive team statistics/

const renderMessenger = (props) =>
  render(
    <AgentMessenger
      authentication={testAuthentication}
      models={[{ id: 'gpt-4.1', label: 'GPT-4.1' }]}
      enableTypewriter={false}
      {...props}
    />,
  )

const sendMessage = async (text) => {
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: text } })

  await act(async () => {
    fireEvent.click(screen.getByLabelText('Send message'))
  })
}

describe('AgentMessenger', () => {
  beforeEach(() => {
    axios.CancelToken = { source: () => ({ token: 'token', cancel: jest.fn() }) }
    axios.isCancel = () => false
    axios.get.mockResolvedValue({ data: [] })
  })

  afterEach(() => jest.clearAllMocks())

  it('renders the empty state with a single thread', () => {
    renderMessenger({ emptyStateTitle: 'What would you like to know?' })

    expect(screen.getByText('What would you like to know?')).toBeInTheDocument()
    expect(screen.getByText('New thread')).toBeInTheDocument()
  })

  it('creates a session on the first message and resumes it after that', async () => {
    axios.post.mockResolvedValueOnce(CREATE_RESPONSE).mockResolvedValueOnce(RESUME_RESPONSE)

    renderMessenger()

    await sendMessage('How did the Eagles do?')
    await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())

    expect(axios.post.mock.calls[0][0]).toContain('/autoql/api/v1/sessions')
    expect(axios.post.mock.calls[0][0]).not.toContain('/resume')
    expect(axios.post.mock.calls[0][1]).toEqual({
      user_inquiry: 'How did the Eagles do?',
    })

    await sendMessage('Compare it to last season')

    await waitFor(() =>
      expect(axios.post.mock.calls[1][0]).toContain(
        '/autoql/api/v1/sessions/efe31e82-4e81-4b07-8d58-06fbc6557296/resume',
      ),
    )
  })

  it('renders a table-then-text response in the order the API sent it', async () => {
    axios.post.mockResolvedValueOnce({
      data: { session_id: 'abc-123', response_items: resumeSessionResponse.response_items },
    })

    const { container } = renderMessenger()
    await sendMessage('Show me the games')

    await waitFor(() => expect(screen.getByText(RESUME_TEXT)).toBeInTheDocument())

    const items = container.querySelectorAll('.react-autoql-agent-item')
    expect(items[0].querySelector('.react-autoql-agent-table-item')).toBeTruthy()
    expect(items[1].querySelector('.react-autoql-agent-text-item')).toBeTruthy()
  })

  it('falls back to a status item for an unrecognized response type', async () => {
    axios.post.mockResolvedValueOnce({
      data: { session_id: 'abc-123', response_items: [{ type: 'hologram', data: {} }] },
    })

    renderMessenger()
    await sendMessage('Surprise me')

    await waitFor(() =>
      expect(screen.getByText("This response type isn't supported in the messenger yet.")).toBeInTheDocument(),
    )
  })

  it('shows a failed request as an error item rather than an empty message', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server exploded' } } })

    renderMessenger()
    await sendMessage('Break it')

    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument())
  })

  it('speaks a `detail` message as the agent rather than boxing it as an error', async () => {
    const detail = 'Session has already completed and cannot accept further messages.'
    axios.post.mockRejectedValueOnce({ response: { status: 400, data: { detail } } })

    const { container } = renderMessenger()
    await sendMessage('Carry on')

    await waitFor(() => expect(screen.getByText(detail)).toBeInTheDocument())
    expect(container.querySelector('.react-autoql-agent-status-item.is-error')).toBeNull()
    expect(container.querySelector('.react-autoql-agent-text-item')).toBeTruthy()
  })

  it('parks an unsent draft with the thread it was typed in', () => {
    renderMessenger()

    const input = () => screen.getByRole('textbox')
    fireEvent.change(input(), { target: { value: 'half a question' } })

    fireEvent.click(screen.getByLabelText('New thread'))
    expect(input().value).toBe('')

    fireEvent.change(input(), { target: { value: 'a different question' } })

    fireEvent.click(screen.getAllByRole('tab')[0])
    expect(input().value).toBe('half a question')

    fireEvent.click(screen.getAllByRole('tab')[1])
    expect(input().value).toBe('a different question')
  })

  describe('closing every thread', () => {
    const openThread = () => fireEvent.click(screen.getByLabelText('New thread'))

    it('offers the button only once there is more than one thread', () => {
      renderMessenger()
      expect(screen.queryByLabelText('Close all threads')).toBeNull()

      openThread()
      expect(screen.getByLabelText('Close all threads')).toBeInTheDocument()
    })

    it('leaves a single empty thread once confirmed, and reports each one closed', async () => {
      const onThreadClose = jest.fn()
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger({ onThreadClose })
      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())

      openThread()
      expect(screen.getAllByRole('tab')).toHaveLength(2)

      fireEvent.click(screen.getByLabelText('Close all threads'))
      fireEvent.click(screen.getByText('Close all'))

      expect(screen.getAllByRole('tab')).toHaveLength(1)
      expect(screen.getByText('New thread')).toBeInTheDocument()
      expect(screen.queryByText(CREATE_TEXT)).toBeNull()
      expect(onThreadClose).toHaveBeenCalledTimes(2)
    })

    it('keeps the threads when the confirmation is cancelled', () => {
      renderMessenger()
      openThread()

      fireEvent.click(screen.getByLabelText('Close all threads'))
      fireEvent.click(screen.getByText('Cancel'))

      expect(screen.getAllByRole('tab')).toHaveLength(2)
    })
  })

  describe('session meta_data', () => {
    const completedResponse = (text = 'In short, they scored more.') => ({
      data: {
        session_id: 'abc-123',
        meta_data: { phase: 'summary', session_status: 'completed' },
        response_items: [{ type: 'text', data: { text } }],
      },
    })

    it('labels a response with the phase it came back on', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          session_id: 'abc-123',
          meta_data: { phase: 'planning', session_status: 'inprogress' },
          response_items: [{ type: 'text', data: { text: 'Which season?' } }],
        },
      })

      renderMessenger()
      await sendMessage('How did the Eagles do?')

      await waitFor(() => expect(screen.getByText('Planning')).toBeInTheDocument())
      // An open session leaves the composer alone.
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('takes the composer away and offers a new conversation once the session completes', async () => {
      axios.post.mockResolvedValueOnce(completedResponse())

      renderMessenger()
      await sendMessage('How did the Eagles do?')

      await waitFor(() => expect(screen.getByText('In short, they scored more.')).toBeInTheDocument())

      // The point of reading session_status: they find out before typing, not after.
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText('This conversation has ended. Start a new one to keep going.')).toBeInTheDocument()
      expect(screen.getByText('Start a new conversation')).toBeInTheDocument()
    })

    it('opens an empty thread from a completed session, since the question was answered', async () => {
      axios.post.mockResolvedValueOnce(completedResponse())

      renderMessenger()
      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText('Start a new conversation')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Start a new conversation'))

      expect(screen.getAllByRole('tab')).toHaveLength(2)
      // Nothing carried over - unlike an expired session, this question got its answer.
      expect(screen.getByRole('textbox')).toHaveValue('')
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('leaves the composer alone on a session status it does not recognize', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          session_id: 'abc-123',
          meta_data: { phase: 'data', session_status: 'paused_for_review' },
          response_items: [{ type: 'text', data: { text: 'Here are the games.' } }],
        },
      })

      renderMessenger()
      await sendMessage('Show me the games')

      await waitFor(() => expect(screen.getByText('Here are the games.')).toBeInTheDocument())
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('when the session has ended', () => {
    const SESSION_ENDED = 'Session has already completed and cannot accept further messages.'

    // Establishes a session, then 409s the follow-up.
    const reachEndedSession = async (props) => {
      axios.post
        .mockResolvedValueOnce(CREATE_RESPONSE)
        .mockRejectedValueOnce({ response: { status: 409, data: { detail: SESSION_ENDED } } })

      const rendered = renderMessenger(props)

      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())

      await sendMessage('Compare it to last season')
      await waitFor(() => expect(screen.getByText(SESSION_ENDED)).toBeInTheDocument())

      return rendered
    }

    it('speaks the message and offers a new conversation, without retrying', async () => {
      const onErrorCallback = jest.fn()
      const { container } = await reachEndedSession({ onErrorCallback })

      expect(container.querySelector('.react-autoql-agent-status-item.is-error')).toBeNull()
      expect(screen.getByText('Start a new conversation')).toBeInTheDocument()

      // Nothing is re-sent behind the user's back: the follow-up may not survive the
      // move to a session with no history, so it's theirs to decide.
      expect(axios.post).toHaveBeenCalledTimes(2)
      expect(onErrorCallback).not.toHaveBeenCalled()
    })

    it('opens a new thread with the question waiting in the composer', async () => {
      await reachEndedSession()

      fireEvent.click(screen.getByText('Start a new conversation'))

      expect(screen.getAllByRole('tab')).toHaveLength(2)
      // Drafted, not sent - they get to reword it for a session with no history.
      expect(screen.getByRole('textbox')).toHaveValue('Compare it to last season')
      expect(axios.post).toHaveBeenCalledTimes(2)

      // The dead thread is still there to refer back to while they edit.
      expect(screen.getByText(SESSION_ENDED)).toBeInTheDocument()
    })

    it('withholds the offer when every thread slot is taken', async () => {
      await reachEndedSession({ maxThreads: 1 })

      expect(screen.getByText(SESSION_ENDED)).toBeInTheDocument()
      expect(screen.queryByText('Start a new conversation')).not.toBeInTheDocument()
    })
  })

  describe('threads', () => {
    // jsdom reports a zero-width container, so the toolbar renders its horizontal
    // tab strip (the dropdown is the narrow-drawer fallback).
    const threadRowCount = () => screen.getAllByRole('tab').length

    it('opens a new thread with its own empty transcript', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())

      fireEvent.click(screen.getByLabelText('New thread'))

      expect(threadRowCount()).toBe(2)
      // The first thread stays mounted (hidden), so its text is still in the DOM.
      expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument()
    })

    it('gives each thread its own session, so the second message creates rather than resumes', async () => {
      axios.post.mockResolvedValue(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('First thread question')

      fireEvent.click(screen.getByLabelText('New thread'))
      await sendMessage('Second thread question')

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2))
      expect(axios.post.mock.calls[1][0]).not.toContain('/resume')
    })

    it('discards a closed thread and leaves a fresh one when it was the last', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())

      const tab = screen.getAllByRole('tab')[0]
      fireEvent.click(screen.getByLabelText(`Close ${tab.textContent}`))

      expect(screen.queryByText(CREATE_TEXT)).not.toBeInTheDocument()
      expect(screen.getAllByRole('tab')).toHaveLength(1)
      expect(document.querySelector('.react-autoql-agent-tab-title').textContent).toBe('New thread')
    })

    it('numbers untitled threads so two fresh ones are distinguishable', () => {
      renderMessenger()

      fireEvent.click(screen.getByLabelText('New thread'))
      fireEvent.click(screen.getByLabelText('New thread'))

      const titles = screen.getAllByRole('tab').map((tab) => tab.textContent)
      expect(titles).toEqual(['New thread', 'New thread 2', 'New thread 3'])
    })

    it('exposes the full title for hover, since long ones are ellipsised', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)
      const question = 'How did the Eagles do against the spread this season?'

      renderMessenger()
      await sendMessage(question)

      // The visible text is clipped by CSS (which jsdom doesn't apply), so what
      // matters here is that the untruncated title reaches the tooltip anchor.
      const title = document.querySelector('.react-autoql-agent-tab-title')
      expect(title.getAttribute('data-tooltip-content')).toBe(question)
      expect(title.getAttribute('data-tooltip-id')).toBeTruthy()
    })

    it('names a thread after the first question asked in it', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('How did the Eagles do?')

      expect(screen.getAllByRole('tab')[0].textContent).toContain('How did the Eagles do?')
    })

    it('offers a retry on a failed request that re-sends the question', async () => {
      axios.post
        .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server exploded' } } })
        .mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())

      await act(async () => {
        fireEvent.click(screen.getByText('Try again'))
      })

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2))
      expect(axios.post.mock.calls[1][1].user_inquiry).toBe('How did the Eagles do?')
    })
  })

  describe('mock mode', () => {
    it('serves the captured payloads without touching the network', async () => {
      renderMessenger({ enableMockResponses: true })

      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument(), { timeout: 3000 })

      expect(axios.post).not.toHaveBeenCalled()
      expect(axios.get).not.toHaveBeenCalled()
    })

    it('follows the create payload with the resume payload on the next turn', async () => {
      renderMessenger({ enableMockResponses: true })

      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument(), { timeout: 3000 })

      await sendMessage('Show me the game-level stats')
      await waitFor(() => expect(screen.getByText(RESUME_TEXT)).toBeInTheDocument(), { timeout: 3000 })

      // The resume payload's table, rendered through SimpleTable.
      expect(document.querySelector('.react-autoql-agent-table-item')).toBeTruthy()
      expect(screen.getByText('17 rows · 22 cols')).toBeInTheDocument()
    })

    it('returns the composer to the user when the mock request is stopped', async () => {
      renderMessenger({ enableMockResponses: true })

      await sendMessage('How did the Eagles do?')

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Stop generating'))
      })

      // Stop has to settle the in-flight mock, not just drop its timer - otherwise the
      // thread stays in "sending" and the composer never comes back.
      await waitFor(() => expect(screen.getByLabelText('Send message')).toBeInTheDocument())
      expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument()
    })
  })

  describe('message history', () => {
    beforeEach(() => localStorage.clear())

    it('recalls sent messages with the arrow keys, newest first', async () => {
      axios.post.mockResolvedValue(CREATE_RESPONSE)

      renderMessenger()
      await sendMessage('First question')
      await sendMessage('Second question')

      const input = screen.getByRole('textbox')
      expect(input.value).toBe('')

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input.value).toBe('Second question')

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input.value).toBe('First question')

      // Past the oldest, the input holds where it is.
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input.value).toBe('First question')

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.value).toBe('Second question')

      // Back past the newest is the empty draft again.
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.value).toBe('')
    })
  })

  describe('model selection', () => {
    // The picker is turned off for now - the model is still chosen and sent, it
    // just isn't shown under the composer.
    it('does not show the picker', async () => {
      renderMessenger()

      await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
      expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
    })

    it('does not send a model with the request', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger({
        models: [
          { id: 'gpt-4.1', label: 'GPT-4.1' },
          { id: 'gpt-5', label: 'GPT-5' },
        ],
        defaultModelId: 'gpt-5',
      })

      await sendMessage('Which model is this?')

      expect(axios.post.mock.calls[0][1]).not.toHaveProperty('llm_model')
    })
  })

  describe('debug session id', () => {
    const SESSION_ID = 'efe31e82-4e81-4b07-8d58-06fbc6557296'

    it('stays hidden with debug off', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      // Passed explicitly: the default is temporarily true while this is being tested.
      renderMessenger({ debug: false })
      await sendMessage('How did the Eagles do?')

      await waitFor(() => expect(screen.getByText(CREATE_TEXT)).toBeInTheDocument())
      expect(screen.queryByText(SESSION_ID)).not.toBeInTheDocument()
    })

    it('shows the session id once the session exists, and copies it', async () => {
      const writeText = jest.fn().mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger({ debug: true })

      // Nothing to show until the server has handed back a session.
      expect(screen.queryByText(SESSION_ID)).not.toBeInTheDocument()

      await sendMessage('How did the Eagles do?')
      await waitFor(() => expect(screen.getByText(SESSION_ID)).toBeInTheDocument())

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Copy session ID'))
      })

      expect(writeText).toHaveBeenCalledWith(SESSION_ID)
      expect(screen.getByLabelText('Session ID copied')).toBeInTheDocument()
    })
  })
})
