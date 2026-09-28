import { cloneResponseSharingRows, getResponseRowCount, isDatalessResponse, withPreviewRows } from './responseUtils'

// The saving is the rows; the isolation that callers rely on is everything else.
// QueryOutput edits columns, fe_req and available_selects on its own copy and must
// not reach the message's response through them — but it only ever reads rows.
describe('cloneResponseSharingRows', () => {
  const makeResponse = () => ({
    data: {
      message: 'Success',
      reference_id: '1.1.210',
      data: {
        query_id: 'abc',
        columns: [{ name: 'amount', is_visible: true }],
        fe_req: { filters: [] },
        rows: [[1], [2], [3]],
      },
    },
  })

  test('shares the rows array rather than copying it', () => {
    const response = makeResponse()
    const clone = cloneResponseSharingRows(response)

    expect(clone.data.data.rows).toBe(response.data.data.rows)
  })

  test('copies everything else, so edits to the clone do not reach the original', () => {
    const response = makeResponse()
    const clone = cloneResponseSharingRows(response)

    expect(clone.data.data.columns).not.toBe(response.data.data.columns)
    expect(clone.data.data).toEqual(response.data.data)

    clone.data.data.columns[0].is_visible = false
    clone.data.data.fe_req = { filters: ['changed'] }
    clone.data.data.available_selects = ['new']

    expect(response.data.data.columns[0].is_visible).toBe(true)
    expect(response.data.data.fe_req).toEqual({ filters: [] })
    expect(response.data.data.available_selects).toBeUndefined()
  })

  test('replacing the rows on the clone leaves the original pointing at its own array', () => {
    const response = makeResponse()
    const originalRows = response.data.data.rows
    const clone = cloneResponseSharingRows(response)

    clone.data.data.rows = [[9]]

    expect(response.data.data.rows).toBe(originalRows)
  })

  test('falls back to a full deep clone when there are no rows to share', () => {
    const suggestionResponse = { data: { reference_id: '1.1.210', data: { items: ['did you mean'] } } }
    const clone = cloneResponseSharingRows(suggestionResponse)

    expect(clone).toEqual(suggestionResponse)
    expect(clone.data.data.items).not.toBe(suggestionResponse.data.data.items)
  })

  test('handles a response with no payload at all', () => {
    expect(cloneResponseSharingRows(undefined)).toBeUndefined()
    expect(cloneResponseSharingRows({})).toEqual({})
  })
})

// The contract that matters at the call site (ChatMessage deciding whether to
// offer custom toolbar options such as "Add to Dashboard..."): a message only
// counts as having data if there is an actual answer payload behind it. The
// backend answers 200 for errors, failed validations and suggestion lists, so
// the reference id and the `data` payload — not the HTTP status — decide.
describe('isDatalessResponse', () => {
  const dataResponse = {
    data: {
      message: 'Success',
      reference_id: '1.1.210',
      data: {
        display_type: 'data',
        columns: [{ name: 'amount', is_visible: true }],
        rows: [[1]],
      },
    },
  }

  test('a normal data answer has data', () => {
    expect(isDatalessResponse(dataResponse)).toBe(false)
  })

  test('a zero-row answer still has data — it is a real answer that matched nothing', () => {
    const noRows = { data: { ...dataResponse.data, data: { ...dataResponse.data.data, rows: [] } } }

    expect(isDatalessResponse(noRows)).toBe(false)
  })

  // The reported bug: this exact envelope was still offering "Add to Dashboard...".
  test('the 1.1.555 internal service error is dataless', () => {
    const response = {
      data: {
        data: {},
        message:
          "Internal Service Error: Our system is experiencing an unexpected error. We're aware of this issue and are working to fix it as soon as possible.",
        reference_id: '1.1.555',
      },
    }

    expect(isDatalessResponse(response)).toBe(true)
  })

  // QueryOutput.hasError uses this same non-2xx reference-id rule to decide it must render
  // an error body instead of an answer, so anything it shows as an error has to be dataless
  // here too — otherwise the toolbar and the message body disagree about whether there is an
  // answer, which is exactly the reported bug. Note these envelopes carry a `message` and no
  // `data` key at all, which is how the UMS returns them.
  test.each([
    ['1.1.400 invalid request parameters', '1.1.400'],
    ['1.1.401 unauthenticated', '1.1.401'],
    ['1.1.530 invalid query id', '1.1.530'],
    ['1.1.555 internal service error', '1.1.555'],
  ])('%s is dataless', (_label, referenceId) => {
    expect(isDatalessResponse({ data: { message: 'Invalid Query Id', reference_id: referenceId } })).toBe(true)
  })

  test('a 4xx reference id is dataless even when the request itself returned 200', () => {
    expect(isDatalessResponse({ status: 200, data: { data: {}, reference_id: '1.1.400' } })).toBe(true)
  })

  test('an unparseable reference id is dataless', () => {
    expect(isDatalessResponse({ data: { data: {}, reference_id: 'garbage' } })).toBe(true)
  })

  test('a "Did you mean" suggestion list is dataless — it prompts for another query', () => {
    const suggestions = {
      data: { reference_id: '1.1.211', data: { items: ['total revenue', 'total revenue last month'] } },
    }

    expect(isDatalessResponse(suggestions)).toBe(true)
  })

  test('an empty suggestion list is dataless too', () => {
    expect(isDatalessResponse({ data: { reference_id: '1.1.211', data: { items: [] } } })).toBe(true)
  })

  test('a non-2xx transport status is dataless', () => {
    expect(isDatalessResponse({ status: 401, data: { data: {} } })).toBe(true)
  })

  test('a response with no reference id is judged on its payload alone', () => {
    expect(isDatalessResponse({ data: { data: { columns: [], rows: [] } } })).toBe(false)
    expect(isDatalessResponse({ data: { data: {} } })).toBe(true)
  })

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty object', {}],
    ['a missing body', { status: 200 }],
    ['a non-object body', { data: 'Internal Server Error' }],
    ['a non-object data payload', { data: { reference_id: '1.1.210', data: 'nope' } }],
  ])('%s is dataless', (_label, response) => {
    expect(isDatalessResponse(response)).toBe(true)
  })
})

