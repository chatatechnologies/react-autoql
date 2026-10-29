import axios from 'axios'
import { getAuthentication } from 'autoql-fe-utils'

// A user's own reports, kept by AutoQL's report service (autoql-widget-support-service): one Report Builder
// document per report, for one user on one data source — the token's project — with that user's folders and tags
// beside them. A host keeps what's open in a ReportBuilder and stores it through these. The document goes back and
// forth unchanged; everything around it is named the way hosts name things (camelCase) where the service uses
// snake_case.

export const REPORTS_PATH = '/autoql/api/v1/reports'

// The service's message ids, the number its reference_id ends with ("29.29.471"), by name for hosts to branch on.
export const REPORT_ERROR_CODES = {
  410: 'INCOMPLETE_REQUEST_BODY',
  440: 'INVALID_PROJECT_ID',
  469: 'REPORT_ORGANIZATION_UNAVAILABLE',
  470: 'REPORT_NOT_FOUND',
  471: 'REPORT_VERSION_CONFLICT',
  472: 'REPORT_ID_CONFLICT',
  473: 'INVALID_REPORT',
  474: 'REPORT_TOO_LARGE',
  475: 'REPORT_BLOCK_INVALID',
  476: 'REPORT_TEMPLATE_NOT_FOUND',
  477: 'REPORT_TEMPLATE_CONTAINS_DATA',
  479: 'REPORT_TEMPLATE_SCOPE_INVALID',
  480: 'REPORT_CATEGORY_NOT_FOUND',
  481: 'REPORT_CATEGORY_NAME_EXISTS',
  482: 'REPORT_TAGS_INVALID',
  483: 'REPORT_PROJECT_REQUIRED',
  484: 'REPORT_SEARCH_INVALID',
  485: 'REPORT_LIMIT_EXCEEDED',
  486: 'REPORT_FOLDER_NOT_FOUND',
  487: 'REPORT_FOLDER_NAME_TAKEN',
  488: 'REPORT_TAG_NOT_FOUND',
  489: 'REPORT_TAG_NAME_TAKEN',
  490: 'REPORT_BULK_REQUEST_INVALID',
  491: 'REPORT_DATA_FILL_IN_PROGRESS',
  492: 'REPORT_TEMPLATE_BLOCK_NOT_PORTABLE',
  493: 'REPORT_FILL_REJECTED',
  494: 'REPORT_NAME_INVALID',
  495: 'REPORT_ORGANIZATION_UNKNOWN',
}

// Where a report made from a template is with its data (`dataStatus`): the service fills its data blocks in the
// background, PENDING then RUNNING, and ends DONE (every block filled), PARTIAL (some) or FAILED (none). NONE is
// a report nothing has filled.
export const REPORT_DATA_STATUSES = ['NONE', 'PENDING', 'RUNNING', 'DONE', 'PARTIAL', 'FAILED']

// Whether the service is filling a report's data now: it's read-only meanwhile.
export const isFillingData = (dataStatus) => dataStatus === 'PENDING' || dataStatus === 'RUNNING'

// A failed call. `status` is 0 when the service couldn't be reached; `code` names the service's message id when it
// sent one; `details` is that answer's data with its keys in camelCase: the current `version` and `updatedAt` on a
// version conflict, the `reason` an invalid report or block broke, the `id` of the folder or tag that holds a name.
export class ReportsApiError extends Error {
  constructor({ status = 0, code, messageId, referenceId, details, message } = {}) {
    super(message || (status ? `The report service answered ${status}` : 'The report service couldn’t be reached'))
    this.name = 'ReportsApiError'
    this.status = status
    this.code = code
    this.messageId = messageId
    this.referenceId = referenceId
    this.details = details
  }
}

// Browsers cap what requests that outlive their page (keepalive) may send, at 64 KiB in all.
const KEEPALIVE_MAX_BYTES = 60 * 1024

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const camel = (key) => key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
const camelKeys = (value) =>
  isObject(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [camel(key), item])) : value
