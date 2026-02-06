import axios from 'axios'
import { REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'

export const DEFAULT_ABORT_REASON = REQUEST_CANCELLED_ERROR || 'Operation canceled'

export function createAbortController() {
  return new AbortController()
}

// Create an AbortController paired with an axios CancelToken for back-compat
export function createCancelPair(reason = DEFAULT_ABORT_REASON) {
  const controller = new AbortController()
  let cancelToken
  let cancel
  if (typeof axios?.CancelToken?.source === 'function') {
    const source = axios.CancelToken.source()
    cancelToken = source.token
    cancel = source.cancel
    // When the AbortController is aborted, also cancel the axios CancelToken
    controller.signal.addEventListener('abort', (ev) => {
      try {
        cancel(ev?.reason || reason)
      } catch (e) {
        // ignore
      }
    })
  }

  // Return a small, stable shape used by callers:
  // { controller, signal, cancelToken, cancel, abort }
  const abort = (r = reason) => controller.abort(r)

  return { controller, signal: controller.signal, cancelToken, cancel, abort }
}

export function isAbortError(error) {
  return (
    error?.name === 'CanceledError' ||
    error?.code === 'ERR_CANCELED' ||
    error?.message === REQUEST_CANCELLED_ERROR ||
    error?.data?.message === REQUEST_CANCELLED_ERROR ||
    error?.response?.data?.message === REQUEST_CANCELLED_ERROR
  )
}