// Truncation may only drop rows: QueryOutput.queryFn rebuilds the request from fe_req,
// so anything else it removed would make the answer unrecoverable rather than
// truncated.
describe('withPreviewRows', () => {
  const makeResponse = (rowCount, extra = {}) => ({
    data: {
      message: 'Success',
      reference_id: '1.1.210',
      data: {
        query_id: 'abc',
        text: 'total revenue by region',
        columns: [{ name: 'region' }, { name: 'revenue' }],
        fe_req: { text: 'total revenue by region', orders: [], session_filter_locks: [] },
        rows: Array.from({ length: rowCount }, (_, i) => [`r${i}`, i]),
        ...extra,
      },
    },
  })

  test('slices the rows to the preview count', () => {
    const truncated = withPreviewRows(makeResponse(500), 10)

    expect(truncated.data.data.rows).toHaveLength(10)
    expect(truncated.data.data.rows[0]).toEqual(['r0', 0])
  })

  test('keeps everything the rerun needs', () => {
    const response = makeResponse(500)
    const truncated = withPreviewRows(response, 10)

    expect(truncated.data.data.fe_req).toEqual(response.data.data.fe_req)
    expect(truncated.data.data.query_id).toBe('abc')
    expect(truncated.data.data.columns).toEqual(response.data.data.columns)
    expect(truncated.data.data.text).toBe('total revenue by region')
    expect(truncated.data.reference_id).toBe('1.1.210')
  })

  test('records the real row count so the notice can name it', () => {
    expect(withPreviewRows(makeResponse(500), 10).data.data.count_rows).toBe(500)
  })

  test('does not overwrite a count_rows the response already carried', () => {
    // A data-limited answer's count_rows is the true total, not the page size.
    const truncated = withPreviewRows(makeResponse(500, { count_rows: 25000 }), 10)

    expect(truncated.data.data.count_rows).toBe(25000)
  })

  test('does not mutate the response it was given', () => {
    const response = makeResponse(500)
    withPreviewRows(response, 10)

    expect(response.data.data.rows).toHaveLength(500)
  })

  test('returns the response untouched when there is nothing to truncate', () => {
    const small = makeResponse(4)
    expect(withPreviewRows(small, 10)).toBe(small)

    const exact = makeResponse(10)
    expect(withPreviewRows(exact, 10)).toBe(exact)
  })

  test('returns non-data responses untouched', () => {
    const suggestions = { data: { reference_id: '1.1.211', data: { items: ['did you mean'] } } }
    expect(withPreviewRows(suggestions, 10)).toBe(suggestions)
    expect(withPreviewRows(undefined, 10)).toBeUndefined()
  })
})

describe('getResponseRowCount', () => {
  test('counts rows, and answers zero for anything without them', () => {
    expect(getResponseRowCount({ data: { data: { rows: [[1], [2]] } } })).toBe(2)
    expect(getResponseRowCount({ data: { data: {} } })).toBe(0)
    expect(getResponseRowCount(undefined)).toBe(0)
  })
})
