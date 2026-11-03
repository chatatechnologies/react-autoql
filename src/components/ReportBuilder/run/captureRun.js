import { runQuery } from 'autoql-fe-utils'
import { buildQuestionRequest, classifyError } from './reportRun'
import { captureFromResponse, MAX_CHART_ROWS } from '../model/capture'

// Asks a question once and keeps its answer as a capture (model/capture.js): for a Data block asked in the
// report builder, or a host's "start from a question". Stop it with `signal` (an AbortSignal) or an axios
// `cancelToken`. Never rejects: { ok: true, capture, rows } or { ok: false, reason, error? }, reason being
// 'cancelled', 'error' (the question didn't run or answer with data; error.message says why), 'no-data' or
// 'unsupported'.
export const captureQuestion = ({
  query,
  authentication,
  autoQLConfig,
  signal,
  cancelToken,
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

  let asking
  try {
    asking = runQueryFn(request)
  } catch (error) {
    asking = Promise.reject(error)
  }

  return Promise.resolve(asking).then(
    (response) => (cancelled() ? { ok: false, reason: 'cancelled' } : captureFromResponse(response)),
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
