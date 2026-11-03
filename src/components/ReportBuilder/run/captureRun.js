import { runQuery } from 'autoql-fe-utils'
import { buildQuestionRequest, classifyError } from './reportRun'
import { captureFromResponse, MAX_CHART_ROWS, recaptureFromResponse } from '../model/capture'

// Whether the query service turned a request down as it was asked (400 or 422, by its status or reference id),
// rather than failing to answer it (a 5xx, a timeout, the network) or not letting the user ask (401, 403, 429).
const turnedDown = (error) => {
  const status = error?.status ?? error?.response?.status
  const referenceId = error?.data?.reference_id ?? error?.response?.data?.reference_id
  const code = typeof referenceId === 'string' ? Number(referenceId.split('.').pop()) : undefined
  return [status, code].some((value) => value === 400 || value === 422)
}

// Asks a question once and keeps its answer as a capture (model/capture.js): for a Data block asked in the
// report builder, or a host's "start from a question". Stop it with `signal` (an AbortSignal) or an axios
// `cancelToken`. Never rejects: { ok: true, capture, rows } or { ok: false, reason, error? }, reason being
// 'cancelled', 'error' (the question didn't run or answer with data; error.message says why), 'no-data' or
// 'unsupported'.
//
// Asked again (Rerun), `rerun` is { kept, displayType, current? }: the block's capture, and how the block shows it.
// The answer is kept in those settings (recaptureFromResponse), as `current()` says them when it comes, if it's
// given (they may have changed while it was asked, by an undo say). It's asked for in the order its table is sorted
// by, as the rows printed are the first ones in that order, but not by a column added on screen (a custom column,
// kept with "Add to Report…"), which the question doesn't answer with. If the service turns that order down (a
// column it sorts by is gone, say), it's asked once more without one; any other failure is the answer, as asking
// again wouldn't help, and an answer that came back unsorted would drop the table's sort for good.
export const captureQuestion = ({
  query,
  authentication,
  autoQLConfig,
  signal,
  cancelToken,
  rerun,
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
  const keptColumns = Array.isArray(kept?.data?.columns) ? kept.data.columns : null
  // Without the answer it kept (a block of a report made from a template), every column it sorts by is asked for.
  const asked = (order) => {
    if (!order?.name) {
      return false
    }
    const column = keptColumns ? keptColumns.find((col) => col?.name === order.name) : {}
    return !!column && !column.custom
  }
  const sort = Array.isArray(kept?.table?.sort) ? kept.table.sort.filter(asked) : []
  let sortTurnedDown = false

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
        if (!rerun) {
          return captureFromResponse(response)
        }
        const settings = (typeof rerun.current === 'function' && rerun.current()) || rerun
        return recaptureFromResponse(response, { kept: settings.kept, displayType: settings.displayType, orders })
      },
      (error) => {
        if (cancelled()) {
          return { ok: false, reason: 'cancelled' }
        }
        const outcome = classifyError(error)
        if (outcome.status === 'cancelled') {
          return { ok: false, reason: 'cancelled' }
        }
        sortTurnedDown = orders.length > 0 && turnedDown(error)
        return { ok: false, reason: 'error', error: outcome.error }
      },
    )
  }

  return ask(sort).then((result) => (sortTurnedDown ? ask([]) : result))
}
