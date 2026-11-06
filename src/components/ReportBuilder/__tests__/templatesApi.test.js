import axios from 'axios'
import { ReportsApiError } from '../run/reportsApi'
import {
  createTemplateCategory,
  createTemplateFromReport,
  deleteTemplate,
  deleteTemplateCategory,
  discardTemplateDraft,
  fetchManagedCategories,
  fetchManagedTemplate,
  fetchManagedTemplates,
  keepsTemplateDrafts,
  publishTemplate,
  renameTemplateCategory,
  saveTemplateDraft,
  unpublishTemplate,
  updateTemplate,
} from '../run/templatesApi'

jest.mock('axios')

const AUTH = { domain: 'https://example.test', apiKey: 'k', token: 't' }
const RAW = {
  id: 'tp1',
  scope: 'ORGANIZATION',
  organization_public_id: 'org',
  title: 'Quarterly review',
  description: null,
  category_id: null,
  tags: ['Quarterly'],
  status: 'DRAFT',
  database_model: 'wealth',
  size_bytes: 10,
  updated_at: '2026-10-28T18:00:00Z',
}

const answer = (data, status = 200) => ({ status, data: { reference_id: `29.29.${status}`, message: '', data } })
const sent = (i = 0) => {
  const config = axios.request.mock.calls[i][0]
  const url = new URL(config.url)
  return {
    method: config.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body: config.data && JSON.parse(config.data),
    authorization: config.headers.Authorization,
  }
}

beforeEach(() => {
  axios.request.mockReset()
  axios.isCancel.mockReturnValue(false)
})

