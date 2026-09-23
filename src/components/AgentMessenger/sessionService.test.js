import axios from 'axios'
import { GENERAL_QUERY_ERROR, UNAUTHENTICATED_ERROR } from 'autoql-fe-utils'

import {
  MOCK_CREATE_SESSION_RESPONSE as createSessionResponse,
  MOCK_RESUME_SESSION_RESPONSE as resumeSessionResponse,
} from './mockSessionResponses'
import { createSession, resumeSession, fetchModels, normalizeModels } from './sessionService'

jest.mock('axios')

const authentication = { domain: 'https://example.com', apiKey: 'test-key', token: 'test-token' }

// The exact payloads the API returns, loaded from the captured fixtures so these
// assertions track the real contract rather than a paraphrase of it.
const CREATE_RESPONSE = { data: createSessionResponse }
const RESUME_RESPONSE = { data: resumeSessionResponse }

describe('sessionService', () => {
  afterEach(() => jest.clearAllMocks())

  describe('createSession', () => {
    it('posts { user_inquiry } to the sessions endpoint with auth', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      await createSession({ userInquiry: 'How did the Eagles do?', llmModel: 'gpt-4.1', authentication })

      const [url, body, config] = axios.post.mock.calls[0]
      expect(url).toBe('https://example.com/autoql/api/v1/sessions?key=test-key')
      expect(body).toEqual({ user_inquiry: 'How did the Eagles do?' })
      expect(config.headers.Authorization).toBe('Bearer test-token')
    })

    it('returns the session id and response items', async () => {
      axios.post.mockResolvedValueOnce(CREATE_RESPONSE)

      const result = await createSession({ userInquiry: 'hi', llmModel: 'gpt-4.1', authentication })

      expect(result.sessionId).toBe('efe31e82-4e81-4b07-8d58-06fbc6557296')
      expect(result.responseItems).toHaveLength(1)
      expect(result.responseItems[0].type).toBe('text')
    })

    it('surfaces the server message and status on a 500', async () => {
      const serverError = new Error('Request failed with status code 500')
      serverError.response = { status: 500, data: { message: 'Internal Service Error' } }
      axios.post.mockRejectedValueOnce(serverError)

      await expect(createSession({ userInquiry: 'hi', llmModel: 'gpt-4.1', authentication })).rejects.toMatchObject({
        message: 'Internal Service Error',
        status: 500,
      })
    })

    it('reads the phase and session status out of meta_data', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          session_id: 'abc-123',
          meta_data: { phase: 'Summary', session_status: ' COMPLETED ' },
          response_items: [],
        },
      })

      const result = await createSession({ userInquiry: 'hi', authentication })

      // Lower-cased and trimmed: a stray 'COMPLETED' must still close the session.
      expect(result.phase).toBe('summary')
      expect(result.sessionStatus).toBe('completed')
    })

    it('reports no phase or status when meta_data is absent or empty', async () => {
      axios.post.mockResolvedValueOnce({ data: { session_id: 'abc-123', response_items: [] } })
      await expect(createSession({ userInquiry: 'hi', authentication })).resolves.toMatchObject({
        phase: null,
        sessionStatus: null,
      })

      axios.post.mockResolvedValueOnce({
        data: { session_id: 'abc-123', meta_data: { phase: '', session_status: '' }, response_items: [] },
      })
      await expect(createSession({ userInquiry: 'hi', authentication })).resolves.toMatchObject({
        phase: null,
        sessionStatus: null,
      })
    })

    it('maps a 401 to the unauthenticated error', async () => {
      axios.post.mockRejectedValueOnce({ response: { status: 401 } })

      await expect(createSession({ userInquiry: 'hi', llmModel: 'gpt-4.1', authentication })).rejects.toMatchObject({
        message: UNAUTHENTICATED_ERROR,
        status: 401,
      })
    })

    it('flags a 409 `detail` message as conversational, so the agent can speak it', async () => {
      const detail = 'Session has already completed and cannot accept further messages. Please start a new session.'
      axios.post.mockRejectedValueOnce({ response: { status: 409, data: { detail } } })

      await expect(createSession({ userInquiry: 'hi', authentication })).rejects.toMatchObject({
        message: detail,
        isConversational: true,
      })
    })

    // A real failure has to look like one - the backend is FastAPI-shaped, so an
    // HTTPException lands on `detail` as well. The text is still the best thing we
    // have to show, it just isn't spoken as the agent.
    it('keeps a `detail` on any other status as the error text, without speaking it', async () => {
      const detail = 'Session not found'
      axios.post.mockRejectedValueOnce({ response: { status: 404, data: { detail } } })

      const error = await createSession({ userInquiry: 'hi', authentication }).catch((e) => e)
      expect(error.message).toBe(detail)
      expect(error.isConversational).toBeFalsy()
    })

    it('does not speak a `detail` that is a validation array', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 422, data: { detail: [{ loc: ['body', 'user_inquiry'], msg: 'field required' }] } },
      })

      const error = await createSession({ userInquiry: 'hi', authentication }).catch((e) => e)
      expect(error.message).toBe(GENERAL_QUERY_ERROR)
      expect(error.isConversational).toBeFalsy()
    })

    it('does not speak a `detail` on an auth failure', async () => {
      axios.post.mockRejectedValueOnce({ response: { status: 401, data: { detail: 'Not authenticated' } } })

      const error = await createSession({ userInquiry: 'hi', authentication }).catch((e) => e)
      expect(error.message).toBe(UNAUTHENTICATED_ERROR)
      expect(error.isConversational).toBeFalsy()
    })
  })

  describe('resumeSession', () => {
    it('posts to the resume path for the given session, without a model', async () => {
      axios.post.mockResolvedValueOnce(RESUME_RESPONSE)

      await resumeSession({ sessionId: 'abc-123', userInquiry: 'go on', llmModel: 'gpt-4.1', authentication })

      const [url, body] = axios.post.mock.calls[0]
      expect(url).toBe('https://example.com/autoql/api/v1/sessions/abc-123/resume?key=test-key')
      expect(body).toEqual({ user_inquiry: 'go on' })
    })

    it('returns a null session id, since resume responses carry none', async () => {
      axios.post.mockResolvedValueOnce(RESUME_RESPONSE)

      const result = await resumeSession({ sessionId: 'abc-123', userInquiry: 'go on', authentication })

      expect(result.sessionId).toBeNull()
      // Order is authoritative: this response is table-then-text.
      expect(result.responseItems.map((item) => item.type)).toEqual(['table', 'text'])
      // The shape TableItem passes straight through to SimpleTable.
      const table = result.responseItems[0].data
      expect(table.columns).toHaveLength(22)
      expect(table.rows).toHaveLength(17)
      expect(table.rows.every((row) => row.length === table.columns.length)).toBe(true)
    })
  })

  describe('fetchModels', () => {
    it('normalizes a list of strings', async () => {
      axios.get.mockResolvedValueOnce({ data: ['gpt-4.1', 'gpt-5'] })

      const models = await fetchModels({ authentication })

      expect(models).toEqual([
        { id: 'gpt-4.1', label: 'gpt-4.1' },
        { id: 'gpt-5', label: 'gpt-5' },
      ])
    })

    it('normalizes a list of objects under a models key', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ llm_model: 'gpt-4.1', display_name: 'GPT-4.1', description: 'Fast' }] },
      })

      const models = await fetchModels({ authentication })

      expect(models).toEqual([{ id: 'gpt-4.1', label: 'GPT-4.1', description: 'Fast' }])
    })

    it('rejects when the endpoint is missing, so the caller can fall back', async () => {
      axios.get.mockRejectedValueOnce({ response: { status: 404 } })

      await expect(fetchModels({ authentication })).rejects.toHaveProperty('message')
    })
  })

  describe('normalizeModels', () => {
    it('drops entries with no usable id', () => {
      expect(normalizeModels([{ description: 'no id here' }, 'gpt-5'])).toEqual([{ id: 'gpt-5', label: 'gpt-5' }])
    })
  })
})