// Whether a body fits what a keepalive request may send, counted in UTF-8 bytes. A body longer than that in
// characters can't fit, so isn't counted.
const fitsKeepalive = (text) => {
  if (text.length > KEEPALIVE_MAX_BYTES) {
    return false
  }
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes <= KEEPALIVE_MAX_BYTES
}

const toError = (error) => {
  if (axios.isCancel(error)) {
    return error
  }
  const response = error?.response
  if (!response) {
    return new ReportsApiError({
      message: error?.message ? `The report service couldn’t be reached: ${error.message}` : undefined,
    })
  }
  const body = isObject(response.data) ? response.data : {}
  const referenceId = typeof body.reference_id === 'string' ? body.reference_id : undefined
  const messageId = referenceId ? Number(referenceId.split('.').pop()) : undefined
  return new ReportsApiError({
    status: response.status,
    code: REPORT_ERROR_CODES[messageId],
    messageId,
    referenceId,
    details: camelKeys(body.data),
    message: body.message || undefined,
  })
}

// One call to the service, as the token's user on the token's data source: its status and the envelope's data.
// `base` is the API it's on: the reports API by default, or AutoQL's management API for reports.
const call = async ({
  authentication,
  base = REPORTS_PATH,
  method = 'get',
  path = '',
  params = {},
  data,
  keepalive = false,
  signal,
}) => {
  const { domain, apiKey, token } = getAuthentication(authentication)
  if (!domain || !token) {
    throw new ReportsApiError({ status: 401, message: 'No AutoQL authentication to reach reports with' })
  }
  const query = new URLSearchParams()
  Object.entries({ ...params, key: apiKey }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(name, String(value))
    }
  })
  const body = data === undefined ? undefined : JSON.stringify(data)
  const config = {
    method,
    url: `${domain}${base}${path}?${query}`,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    data: body,
    signal,
    // A save sent as the page goes away has to outlive it, which only fetch can do, and only for a small body.
    ...(keepalive && body !== undefined && fitsKeepalive(body)
      ? { adapter: 'fetch', fetchOptions: { keepalive: true } }
      : {}),
  }
  try {
    const response = await axios.request(config)
    return { status: response?.status, data: response?.data?.data ?? null }
  } catch (error) {
    throw toError(error)
  }
}

// For calls to AutoQL's management API for reports, which go the same way.
export const callReportService = call

const text = (value) => (typeof value === 'string' ? value : '')
const count = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const ids = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
const idOrNull = (value) => (typeof value === 'string' ? value : null)
export const pathOf = (...segments) => segments.map((segment) => `/${encodeURIComponent(segment)}`).join('')

export const required = (item, what) => {
  if (!item) {
    throw new ReportsApiError({ status: 200, message: `Unexpected ${what} from the report service` })
  }
  return item
}

const dataStatusOf = (value) => (REPORT_DATA_STATUSES.includes(value) ? value : 'NONE')

// Why the data blocks a fill left unfilled weren't filled: [{ blockId, reason, message }], `reason` one of the
// service's stable codes (not_confident, access_denied, no_data, query_failed, timeout, too_large,
// tile_unavailable, no_question, stale_block, busy, interrupted), `message` the query's own words if it sent any.
const dataErrorsOf = (value) =>
  (Array.isArray(value) ? value : [])
    .filter((error) => isObject(error) && typeof error.block_id === 'string')
    .map((error) => ({
      blockId: error.block_id,
      reason: text(error.reason),
      ...(typeof error.message === 'string' && error.message ? { message: error.message } : {}),
    }))

// A report as listed: everything but its document. `templateId` is the template it was made from, if it was.
const summaryOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? {
        id: raw.id,
        title: text(raw.title),
        sizeBytes: count(raw.size_bytes),
        version: count(raw.version),
        folderId: idOrNull(raw.folder_id),
        tagIds: ids(raw.tag_ids),
        templateId: idOrNull(raw.template_id),
        dataStatus: dataStatusOf(raw.data_status),
        createdAt: text(raw.created_at),
        updatedAt: text(raw.updated_at),
      }
    : null

