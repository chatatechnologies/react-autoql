import axios from 'axios'

import { fetchQueryTitle } from './queryTitleService'

jest.mock('axios')

const authentication = { domain: 'https://example.com', apiKey: 'test-key', token: 'test-token' }

describe('fetchQueryTitle', () => {
  afterEach(() => jest.clearAllMocks())

  test('posts { query } to the title endpoint with auth', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: { tab_display_name: 'Revenue by region' } } })

    await fetchQueryTitle({ query: 'total revenue by region last quarter', authentication })

    const [url, body, config] = axios.post.mock.calls[0]
    expect(url).toBe('https://example.com/autoql/api/v1/query/title?key=test-key')
    expect(body).toEqual({ query: 'total revenue by region last quarter' })
    expect(config.headers.Authorization).toBe('Bearer test-token')
  })

  test('returns the tab display name', async () => {
    axios.post.mockResolvedValueOnce({
      data: { reference_id: '1.1.200', message: 'Success', data: { tab_display_name: ' Revenue by region\nlast quarter ' } },
    })

    await expect(fetchQueryTitle({ query: 'q', authentication })).resolves.toBe('Revenue by region last quarter')
  })

  test('returns null when there is no usable name', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: { tab_display_name: '  ' } } })
    await expect(fetchQueryTitle({ query: 'q', authentication })).resolves.toBeNull()

    axios.post.mockResolvedValueOnce({ data: {} })
    await expect(fetchQueryTitle({ query: 'q', authentication })).resolves.toBeNull()
  })
})
