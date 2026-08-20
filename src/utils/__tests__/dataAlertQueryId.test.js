import { getPinnableQueryId, MIN_PINNABLE_PAGE_SIZE } from '../dataAlertQueryId'

const buildResponse = ({ queryId = 'q1', pageSize = MIN_PINNABLE_PAGE_SIZE } = {}) => ({
  data: { data: { query_id: queryId, fe_req: { page_size: pageSize } } },
})

describe('getPinnableQueryId', () => {
  it('returns the query id for a full sized query run', () => {
    expect(getPinnableQueryId(buildResponse({ pageSize: 50000 }))).toBe('q1')
  })

  it('returns the query id when the page size exactly matches the evaluation page size', () => {
    expect(getPinnableQueryId(buildResponse({ pageSize: MIN_PINNABLE_PAGE_SIZE }))).toBe('q1')
  })

  it('does not pin an id from the two row validation runs the alert builder uses', () => {
    expect(getPinnableQueryId(buildResponse({ pageSize: 2 }))).toBeUndefined()
  })

  it('does not pin an id when the page size is unknown', () => {
    expect(getPinnableQueryId({ data: { data: { query_id: 'q1' } } })).toBeUndefined()
  })

  it('returns undefined when there is no query id', () => {
    const response = { data: { data: { fe_req: { page_size: 50000 } } } }
    expect(getPinnableQueryId(response)).toBeUndefined()
  })

  it('handles missing or malformed responses', () => {
    expect(getPinnableQueryId(undefined)).toBeUndefined()
    expect(getPinnableQueryId({})).toBeUndefined()
    expect(getPinnableQueryId({ data: {} })).toBeUndefined()
  })
})
