import { callReportService, categoryOf, listOf, pageOf, pathOf, required, templateOf } from './reportsApi'

// Report templates and their categories as an organization's admins manage them, through AutoQL's management API: a
// template made from one of their own reports (a draft until it's published), its details, publishing it and taking it
// back, deleting it; and the organization's categories. Taking it needs the token's management grant for reports,
// which an app passes for its owners and admins. They're the organization's: the one the token's project belongs to.
// Reports start from published templates through run/reportsApi (fetchReportTemplates and createReportFromTemplate).

export const REPORTS_MANAGEMENT_PATH = '/autoql/management/api/v1/reports'

// The service's limits on a template's details: a title, a description, and its tags, each of which can't have a
// comma in it.
export const TEMPLATE_TITLE_MAX = 200
export const TEMPLATE_DESCRIPTION_MAX = 1024
export const TEMPLATE_TAGS_MAX = 20
export const TEMPLATE_TAG_MAX = 80

const call = (options) => callReportService({ ...options, base: REPORTS_MANAGEMENT_PATH })

// ---------------------------------------------------------------- templates

// The templates the token's user manages, drafts and published, without their documents: an organization's admin
// sees their organization's. `status` (DRAFT or PUBLISHED), `q` (in the title), `tags` and `categoryId` narrow it.
// Paged like reports.
export const fetchManagedTemplates = async ({
  authentication,
  q,
  tags,
  categoryId,
  status,
  orderBy,
  order,
  page,
  pageSize,
  signal,
} = {}) => {
  const { data } = await call({
    authentication,
    path: '/templates',
    params: {
      q,
      tags: tags?.length ? tags.join(',') : undefined,
      category_id: categoryId,
      status,
      order_by: orderBy,
      order,
      page,
      page_size: pageSize,
    },
    signal,
  })
  return { templates: listOf(data, templateOf), ...pageOf(data) }
}

// A draft template for the organization, made from one of the user's own reports as the service has it (save it
// first). AutoQL rebuilds it without the report's data — its answers, table filter values, legend labels, and
// analyses' wording — and turns dashboard-tile blocks into the questions they ask. Titles, headings, text, questions
// and an analysis's focus are kept as they are, so they can still name clients. A data block whose question can't be
// told fails with REPORT_TEMPLATE_BLOCK_NOT_PORTABLE, whose details have its `blockId`.
export const createTemplateFromReport = async ({ authentication, reportId, title, description, categoryId, tags }) => {
  const { data } = await call({
    authentication,
    method: 'post',
    path: '/templates',
    data: {
      scope: 'ORGANIZATION',
      title,
      ...(description ? { description } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(tags?.length ? { tags } : {}),
      source_report_id: reportId,
    },
  })
  return required(templateOf(data), 'template')
}

// One of the templates the token's user manages, draft or published, with its document as `report`, and its pending
// changes as `draft` where the service keeps those (RW-361).
export const fetchManagedTemplate = async ({ authentication, id, signal }) => {
  const { data } = await call({ authentication, path: pathOf('templates', id), signal })
  const template = required(templateOf(data), 'template')
  required(template.report, 'template')
  return template
}

// What a template's details and document are changed to: what's left out stays as it is, and null takes away a
// description, a category or tags.
const changesOf = ({ title, description, categoryId, tags, document }) => {
  const body = {}
  if (title !== undefined) {
    body.title = title
  }
  if (description !== undefined) {
    body.description = description
  }
  if (categoryId !== undefined) {
    body.category_id = categoryId
  }
  if (tags !== undefined) {
    body.tags = tags
  }
  if (document !== undefined) {
    body.document = document
  }
  return body
}

// Changes a template's details, and its document (`document`), which AutoQL rebuilds as it does a template made from a
// report. A published template's change reaches everyone at once: one whose changes the service keeps apart until
// they're published (RW-361) is changed with saveTemplateDraft instead.
export const updateTemplate = async ({ authentication, id, ...changes }) => {
  const { data } = await call({
    authentication,
    method: 'put',
    path: pathOf('templates', id),
    data: changesOf(changes),
  })
  return required(templateOf(data), 'template')
}

// Whether the service keeps a published template's changes apart until they're published (RW-361): it says whether a
// template has any (listed), or what they are (read by id).
export const keepsTemplateDrafts = (template) =>
  typeof template?.hasDraft === 'boolean' || (!!template && template.draft !== undefined)

// Keeps changes to a published template apart, to be published later (RW-361): its details and document as they'll
// be, as updateTemplate takes them. Everyone goes on starting reports from the template as it was until they're
// published (publishTemplate), and discardTemplateDraft drops them.
export const saveTemplateDraft = async ({ authentication, id, ...changes }) => {
  const { data } = await call({
    authentication,
    method: 'put',
    path: `${pathOf('templates', id)}/draft`,
    data: changesOf(changes),
  })
  return templateOf(data)
}

// Drops a published template's changes that weren't published (RW-361). There being none is fine.
export const discardTemplateDraft = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: `${pathOf('templates', id)}/draft` })
}

// Publishes a template, so reports can be started from it; publishing one that is already is fine. One of more than
// 50 data blocks fails with REPORT_LIMIT_EXCEEDED. Resolves with the template as it now is, when the service sends it.
export const publishTemplate = async ({ authentication, id }) =>
  templateOf((await call({ authentication, method: 'put', path: `${pathOf('templates', id)}/publication` })).data)

// Takes a template back to a draft: reports can no longer be started from it.
export const unpublishTemplate = async ({ authentication, id }) =>
  templateOf((await call({ authentication, method: 'delete', path: `${pathOf('templates', id)}/publication` })).data)

// Deletes a template for good. Reports already made from it keep their copy. One that's already gone counts as deleted.
export const deleteTemplate = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: pathOf('templates', id) })
}

// ---------------------------------------------------------------- categories

// The organization's own categories, which its admins manage. (Templates can also take the integrator's, which
// fetchReportCategories lists beside these.)
export const fetchManagedCategories = async ({ authentication, signal } = {}) =>
  listOf((await call({ authentication, path: '/categories', signal })).data, categoryOf)

// A new category for the organization. A name in use fails with REPORT_CATEGORY_NAME_EXISTS.
export const createTemplateCategory = async ({ authentication, name }) =>
  required(
    categoryOf(
      (await call({ authentication, method: 'post', path: '/categories', data: { scope: 'ORGANIZATION', name } })).data,
    ),
    'category',
  )

export const renameTemplateCategory = async ({ authentication, id, name }) =>
  required(
    categoryOf((await call({ authentication, method: 'put', path: pathOf('categories', id), data: { name } })).data),
    'category',
  )

// Deletes a category: its templates stay, without one. One that's already gone counts as deleted.
export const deleteTemplateCategory = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: pathOf('categories', id) })
}
