import { isDatalessResponse } from './responseUtils'

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
