import axios from 'axios'
import {
  appendReportBlock,
  createReport,
  createReportTag,
  deleteReport,
  deleteReportFolder,
  fetchReport,
  fetchReports,
  organizeReports,
  renameReportFolder,
  ReportsApiError,
  saveReport,
  updateReportTag,
} from '../run/reportsApi'

jest.mock('axios')

const AUTH = { domain: 'https://example.test', apiKey: 'k 1', token: 't' }
const ID = '6f1c2b1e-8d4a-4b7a-9d3e-2a1b0c9d8e7f'
const DOCUMENT = {
  schemaVersion: 1,
  title: 'Q3 book',
  page: { pageNumbers: true },
  blocks: [{ id: 'b1', type: 'text' }],
}
const STORED = {
  id: ID,
  title: 'Q3 book',
  size_bytes: 120,
  version: 3,
  folder_id: null,
  tag_ids: ['a'],
  created_at: '2026-10-15T21:34:31.580+00:00',
  updated_at: '2026-10-15T21:35:00.000+00:00',
}

const answer = (data, status = 200) => ({ status, data: { reference_id: `29.29.${status}`, message: '', data } })
const sent = (i = 0) => {
  const config = axios.request.mock.calls[i][0]
  const url = new URL(config.url)
  return {
    ...config,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body: config.data && JSON.parse(config.data),
  }
}

beforeEach(() => {
  axios.request.mockReset()
  axios.isCancel.mockReturnValue(false)
})

