import { createReport, fetchReport, ReportsApiError, saveReport } from '../run/reportsApi'
import { SAVE_DELAY_MS } from './constants'
import {
  blocksAddedOnServer,
  describeReportError,
  isTitleTooLong,
  isUnauthorized,
  REPORT_TITLE_MAX,
  sameJson,
  stripQueryResponses,
  withBlocksAdded,
} from './documents'
import { REPORTS_STRINGS } from './strings'

// Saves one open report to AutoQL's report service: after a pause in editing, or at once on flush() — Save,
// ⌘S / Ctrl+S, switching reports, leaving the page — one write at a time.
//
// Each save sends the whole report with the version it was read at. A version conflict means the stored copy moved
// on. When all that changed there is blocks added at the end ("Add to Report…" from another page or tab), they're
// added to the open report too and it saves again, so neither side is lost. Any other change means the report was
// edited somewhere else as well: saving stops, and the workspace offers to reload it (`conflict`).
//
// A save that couldn't reach the service, or that the service failed, stays pending and is retried after a growing
// pause. One the service turned down (too large, a title over the limit, a report deleted elsewhere, a token it
// wouldn't take) waits for the next edit or Save, or for retry() once the host has new credentials.
//
// Options: id; stored (what the service has, { report, version, updatedAt }, or null for a report it doesn't have
// yet); report (as the page has it: the stored copy, or a new report's first draft); delayMs (the pause);
// getAuthentication (the AutoQL authentication for the report's data source, asked for on every request because the
// host re-mints tokens); onState(state); onMerged(report), when blocks added elsewhere were merged in and the page
// should show this copy; onUnauthorized(), when the service turned the token away; folderId (the folder a report the
// service doesn't have yet is created in; none by default); api (the service's calls, for tests).
//
// A state is { status, error, savedAt }: status one of SAVE_STATUSES, error the line to show while it's failed or in
// conflict, savedAt when the service last stored the report (ISO), null until it has.

export const SAVE_STATUSES = ['saved', 'saving', 'failed', 'conflict']

export const CONFLICT_MESSAGE = REPORTS_STRINGS.save.conflict

const TITLE_TOO_LONG = `${REPORTS_STRINGS.errors.lead.save}: ${REPORTS_STRINGS.errors.titleTooLong(REPORT_TITLE_MAX)}.`

// The pauses before a failed save is tried again: longer each time it fails in a row, then the last one over and over.
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000]

// Appends landing between a refetch and the save after it: merge this many times in a row at most.
const MAX_MERGES = 3

const SERVICE = { createReport, saveReport, fetchReport }

const isVersionConflict = (error) =>
  error instanceof ReportsApiError && error.status === 409 && error.code === 'REPORT_VERSION_CONFLICT'

// No answer came (the service couldn't be reached), or the service failed: the write may have been stored anyway.
const isUnconfirmed = (error) => error instanceof ReportsApiError && (error.status === 0 || error.status >= 500)

export class ReportSaver {
  constructor(options) {
    const { id, stored, report, delayMs, api } = options
    this.options = options
    this.id = id
    this.delayMs = delayMs ?? SAVE_DELAY_MS
    this.api = api || SERVICE
    this.local = report
    // The stored copy as last seen, without query responses: what a version conflict is compared with.
    this.base = stored ? stripQueryResponses(stored.report) : null
    // A write whose answer never came: it may have been stored all the same.
    this.unconfirmed = null
    this.version = stored ? stored.version : null
    // Bumped by every edit; savedEdits is its value as of the last write the service confirmed. A report the
    // service doesn't have yet has something to save: itself.
    this.edits = 0
    this.savedEdits = stored ? 0 : -1
    this.inflight = null
    this.timer = null
    this.retries = 0
    this.disposed = false
    this.state = { status: stored ? 'saved' : 'saving', error: null, savedAt: stored?.updatedAt ?? null }
  }

  // The report with every edit, and any blocks merged in.
  get report() {
    return this.local
  }

  // The state as last reported.
  get current() {
    return this.state
  }

  // Whether the service has the report at all (not necessarily the latest edits).
  get created() {
    return this.version !== null
  }

  // Edits the service doesn't have yet, or a write still on its way.
  get hasUnsaved() {
    return this.dirty || this.inflight !== null
  }

  // Edits the service hasn't confirmed.
  get dirty() {
    return this.edits !== this.savedEdits
  }

  // The report as the page now has it: saved once editing pauses.
  edit(report) {
    if (this.disposed) {
      return
    }
    this.local = report
    this.edits += 1
    if (this.state.status === 'conflict') {
      return
    }
    this.setState({ status: 'saving', error: null })
    this.schedule(this.delayMs)
  }

  // Saves what's waiting, now. True once the service has everything; false when a save failed or can't happen.
  // `keepalive` when the page is going away (reload, close, sign-out), so a save that starts now outlives it.
  async flush({ keepalive = false } = {}) {
    this.clearTimer()
    for (;;) {
      if (this.inflight) {
        await this.inflight
        continue
      }
      if (this.disposed || this.state.status === 'conflict') {
        return false
      }
      if (!this.dirty) {
        return true
      }
      if (!(await this.send(keepalive))) {
        return false
      }
    }
  }

