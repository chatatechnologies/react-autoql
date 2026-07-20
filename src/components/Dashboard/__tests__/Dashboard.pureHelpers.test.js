import { isResponseFailed, isTileFailed, isTileDirty } from '../Dashboard'

describe('isResponseFailed', () => {
  test('returns false for no response', () => {
    expect(isResponseFailed(undefined)).toBe(false)
  })

  test('returns true when response has disambiguation items', () => {
    expect(isResponseFailed({ data: { data: { items: ['a'] } } })).toBe(true)
  })

  test('returns false for a 2xx reference_id', () => {
    expect(isResponseFailed({ data: { reference_id: '1.1.200', data: {} } })).toBe(false)
  })

  test('returns true for a non-2xx reference_id', () => {
    expect(isResponseFailed({ data: { reference_id: '1.1.400', data: {} } })).toBe(true)
  })

  test('returns true for a malformed reference_id', () => {
    expect(isResponseFailed({ data: { reference_id: 'garbage', data: {} } })).toBe(true)
  })
})

describe('isTileFailed', () => {
  const successResponse = { data: { reference_id: '1.1.200', data: {} } }
  const errorResponse = { data: { reference_id: '1.1.400', data: {} } }

  test('false when queryResponse succeeds and there is no secondQuery', () => {
    expect(isTileFailed({ queryResponse: successResponse })).toBe(false)
  })

  test('true when queryResponse fails', () => {
    expect(isTileFailed({ queryResponse: errorResponse })).toBe(true)
  })

  test('true when top query succeeds but secondQueryResponse fails', () => {
    expect(isTileFailed({ queryResponse: successResponse, secondQuery: 'q2', secondQueryResponse: errorResponse })).toBe(true)
  })

  test('secondQueryResponse failure is ignored without a secondQuery', () => {
    expect(isTileFailed({ queryResponse: successResponse, secondQueryResponse: errorResponse })).toBe(false)
  })
})

describe('isTileDirty', () => {
  const savedTile = { query: 'sales by region', queryId: 'qid-original' }

  test('false when there is no saved tile (new tile)', () => {
    expect(isTileDirty({ query: 'anything' }, undefined, {})).toBe(false)
  })

  test('true when queryResponse has replacements', () => {
    const tile = { query: savedTile.query, queryResponse: { data: { data: { replacements: [{ text: 'x' }] } } } }
    expect(isTileDirty(tile, savedTile, {})).toBe(true)
  })

  test('true when secondQueryResponse has items', () => {
    const tile = { query: savedTile.query, secondQueryResponse: { data: { data: { items: ['x'] } } } }
    expect(isTileDirty(tile, savedTile, {})).toBe(true)
  })

  test('true when query text changed and queryId still matches the pre-edit baseline', () => {
    const tile = { query: 'sales by product', queryId: 'qid-original' }
    expect(isTileDirty(tile, savedTile, { queryId: 'qid-original' })).toBe(true)
  })

  test('false when query text changed but queryId already reflects a re-run', () => {
    const tile = { query: 'sales by product', queryId: 'qid-new' }
    expect(isTileDirty(tile, savedTile, { queryId: 'qid-original' })).toBe(false)
  })

  test('false when query text is unchanged', () => {
    const tile = { query: savedTile.query, queryId: 'qid-original' }
    expect(isTileDirty(tile, savedTile, { queryId: 'qid-original' })).toBe(false)
  })
})