const detailOf = (raw) => {
  const summary = required(summaryOf(raw), 'report')
  return {
    ...summary,
    projectId: text(raw.project_id),
    dataErrors: dataErrorsOf(raw.data_errors),
    report: required(isObject(raw.document) && raw.document, 'report'),
  }
}

const stampOf = (raw) =>
  required(
    isObject(raw) && typeof raw.id === 'string' && typeof raw.version === 'number'
      ? { id: raw.id, version: raw.version, updatedAt: text(raw.updated_at) }
      : null,
    'save result',
  )

const folderOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? {
        id: raw.id,
        name: text(raw.name),
        reportCount: count(raw.report_count),
        createdAt: text(raw.created_at),
        updatedAt: text(raw.updated_at),
      }
    : null

const tagOf = (raw) => {
  const tag = folderOf(raw)
  return tag ? { ...tag, color: text(raw.color) } : null
}

const placementOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? { id: raw.id, folderId: idOrNull(raw.folder_id), tagIds: ids(raw.tag_ids) }
    : null

export const listOf = (data, itemOf) => (Array.isArray(data?.items) ? data.items.map(itemOf).filter(Boolean) : [])

// A page of a list, as the service pages it.
export const pageOf = (data) => {
  const pagination = isObject(data?.pagination) ? data.pagination : {}
  return {
    page: count(pagination.current_page),
    pageSize: count(pagination.page_size),
    totalPages: count(pagination.total_pages),
    totalItems: count(pagination.total_items),
  }
}

// A template as listed (without its document), or with it as `report` when it was asked for by id. `scope` is
// INTEGRATOR (everyone's) or ORGANIZATION (`organizationId`'s); `status` DRAFT or PUBLISHED, though only published
// ones are listed to start a report from.
export const templateOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? {
        id: raw.id,
        scope: text(raw.scope),
        organizationId: idOrNull(raw.organization_public_id),
        title: text(raw.title),
        description: text(raw.description),
        categoryId: idOrNull(raw.category_id),
        tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string') : [],
        status: text(raw.status),
        databaseModel: text(raw.database_model),
        sizeBytes: count(raw.size_bytes),
        publishedAt: text(raw.published_at),
        createdAt: text(raw.created_at),
        updatedAt: text(raw.updated_at),
        ...(isObject(raw.document) ? { report: raw.document } : {}),
      }
    : null

// A template category: INTEGRATOR (everyone's) or ORGANIZATION (`organizationId`'s).
export const categoryOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? {
        id: raw.id,
        scope: text(raw.scope),
        organizationId: idOrNull(raw.organization_public_id),
        name: text(raw.name),
      }
    : null

// ---------------------------------------------------------------- reports

// The user's reports on the token's data source, without their documents: most recently saved first unless
// `orderBy` (updated_at, created_at or title) and `order` (asc or desc) say otherwise, `pageSize` to a page (the
// service's default is 50, its most 200). `q` matches titles; `folderId`, and `tagIds` (any of them), narrow it.
export const fetchReports = async ({
  authentication,
  page,
  pageSize,
  q,
  folderId,
  tagIds,
  orderBy,
  order,
  signal,
} = {}) => {
  const { data } = await call({
    authentication,
    params: {
      page,
      page_size: pageSize,
      q,
      folder_id: folderId,
      tag_ids: tagIds?.length ? tagIds.join(',') : undefined,
      order_by: orderBy,
      order,
    },
    signal,
  })
  return { reports: listOf(data, summaryOf), ...pageOf(data) }
}

// One report, with its document.
export const fetchReport = async ({ authentication, id, signal }) =>
  detailOf((await call({ authentication, path: pathOf(id), signal })).data)

