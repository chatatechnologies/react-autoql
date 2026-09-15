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
      llm_model: 'gpt-4.1',
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

    it('sends the selected model with the request', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      renderMessenger({
        models: [
          { id: 'gpt-4.1', label: 'GPT-4.1' },
          { id: 'gpt-5', label: 'GPT-5' },
        ],
        defaultModelId: 'gpt-5',
      })

      await sendMessage('Which model is this?')

      expect(axios.post.mock.calls[0][1].llm_model).toBe('gpt-5')
    })
  })
})