  // After a failure, saves at once: for when the host has new credentials. Resolves as flush() does, or, with
  // nothing failed to save, with whether the service has everything.
  retry() {
    if (this.state.status === 'failed' && this.hasUnsaved) {
      return this.flush()
    }
    return Promise.resolve(!this.hasUnsaved)
  }

  // Lets a write on its way finish, and holds any that were waiting (before the report is deleted).
  async settle() {
    while (this.inflight) {
      await this.inflight
    }
    this.clearTimer()
  }

  // Nothing more is sent (a write on its way still lands) and nothing more is reported, not even a token turned away.
  dispose() {
    this.disposed = true
    this.clearTimer()
  }

  schedule(ms) {
    this.clearTimer()
    if (this.disposed) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      // One on its way reschedules when it's done if there's more to save.
      if (this.inflight || this.disposed || this.state.status === 'conflict' || !this.dirty) {
        return
      }
      this.send()
    }, ms)
  }

  clearTimer() {
    if (this.timer === null) {
      return
    }
    clearTimeout(this.timer)
    this.timer = null
  }

  setState(change) {
    this.state = { ...this.state, ...change }
    if (!this.disposed) {
      this.options.onState?.(this.state)
    }
  }

  // Asked for on every request, never kept: the host re-mints tokens, so one from an earlier request may be stale.
  authentication() {
    return this.options.getAuthentication?.()
  }

  send(keepalive) {
    const run = this.write(keepalive).finally(() => {
      this.inflight = null
    })
    this.inflight = run
    return run
  }

  async write(keepalive) {
    const edits = this.edits
    if (isTitleTooLong(this.local)) {
      this.fail(TITLE_TOO_LONG, false, edits)
      return false
    }
    let body = stripQueryResponses(this.local)
    // Only when asked, so an ordinary save's call doesn't name keepalive at all.
    const sendOptions = keepalive ? { keepalive: true } : {}
    this.setState({ status: 'saving', error: null })
    try {
      if (this.version === null) {
        const created = await this.api.createReport({
          authentication: this.authentication(),
          id: this.id,
          report: body,
          ...(this.options.folderId ? { folderId: this.options.folderId } : {}),
          ...sendOptions,
        })
        this.version = created.version
        this.base = created.report
        // A retried create gets back what was stored the first time, which may be older than this.
        if (sameJson(created.report, body)) {
          this.savedEdits = edits
        }
        this.succeed(created.updatedAt)
        return true
      }

      for (let merges = 0; ; merges += 1) {
        try {
          const saved = await this.api.saveReport({
            authentication: this.authentication(),
            id: this.id,
            report: body,
            version: this.version,
            ...sendOptions,
          })
          this.version = saved.version
          this.base = body
          this.unconfirmed = null
          this.savedEdits = edits
          this.succeed(saved.updatedAt)
          return true
        } catch (error) {
          if (!isVersionConflict(error) || merges >= MAX_MERGES) {
            throw error
          }
        }

        const latest = await this.api.fetchReport({ authentication: this.authentication(), id: this.id })
        const added = this.addedSince(latest.report)
        if (added === null) {
          this.conflict()
          return false
        }
        this.version = latest.version
        this.base = latest.report
        this.unconfirmed = null
        if (added.length > 0) {
          body = withBlocksAdded(body, added)
          this.local = withBlocksAdded(this.local, added)
          if (!this.disposed) {
            this.options.onMerged?.(this.local)
          }
        }
        if (sameJson(body, latest.report)) {
          // Stored already: a write of ours whose answer never came.
          this.savedEdits = edits
          this.succeed(latest.updatedAt)
          return true
        }
      }
    } catch (error) {
      if (isUnconfirmed(error)) {
        this.unconfirmed = body
      }
      const { message, retry } = describeReportError(error, 'save')
      this.fail(message, retry, edits)
      // Once the failure shows, so the host can ask for new credentials and then retry().
      if (isUnauthorized(error) && !this.disposed) {
        this.options.onUnauthorized?.()
      }
      return false
    }
  }

  // Blocks the stored copy gained since the copy we know — or since a write of ours that may have landed.
  addedSince(server) {
    for (const known of [this.base, this.unconfirmed]) {
      const added = blocksAddedOnServer(known, server)
      if (added !== null) {
        return added
      }
    }
    return null
  }

  succeed(savedAt) {
    this.retries = 0
    this.setState({ status: this.dirty ? 'saving' : 'saved', error: null, savedAt: savedAt || this.state.savedAt })
    if (this.dirty) {
      this.schedule(this.delayMs)
    }
  }

  fail(message, retry, editsAtStart) {
    const delay = RETRY_DELAYS_MS[Math.min(this.retries, RETRY_DELAYS_MS.length - 1)]
    this.setState({ status: 'failed', error: retry ? `${message} ${REPORTS_STRINGS.save.retrying}` : message })
    if (retry) {
      this.retries += 1
      this.schedule(delay)
    } else if (this.edits !== editsAtStart) {
      // Edits made while it was on its way may fix what the service turned down.
      this.schedule(this.delayMs)
    }
  }

  conflict() {
    this.clearTimer()
    this.setState({ status: 'conflict', error: CONFLICT_MESSAGE })
  }
}
