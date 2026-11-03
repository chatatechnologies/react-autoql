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
  470: 'REPORT_NOT_FOUND',
  471: 'REPORT_VERSION_CONFLICT',
  472: 'REPORT_ID_CONFLICT',
  473: 'INVALID_REPORT',
  474: 'REPORT_TOO_LARGE',
  475: 'REPORT_BLOCK_INVALID',
  482: 'REPORT_TAGS_INVALID',
  483: 'REPORT_PROJECT_REQUIRED',
  484: 'REPORT_SEARCH_INVALID',
  485: 'REPORT_LIMIT_EXCEEDED',
  486: 'REPORT_FOLDER_NOT_FOUND',
  487: 'REPORT_FOLDER_NAME_TAKEN',
  488: 'REPORT_TAG_NOT_FOUND',
  489: 'REPORT_TAG_NAME_TAKEN',
  490: 'REPORT_BULK_REQUEST_INVALID',
  494: 'REPORT_NAME_INVALID',
}

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
const call = async ({ authentication, method = 'get', path = '', params = {}, data, keepalive = false, signal }) => {
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
    url: `${domain}${REPORTS_PATH}${path}?${query}`,
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

const text = (value) => (typeof value === 'string' ? value : '')
const count = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const ids = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
const idOrNull = (value) => (typeof value === 'string' ? value : null)
const pathOf = (...segments) => segments.map((segment) => `/${encodeURIComponent(segment)}`).join('')

const required = (item, what) => {
  if (!item) {
    throw new ReportsApiError({ status: 200, message: `Unexpected ${what} from the report service` })
  }
  return item
}

// A report as listed: everything but its document.
const summaryOf = (raw) =>
  isObject(raw) && typeof raw.id === 'string'
    ? {
        id: raw.id,
        title: text(raw.title),
        sizeBytes: count(raw.size_bytes),
        version: count(raw.version),
        folderId: idOrNull(raw.folder_id),
        tagIds: ids(raw.tag_ids),
        createdAt: text(raw.created_at),
        updatedAt: text(raw.updated_at),
      }
    : null

const detailOf = (raw) => {
  const summary = required(summaryOf(raw), 'report')
  return {
    ...summary,
    projectId: text(raw.project_id),
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

const listOf = (data, itemOf) => (Array.isArray(data?.items) ? data.items.map(itemOf).filter(Boolean) : [])

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
  const pagination = isObject(data?.pagination) ? data.pagination : {}
  return {
    reports: listOf(data, summaryOf),
    page: count(pagination.current_page),
    pageSize: count(pagination.page_size),
    totalPages: count(pagination.total_pages),
    totalItems: count(pagination.total_items),
  }
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
