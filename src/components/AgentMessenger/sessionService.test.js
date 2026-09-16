import axios from 'axios'
import { UNAUTHENTICATED_ERROR } from 'autoql-fe-utils'

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

    it('maps a 401 to the unauthenticated error', async () => {
      axios.post.mockRejectedValueOnce({ response: { status: 401 } })

      await expect(createSession({ userInquiry: 'hi', llmModel: 'gpt-4.1', authentication })).rejects.toMatchObject({
        message: UNAUTHENTICATED_ERROR,
        status: 401,
      })
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
