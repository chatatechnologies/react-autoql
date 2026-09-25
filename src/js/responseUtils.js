import _cloneDeep from 'lodash.clonedeep'

/**
 * Deep-clone a query response, but keep its `rows` by reference.
 *
 * Every response used to be held several times over: the message keeps one, the
 * QueryOutput that renders it deep-clones a second, and Tabulator deep-clones a
 * third. Rows are all but the entirety of that weight, and with eight session tabs
 * of history the copies are what the browser feels.
 *
 * The clone exists to protect the caller's response from the edits QueryOutput makes
 * to `columns`, `fe_req` and `available_selects` — none of which touch `rows`, which
 * is only ever read or wholesale reassigned. So the envelope is still copied and the
 * rows are shared: the isolation that was actually being relied on survives, and the
 * bytes do not multiply.
 *
 * If you ever need to mutate a row in place, clone that row first — or use
 * `_cloneDeep` here instead and say why.
 */
export const cloneResponseSharingRows = (response) => {
  const rows = response?.data?.data?.rows

  if (!Array.isArray(rows)) {
    return _cloneDeep(response)
  }

  // Cloning a response whose rows have been swapped for an empty array walks
  // everything except the rows; putting the original array back afterwards shares it.
  // The input is never mutated, not even briefly.
  const clone = _cloneDeep({
    ...response,
    data: { ...response.data, data: { ...response.data.data, rows: [] } },
  })

  clone.data.data.rows = rows

  return clone
}

/**
 * Does a query response carry an answer we can act on?
 *
 * The backend returns HTTP 200 for a lot of non-answers, so "did the request
 * succeed" is not the same question. All three of these arrive as ordinary
 * response messages:
 *
 *   - a service error   `{ data: {}, message: 'Internal Service Error: …', reference_id: '1.1.555' }`
 *   - a validation miss `{ data: {}, message: '…', reference_id: '1.1.4xx' }`
 *   - a "Did you mean"  `{ data: { items: [...] }, reference_id: '1.1.2xx' }`
 *
 * None of them has columns or rows, so anything that operates on the answer's
 * data (custom toolbar options such as the webapp's "Add to Dashboard...")
 * must not be offered for them.
 *
 * A zero-row answer is deliberately NOT dataless: `{ display_type: 'data',
 * columns: [...], rows: [] }` is a real answer that happens to match nothing
 * today, and it stays a legitimate dashboard tile.
 *
 * Cousin: `isResponseFailed` in `components/Dashboard/Dashboard.js` answers a
 * different question ("is this tile broken?") and so treats a missing response
 * as fine rather than dataless. Keep the two in mind together when the
 * reference-id contract changes.
 */
export const isDatalessResponse = (response) => {
  if (!response) {
    return true
  }

  // Transport-level failures (401 and friends) reach ChatMessage with a status
  // but no usable body.
  if (typeof response.status === 'number' && (response.status < 200 || response.status >= 300)) {
    return true
  }

  const body = response.data
  if (!body || typeof body !== 'object') {
    return true
  }

  // `reference_id` is `<major>.<minor>.<code>`, where `code` mirrors an HTTP
  // status. Anything outside 2xx — including an unparseable id — is an error
  // envelope. Responses with no `reference_id` at all (fixtures, hand-built
  // responses) are judged on their payload alone.
  if (body.reference_id !== undefined && body.reference_id !== null && body.reference_id !== '') {
    const code = Number(String(body.reference_id).split('.')[2])
    if (!(code >= 200 && code < 300)) {
      return true
    }
  }

  const data = body.data
  if (!data || typeof data !== 'object') {
    return true
  }

  // Suggestion list ("Did you mean:") — a prompt for another query, not data.
  if (Array.isArray(data.items)) {
    return true
  }

  return Object.keys(data).length === 0
}