describe('managing templates through AutoQL’s management API', () => {
  it('lists the templates the user manages, drafts and published', async () => {
    axios.request.mockResolvedValue(
      answer({ items: [RAW], pagination: { current_page: 1, page_size: 200, total_pages: 1, total_items: 1 } }),
    )
    const result = await fetchManagedTemplates({ authentication: AUTH, pageSize: 200, status: 'DRAFT' })
    expect(result.templates).toEqual([expect.objectContaining({ id: 'tp1', status: 'DRAFT', tags: ['Quarterly'] })])
    expect(result.totalItems).toBe(1)
    expect(sent()).toMatchObject({
      method: 'get',
      path: '/autoql/management/api/v1/reports/templates',
      query: { page_size: '200', status: 'DRAFT', key: 'k' },
      authorization: 'Bearer t',
    })
  })

  it('makes a draft for the organization from one of the user’s reports', async () => {
    axios.request.mockResolvedValue(answer(RAW, 201))
    const made = await createTemplateFromReport({
      authentication: AUTH,
      reportId: 'r1',
      title: 'Quarterly review',
      categoryId: 'c1',
      tags: ['Quarterly'],
    })
    expect(made).toMatchObject({ id: 'tp1', title: 'Quarterly review' })
    expect(sent()).toMatchObject({
      method: 'post',
      path: '/autoql/management/api/v1/reports/templates',
      body: {
        scope: 'ORGANIZATION',
        title: 'Quarterly review',
        category_id: 'c1',
        tags: ['Quarterly'],
        source_report_id: 'r1',
      },
    })
  })

  it('names the block a template can’t keep', async () => {
    axios.request.mockRejectedValue({
      response: { status: 422, data: { reference_id: '29.29.492', message: 'No question', data: { block_id: 'b7' } } },
    })
    const failure = await createTemplateFromReport({ authentication: AUTH, reportId: 'r1', title: 'x' }).catch((e) => e)
    expect(failure).toBeInstanceOf(ReportsApiError)
    expect(failure).toMatchObject({ code: 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE', details: { blockId: 'b7' } })
  })

  it('changes only the details named, and null takes one away', async () => {
    axios.request.mockResolvedValue(answer({ ...RAW, title: 'Q3 review' }))
    await updateTemplate({ authentication: AUTH, id: 'tp1', title: 'Q3 review', description: null, tags: null })
    expect(sent()).toMatchObject({
      method: 'put',
      path: '/autoql/management/api/v1/reports/templates/tp1',
      body: { title: 'Q3 review', description: null, tags: null },
    })
    expect(sent().body).not.toHaveProperty('category_id')
  })

  it('reads one template with its document, to edit it', async () => {
    const document = { schemaVersion: 1, title: 'Quarterly review', page: {}, blocks: [] }
    axios.request.mockResolvedValue(answer({ ...RAW, document }))
    const template = await fetchManagedTemplate({ authentication: AUTH, id: 'tp1' })
    expect(template).toMatchObject({ id: 'tp1', report: document })
    expect(template).not.toHaveProperty('hasDraft')
    expect(template).not.toHaveProperty('draft')
    expect(sent()).toMatchObject({ method: 'get', path: '/autoql/management/api/v1/reports/templates/tp1' })
  })

  it('turns down a template read without its document', async () => {
    axios.request.mockResolvedValue(answer(RAW))
    await expect(fetchManagedTemplate({ authentication: AUTH, id: 'tp1' })).rejects.toBeInstanceOf(ReportsApiError)
  })

  it('replaces a template’s document along with its details', async () => {
    const document = { schemaVersion: 1, title: 'Q3 review', page: {}, blocks: [] }
    axios.request.mockResolvedValue(answer(RAW))
    await updateTemplate({ authentication: AUTH, id: 'tp1', title: 'Q3 review', document })
    expect(sent().body).toStrictEqual({ title: 'Q3 review', document })
  })

  describe('a published template’s changes kept apart until they’re published (RW-361)', () => {
    const DRAFT = {
      title: 'Q4 review',
      description: 'Next quarter',
      category_id: 'c1',
      tags: ['Quarterly'],
      document: { schemaVersion: 1, title: 'Q4 review', page: {}, blocks: [] },
      updated_at: '2026-11-05T18:00:00Z',
    }

    it('reads whether a template has any, and what they are', async () => {
      axios.request.mockResolvedValue(
        answer({
          ...RAW,
          status: 'PUBLISHED',
          document: {},
          has_draft: true,
          draft_updated_at: DRAFT.updated_at,
          draft: DRAFT,
        }),
      )
      const template = await fetchManagedTemplate({ authentication: AUTH, id: 'tp1' })
      expect(template).toMatchObject({
        hasDraft: true,
        draftUpdatedAt: DRAFT.updated_at,
        draft: {
          title: 'Q4 review',
          description: 'Next quarter',
          categoryId: 'c1',
          tags: ['Quarterly'],
          report: DRAFT.document,
          updatedAt: DRAFT.updated_at,
        },
      })
      expect(keepsTemplateDrafts(template)).toBe(true)
    })

    it('reads a template without any as having none', async () => {
      axios.request.mockResolvedValue(
        answer({ ...RAW, status: 'PUBLISHED', document: {}, has_draft: false, draft: null }),
      )
      const template = await fetchManagedTemplate({ authentication: AUTH, id: 'tp1' })
      expect(template).toMatchObject({ hasDraft: false, draftUpdatedAt: null, draft: null })
      expect(keepsTemplateDrafts(template)).toBe(true)
    })

    it('tells a service that doesn’t keep them', () => {
      expect(keepsTemplateDrafts({ id: 'tp1', status: 'PUBLISHED' })).toBe(false)
      expect(keepsTemplateDrafts(null)).toBe(false)
      // Read by id, what they are (or none) says it does.
      expect(keepsTemplateDrafts({ id: 'tp1', status: 'PUBLISHED', draft: null })).toBe(true)
    })

    it('keeps changes apart, and drops them', async () => {
      axios.request.mockResolvedValue(answer({ ...RAW, status: 'PUBLISHED', has_draft: true }))
      await saveTemplateDraft({ authentication: AUTH, id: 'tp1', title: 'Q4 review', document: DRAFT.document })
      expect(sent()).toMatchObject({
        method: 'put',
        path: '/autoql/management/api/v1/reports/templates/tp1/draft',
        body: { title: 'Q4 review', document: DRAFT.document },
      })

      axios.request.mockResolvedValue(answer(null))
      await discardTemplateDraft({ authentication: AUTH, id: 'tp1' })
      expect(sent(1)).toMatchObject({ method: 'delete', path: '/autoql/management/api/v1/reports/templates/tp1/draft' })
    })
  })

  it('publishes, takes back and deletes a template', async () => {
    axios.request.mockResolvedValueOnce(answer({ ...RAW, status: 'PUBLISHED' }))
    axios.request.mockResolvedValueOnce(answer(null))
    axios.request.mockResolvedValueOnce(answer(null))
    expect(await publishTemplate({ authentication: AUTH, id: 'tp1' })).toMatchObject({ status: 'PUBLISHED' })
    expect(await unpublishTemplate({ authentication: AUTH, id: 'tp1' })).toBeNull()
    await deleteTemplate({ authentication: AUTH, id: 'tp1' })
    expect(sent(0)).toMatchObject({
      method: 'put',
      path: '/autoql/management/api/v1/reports/templates/tp1/publication',
    })
    expect(sent(1)).toMatchObject({
      method: 'delete',
      path: '/autoql/management/api/v1/reports/templates/tp1/publication',
    })
    expect(sent(2)).toMatchObject({ method: 'delete', path: '/autoql/management/api/v1/reports/templates/tp1' })
  })

  it('lists, makes, renames and deletes the organization’s categories', async () => {
    const category = { id: 'c1', scope: 'ORGANIZATION', organization_public_id: 'org', name: 'Reviews' }
    axios.request.mockResolvedValueOnce(answer({ items: [category] }))
    axios.request.mockResolvedValueOnce(answer(category, 201))
    axios.request.mockResolvedValueOnce(answer({ ...category, name: 'Client reviews' }))
    axios.request.mockResolvedValueOnce(answer(null))
    expect(await fetchManagedCategories({ authentication: AUTH })).toEqual([
      { id: 'c1', scope: 'ORGANIZATION', organizationId: 'org', name: 'Reviews' },
    ])
    await createTemplateCategory({ authentication: AUTH, name: 'Reviews' })
    expect(await renameTemplateCategory({ authentication: AUTH, id: 'c1', name: 'Client reviews' })).toMatchObject({
      name: 'Client reviews',
    })
    await deleteTemplateCategory({ authentication: AUTH, id: 'c1' })
    expect(sent(0)).toMatchObject({ method: 'get', path: '/autoql/management/api/v1/reports/categories' })
    expect(sent(1)).toMatchObject({ method: 'post', body: { scope: 'ORGANIZATION', name: 'Reviews' } })
    expect(sent(2)).toMatchObject({ method: 'put', path: '/autoql/management/api/v1/reports/categories/c1' })
    expect(sent(3)).toMatchObject({ method: 'delete', path: '/autoql/management/api/v1/reports/categories/c1' })
  })
})