// Stores a new report under the id the host made for it (a UUID), filed in a folder and tagged if asked. Creating
// again with the same id answers with what was stored the first time, which may not be this copy, and `created`
// false.
export const createReport = async ({ authentication, id, report, folderId, tagIds, keepalive }) => {
  const { status, data } = await call({
    authentication,
    method: 'post',
    data: {
      id,
      document: report,
      ...(folderId ? { folder_id: folderId } : {}),
      ...(tagIds?.length ? { tag_ids: tagIds } : {}),
    },
    keepalive,
  })
  return { ...detailOf(data), created: status === 201 }
}

// Starts a report from a published template, under the id the host made for it (a UUID), filed and tagged if asked.
// The report is the user's own copy, which later changes to the template don't touch. The service fills its data
// blocks with the user's data in the background (`dataStatus` PENDING, then RUNNING), asking the questions in
// `timeZone` (the browser's, say) so relative dates read as they do in the app; the report is read-only until it's
// done. Creating again with the same id answers with what was stored the first time, and `created` false.
export const createReportFromTemplate = async ({ authentication, id, templateId, folderId, tagIds, timeZone }) => {
  const { status, data } = await call({
    authentication,
    method: 'post',
    data: {
      id,
      template_id: templateId,
      ...(folderId ? { folder_id: folderId } : {}),
      ...(tagIds?.length ? { tag_ids: tagIds } : {}),
      ...(timeZone ? { time_zone: timeZone } : {}),
    },
  })
  return { ...detailOf(data), created: status === 201 }
}

// How filling a report's data is going: { dataStatus, version, dataUpdatedAt, dataErrors }. Every block filled
// moves the report to a new version, so a version that changed means there's more to show.
export const fetchReportDataStatus = async ({ authentication, id, signal }) => {
  const { data } = await call({ authentication, path: `${pathOf(id)}/data`, signal })
  return {
    dataStatus: dataStatusOf(data?.data_status),
    version: count(data?.version),
    dataUpdatedAt: text(data?.data_updated_at) || null,
    dataErrors: dataErrorsOf(data?.data_errors),
  }
}

// Replaces the whole document. `version` is the one it was last read or saved at: an older one fails with
// REPORT_VERSION_CONFLICT, whose details have the current one.
export const saveReport = async ({ authentication, id, report, version, keepalive }) =>
  stampOf(
    (await call({ authentication, method: 'put', path: pathOf(id), data: { document: report, version }, keepalive }))
      .data,
  )

// Deletes a report for good. One that's already gone counts as deleted.
export const deleteReport = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: pathOf(id) })
}

// Deletes up to 200 reports in one go: those `deleted`, and the ids that named none of the user's (`notFound`).
export const deleteReports = async ({ authentication, ids: reportIds }) => {
  const { data } = await call({ authentication, method: 'post', path: '/delete', data: { ids: reportIds } })
  return { deleted: ids(data?.deleted), notFound: ids(data?.not_found) }
}

// Adds a block at the end of a report ("Add to Report…"), even while it's open somewhere. Idempotent on the block's
// id: `appended` is false when the report already had it. Like a save, it moves the report to a new version.
export const appendReportBlock = async ({ authentication, id, block }) => {
  const { data } = await call({ authentication, method: 'post', path: `${pathOf(id)}/blocks`, data: { block } })
  return { ...stampOf(data), appended: data?.appended === true }
}

// Files and tags up to 200 reports in one go: `folderId` null unfiles them, and leaving it out leaves their folders
// as they are. All or nothing. Neither their version nor their updatedAt changes, so an editor open on one of them
// saves on without a conflict.
export const organizeReports = async ({ authentication, reportIds, folderId, addTagIds, removeTagIds }) => {
  const { data } = await call({
    authentication,
    method: 'post',
    path: '/organize',
    data: {
      report_ids: reportIds,
      ...(folderId !== undefined ? { folder_id: folderId } : {}),
      ...(addTagIds?.length ? { add_tag_ids: addTagIds } : {}),
      ...(removeTagIds?.length ? { remove_tag_ids: removeTagIds } : {}),
    },
  })
  return listOf(data, placementOf)
}