describe('AutoQL’s report service', () => {
  it('lists the user’s reports with the token and API key, in the host’s names, with the page it is', async () => {
    axios.request.mockResolvedValue(
      answer({
        items: [STORED, { title: 'no id' }],
        pagination: { current_page: 1, page_size: 200, total_pages: 1, total_items: 1 },
      }),
    )
    const result = await fetchReports({ authentication: AUTH, pageSize: 200, tagIds: ['a', 'b'] })
    expect(result).toEqual({
      reports: [
        {
          id: ID,
          title: 'Q3 book',
          sizeBytes: 120,
          version: 3,
          folderId: null,
          tagIds: ['a'],
          createdAt: STORED.created_at,
          updatedAt: STORED.updated_at,
        },
      ],
      page: 1,
      pageSize: 200,
      totalPages: 1,
      totalItems: 1,
    })
    const request = sent()
    expect(request.method).toBe('get')
    expect(request.path).toBe('/autoql/api/v1/reports')
    expect(request.query).toEqual({ page_size: '200', tag_ids: 'a,b', key: 'k 1' })
    expect(request.headers.Authorization).toBe('Bearer t')
  })

  it('reads a report with its document as stored, keys and all', async () => {
    axios.request.mockResolvedValue(answer({ ...STORED, project_id: 'CT_1', document: DOCUMENT }))
    const report = await fetchReport({ authentication: AUTH, id: ID })
    expect(report.report).toEqual(DOCUMENT)
    expect(report.projectId).toBe('CT_1')
    expect(sent().path).toBe(`/autoql/api/v1/reports/${ID}`)
  })

  it('creates under the host’s id, filed and tagged if asked, and says whether it made it', async () => {
    axios.request.mockResolvedValueOnce(answer({ ...STORED, document: DOCUMENT }, 201))
    axios.request.mockResolvedValueOnce(answer({ ...STORED, document: DOCUMENT }, 200))
    const made = await createReport({ authentication: AUTH, id: ID, report: DOCUMENT, folderId: 'f', tagIds: ['a'] })
    const again = await createReport({ authentication: AUTH, id: ID, report: DOCUMENT })
    expect([made.created, again.created]).toEqual([true, false])
    expect(sent(0)).toMatchObject({
      method: 'post',
      body: { id: ID, document: DOCUMENT, folder_id: 'f', tag_ids: ['a'] },
    })
    expect(sent(1).body).toEqual({ id: ID, document: DOCUMENT })
  })

  it('saves the document with the version it was read at, and only a small save outlives the page', async () => {
    axios.request.mockResolvedValue(answer({ id: ID, version: 4, updated_at: 'now' }))
    expect(await saveReport({ authentication: AUTH, id: ID, report: DOCUMENT, version: 3, keepalive: true })).toEqual({
      id: ID,
      version: 4,
      updatedAt: 'now',
    })
    expect(sent(0)).toMatchObject({ method: 'put', body: { document: DOCUMENT, version: 3 }, adapter: 'fetch' })
    expect(sent(0).fetchOptions).toEqual({ keepalive: true })

    const big = { ...DOCUMENT, blocks: [{ id: 'b', type: 'text', text: 'x'.repeat(70 * 1024) }] }
    await saveReport({ authentication: AUTH, id: ID, report: big, version: 4, keepalive: true })
    expect(sent(1).adapter).toBeUndefined()
  })

  it('names the service’s errors and renames their data', async () => {
    axios.request.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { reference_id: '29.29.471', message: 'Stale', data: { version: 5, updated_at: 'then' } },
      },
    })
    const conflict = await saveReport({ authentication: AUTH, id: ID, report: DOCUMENT, version: 3 }).catch((e) => e)
    expect(conflict).toBeInstanceOf(ReportsApiError)
    expect(conflict).toMatchObject({
      status: 409,
      code: 'REPORT_VERSION_CONFLICT',
      messageId: 471,
      details: { version: 5, updatedAt: 'then' },
    })

    axios.request.mockRejectedValueOnce({ response: { status: 413, data: '<html>Too large</html>' } })
    expect(await deleteReport({ authentication: AUTH, id: ID }).catch((e) => e)).toMatchObject({
      status: 413,
      code: undefined,
    })

    axios.request.mockRejectedValueOnce(new Error('Network Error'))
    expect(await fetchReports({ authentication: AUTH }).catch((e) => e)).toMatchObject({ status: 0 })
  })

  it('refuses without authentication, before asking anything', async () => {
    const error = await fetchReports({ authentication: { domain: 'https://example.test' } }).catch((e) => e)
    expect(error).toMatchObject({ status: 401 })
    expect(axios.request).not.toHaveBeenCalled()
  })

  it('appends a block and says whether it was new', async () => {
    axios.request.mockResolvedValue(answer({ id: ID, version: 4, updated_at: 'now', appended: false }))
    expect(await appendReportBlock({ authentication: AUTH, id: ID, block: { id: 'b2', type: 'text' } })).toEqual({
      id: ID,
      version: 4,
      updatedAt: 'now',
      appended: false,
    })
    expect(sent()).toMatchObject({
      method: 'post',
      path: `/autoql/api/v1/reports/${ID}/blocks`,
      body: { block: { id: 'b2' } },
    })
  })

  it('organizes: null unfiles, a folder left out stays as it is', async () => {
    axios.request.mockResolvedValue(answer({ items: [{ id: ID, folder_id: null, tag_ids: ['a'] }] }))
    expect(await organizeReports({ authentication: AUTH, reportIds: [ID], folderId: null })).toEqual([
      { id: ID, folderId: null, tagIds: ['a'] },
    ])
    await organizeReports({ authentication: AUTH, reportIds: [ID], addTagIds: ['a'] })
    expect(sent(0).body).toEqual({ report_ids: [ID], folder_id: null })
    expect(sent(1).body).toEqual({ report_ids: [ID], add_tag_ids: ['a'] })
  })

  it('makes, renames, recolours and deletes folders and tags', async () => {
    axios.request.mockResolvedValueOnce(answer({ id: 't1', name: 'Q3', color: 'blue', report_count: 0 }, 201))
    axios.request.mockResolvedValueOnce(answer({ id: 't1', name: 'Q3', color: 'amber', report_count: 2 }))
    axios.request.mockResolvedValueOnce(answer({ id: 'f1', name: 'Clients', report_count: 1 }))
    axios.request.mockResolvedValueOnce(answer(null))
    expect(await createReportTag({ authentication: AUTH, id: 't1', name: 'Q3', color: 'blue' })).toMatchObject({
      id: 't1',
      color: 'blue',
      created: true,
    })
    expect(await updateReportTag({ authentication: AUTH, id: 't1', color: 'amber' })).toMatchObject({ reportCount: 2 })
    expect(await renameReportFolder({ authentication: AUTH, id: 'f1', name: 'Clients' })).toMatchObject({
      name: 'Clients',
    })
    await deleteReportFolder({ authentication: AUTH, id: 'f1' })
    expect(sent(0)).toMatchObject({ method: 'post', path: '/autoql/api/v1/reports/tags' })
    expect(sent(1)).toMatchObject({ method: 'put', path: '/autoql/api/v1/reports/tags/t1', body: { color: 'amber' } })
    expect(sent(2)).toMatchObject({
      method: 'put',
      path: '/autoql/api/v1/reports/folders/f1',
      body: { name: 'Clients' },
    })
    expect(sent(3)).toMatchObject({ method: 'delete', path: '/autoql/api/v1/reports/folders/f1' })
  })
})
