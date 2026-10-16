import { v4 as uuid } from 'uuid'
import { ReportsApiError } from '../run/reportsApi'
import { REPORTS_STRINGS } from './strings'

// Reports as the workspace keeps them in AutoQL's report service: new ids, clean documents, comparing a report
// with its stored copy, and the one line to show when something fails.
//
// A report is the builder's JSON. Its Data blocks carry what was captured when they were added (plain rows and
// settings), but never a live query response, which holds functions: `queryResponse` is stripped at any depth
// before anything is sent.

const S = REPORTS_STRINGS

// The service's limit on a title, in characters (code points).
export const REPORT_TITLE_MAX = 200

// The service keeps a report of up to 5 MiB, serialized. Adding blocks stops short of that, so a full report can
// still be edited and saved.
export const REPORT_ADD_MAX_BYTES = 4.5 * 1024 * 1024

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// A string's length in UTF-8, counted by hand: TextEncoder isn't there in every environment a host tests in.
export const utf8Length = (text) => {
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

// How big a report (or part of one) is as the service counts it: its JSON in UTF-8.
export const reportBytes = (value) => utf8Length(JSON.stringify(value) ?? '')

// A deep copy without any `queryResponse`, wherever it sits.
export const stripQueryResponses = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripQueryResponses)
  }
  if (!isObject(value)) {
    return value
  }
  const out = {}
  Object.entries(value).forEach(([key, child]) => {
    if (key !== 'queryResponse') {
      out[key] = stripQueryResponses(child)
    }
  })
  return out
}

// A new report or block id. A UUID: the service takes nothing else for a report.
export const newReportId = () => uuid()

// A report's name in lists and tabs: its title, or "Untitled report".
export const titleOf = (report) => (typeof report?.title === 'string' ? report.title.trim() : '') || S.untitled

// Counted the way the service counts it: in code points, so an emoji is one.
export const isTitleTooLong = (report) =>
  typeof report?.title === 'string' && Array.from(report.title).length > REPORT_TITLE_MAX

// ---------------------------------------------------------------- comparing with the stored copy

const toJson = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

const equalJson = (a, b) => {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, i) => equalJson(item, b[i]))
  }
  if (!isObject(a) || !isObject(b)) {
    return false
  }
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) {
    return false
  }
  return keys.every((key) => key in b && equalJson(a[key], b[key]))
}

// The same document, as JSON: key order doesn't count, and what JSON drops (undefined, functions) isn't there.
export const sameJson = (a, b) => equalJson(toJson(a), toJson(b))

const blocksOf = (report) => (Array.isArray(report?.blocks) ? report.blocks : [])

const withoutBlocks = (report) => {
  const rest = { ...report }
  delete rest.blocks
  return rest
}

// The blocks `server` has and `base` doesn't, when that is all that differs — what "Add to Report…" does to a
// report open in another tab. Null when the stored copy changed in any other way: it was edited somewhere else.
export const blocksAddedOnServer = (base, server) => {
  if (!base) {
    return null
  }
  const baseBlocks = blocksOf(base)
  const serverBlocks = blocksOf(server)
  const known = new Set(baseBlocks.map((block) => block?.id))
  if (!sameJson(withoutBlocks(base), withoutBlocks(server))) {
    return null
  }
  if (
    !sameJson(
      serverBlocks.filter((block) => known.has(block?.id)),
      baseBlocks,
    )
  ) {
    return null
  }
  return serverBlocks.filter((block) => !known.has(block?.id))
}

// The report with `added` at the end, leaving out any block it already has.
export const withBlocksAdded = (report, added) => {
  const blocks = blocksOf(report)
  const have = new Set(blocks.map((block) => block?.id))
  const missing = added.filter((block) => !have.has(block?.id))
  return missing.length ? { ...report, blocks: [...blocks, ...missing] } : report
}

// What a block is called when it's on its way into a report: the tile's title, or the question in quotes.
export const describeBlock = (block) => {
  const source = block?.source
  if (source?.type === 'tile') {
    return source.snapshot?.tileTitle || S.capture.thisTile
  }
  return source?.query ? S.capture.quoted(source.query) : S.capture.thisAnswer
}

// ---------------------------------------------------------------- what went wrong

// The one line to show for a failed call ('load', 'open', 'save', 'add' or 'delete'), and whether trying again
// later can help: it can when the service couldn't be reached or failed, not when it turned the request down.
export const describeReportError = (error, action) => {
  const known = error instanceof ReportsApiError
  const status = known ? error.status : 0
  const code = known ? error.code : undefined
  const details = known && isObject(error.details) ? error.details : {}
  const E = S.errors
  let reason
  let retry = false
  if (status === 401) {
    reason = E.signedOut
  } else if (code === 'REPORT_NOT_FOUND') {
    reason = E.notFound
  } else if (code === 'INVALID_PROJECT_ID' || code === 'REPORT_PROJECT_REQUIRED') {
    reason = E.noDataSource
  } else if (status === 413 || code === 'REPORT_TOO_LARGE') {
    reason = E.tooLarge
  } else if (code === 'INVALID_REPORT' && details.reason === 'title_too_long') {
    reason = E.titleTooLong(REPORT_TITLE_MAX)
  } else if (code === 'REPORT_ID_CONFLICT') {
    reason = E.otherDataSource
  } else if (status === 0) {
    reason = E.unreachable
    retry = true
  } else if (status >= 500) {
    reason = E.serverFailed
    retry = true
  } else {
    reason = E.refused
  }
  return { message: `${E.lead[action] || E.lead.save}: ${reason}.`, retry }
}

// Whether a failed call was the service turning the token away.
export const isUnauthorized = (error) => error instanceof ReportsApiError && error.status === 401

// Whether a failed call was about a report that isn't there (deleted elsewhere, or someone else's).
export const isReportGone = (error) => error instanceof ReportsApiError && error.code === 'REPORT_NOT_FOUND'
