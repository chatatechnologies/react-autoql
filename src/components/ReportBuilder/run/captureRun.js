import { runQuery } from 'autoql-fe-utils'
import { buildQuestionRequest, classifyError } from './reportRun'
import { captureFromResponse, MAX_CHART_ROWS, recaptureFromResponse } from '../model/capture'

// Asks a question once and keeps its answer as a capture (model/capture.js): for a Data block asked in the
// report builder, or a host's "start from a question". Stop it with `signal` (an AbortSignal) or an axios
// `cancelToken`. Never rejects: { ok: true, capture, rows } or { ok: false, reason, error? }, reason being
// 'cancelled', 'error' (the question didn't run or answer with data; error.message says why), 'no-data' or
// 'unsupported'.
//
// Asked again (Rerun), `rerun` is { kept, displayType }: the block's capture, and how the block shows it. The answer
// is kept in those settings (recaptureFromResponse), and asked for in the order its table is sorted by, as the rows
// printed are the first ones in that order. If it can't be asked in that order (a column it sorts by is gone, say),
// it's asked once more without one.
//
// `capturedAt` is when the answer is said to be from: now by default, or when the questions asked together started
// (Rerun all, a report filled in from a template), so they all read as of one time.
export const captureQuestion = ({
  query,
  authentication,
  autoQLConfig,
  signal,
  cancelToken,
  rerun,
  capturedAt,
  runQueryFn = runQuery,
} = {}) => {
  const text = typeof query === 'string' ? query.trim() : ''
  if (!text) {
    return Promise.resolve({ ok: false, reason: 'error', error: { message: 'There’s no question to ask.' } })
  }

  // Up to a chart's worth of rows: how it will be shown isn't known until it answers.
  const request = {
    ...buildQuestionRequest({ query: text, authentication, autoQLConfig }),
    pageSize: MAX_CHART_ROWS,
    cancelToken: signal ?? cancelToken,
  }
  // An aborted request can come back looking like any other failure.
  const cancelled = () => !!signal?.aborted
  const kept = rerun?.kept
  const sort = Array.isArray(kept?.table?.sort) ? kept.table.sort.filter((order) => order?.name) : []

  const ask = (orders) => {
    let asking
    try {
      asking = runQueryFn(orders.length ? { ...request, orders } : request)
    } catch (error) {
      asking = Promise.reject(error)
    }

    return Promise.resolve(asking).then(
      (response) => {
        if (cancelled()) {
          return { ok: false, reason: 'cancelled' }
        }
        const at = capturedAt ? { capturedAt } : {}
        return rerun
          ? recaptureFromResponse(response, { kept, displayType: rerun.displayType, orders, ...at })
          : captureFromResponse(response, at)
      },
      (error) => {
        if (cancelled()) {
          return { ok: false, reason: 'cancelled' }
        }
        const outcome = classifyError(error)
        return outcome.status === 'cancelled'
          ? { ok: false, reason: 'cancelled' }
          : { ok: false, reason: 'error', error: outcome.error }
      },
    )
  }

  return ask(sort).then((result) => (!result.ok && result.reason === 'error' && sort.length ? ask([]) : result))
}