// ---------------------------------------------------------------- folders

// The user's folders on the token's data source, with how many of their reports each holds, in no order.
export const fetchReportFolders = async ({ authentication, signal } = {}) =>
  listOf((await call({ authentication, path: '/folders', signal })).data, folderOf)

// A new folder under the id the host made for it (a UUID). A name in use fails with REPORT_FOLDER_NAME_TAKEN, whose
// details have the `id` of the folder that has it. Creating again with the same id answers with that folder.
export const createReportFolder = async ({ authentication, id, name }) => {
  const { status, data } = await call({ authentication, method: 'post', path: '/folders', data: { id, name } })
  return { ...required(folderOf(data), 'folder'), created: status === 201 }
}

export const renameReportFolder = async ({ authentication, id, name }) =>
  required(
    folderOf((await call({ authentication, method: 'put', path: pathOf('folders', id), data: { name } })).data),
    'folder',
  )

// Deletes a folder. Its reports become unfiled; none is deleted.
export const deleteReportFolder = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: pathOf('folders', id) })
}

// ---------------------------------------------------------------- tags

// The user's tags on the token's data source, with how many of their reports carry each, in no order.
export const fetchReportTags = async ({ authentication, signal } = {}) =>
  listOf((await call({ authentication, path: '/tags', signal })).data, tagOf)

// A new tag under the id the host made for it (a UUID), with a colour key the host chose (`blue`, `amber`…), kept as
// it's sent. A name in use fails with REPORT_TAG_NAME_TAKEN, whose details have the `id` of the tag that has it.
export const createReportTag = async ({ authentication, id, name, color }) => {
  const { status, data } = await call({ authentication, method: 'post', path: '/tags', data: { id, name, color } })
  return { ...required(tagOf(data), 'tag'), created: status === 201 }
}

// Renames a tag everywhere it's used, recolours it, or both.
export const updateReportTag = async ({ authentication, id, name, color }) =>
  required(
    tagOf(
      (
        await call({
          authentication,
          method: 'put',
          path: pathOf('tags', id),
          data: { ...(name !== undefined ? { name } : {}), ...(color !== undefined ? { color } : {}) },
        })
      ).data,
    ),
    'tag',
  )

// Deletes a tag, taking it off every report that had it; none is deleted.
export const deleteReportTag = async ({ authentication, id }) => {
  await call({ authentication, method: 'delete', path: pathOf('tags', id) })
}

// ---------------------------------------------------------------- templates, to start a report from

// The templates published for the token's data source, without their documents: its organization's and the
// integrator's, made for its data model. `q` matches titles; `tags` (any of them, spelled as their manager spelled
// them), `categoryId` and `scope` (INTEGRATOR or ORGANIZATION) narrow it. Paged like reports.
export const fetchReportTemplates = async ({
  authentication,
  q,
  tags,
  categoryId,
  scope,
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
      scope,
      order_by: orderBy,
      order,
      page,
      page_size: pageSize,
    },
    signal,
  })
  return { templates: listOf(data, templateOf), ...pageOf(data) }
}

// One published template, with its document (`report`): what a report started from it begins as, its data blocks
// holding their questions and how they're shown, but no answers.
export const fetchReportTemplate = async ({ authentication, id, signal }) => {
  const template = required(
    templateOf((await call({ authentication, path: pathOf('templates', id), signal })).data),
    'template',
  )
  required(template.report, 'template')
  return template
}

// The template categories the token's data source can see (its organization's and the integrator's), in no order.
export const fetchReportCategories = async ({ authentication, scope, signal } = {}) =>
  listOf((await call({ authentication, path: '/categories', params: { scope }, signal })).data, categoryOf)
