import normalizePreviewResponse from './previewResponseUtils'

describe('normalizePreviewResponse', () => {
  it('wraps scalar rows into a 2D array and injects columns/query_id', () => {
    const resp = { data: { data: { rows: 42 } } }
    const out = normalizePreviewResponse(resp, [{ field: '0' }])
    expect(Array.isArray(out.data.data.rows)).toBe(true)
    expect(Array.isArray(out.data.data.rows[0])).toBe(true)
    expect(out.data.data.rows[0][0]).toBe(42)
    expect(out.data.data.columns).toBeDefined()
    expect(out.data.data.query_id).toBeDefined()
  })

  it('converts 1D single-value array to 2D when visible columns is 1', () => {
    const resp = { data: { data: { rows: [7], columns: [{ name: 'a' }] } } }
    const out = normalizePreviewResponse(resp, [{ field: '0' }])
    expect(out.data.data.rows[0][0]).toBe(7)
  })

  it('treats 1D array as full row when multiple visible columns', () => {
    const resp = { data: { data: { rows: [1, 2, 3] } } }
    const out = normalizePreviewResponse(resp, [{}, {}, {}])
    expect(Array.isArray(out.data.data.rows)).toBe(true)
    expect(Array.isArray(out.data.data.rows[0])).toBe(true)
    expect(out.data.data.rows[0]).toEqual([1, 2, 3])
  })

  it('provides undefined placeholders for empty rows', () => {
    const resp = { data: { data: { rows: [] } } }
    const out = normalizePreviewResponse(resp, [{}, {}, {}])
    expect(out.data.data.rows.length).toBe(1)
    expect(out.data.data.rows[0].length).toBe(3)
    expect(out.data.data.rows[0].every((v) => v === undefined)).toBe(true)
  })

  it('passes through a proper 2D rows array unchanged', () => {
    const resp = {
      data: {
        data: {
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
      },
    }
    const out = normalizePreviewResponse(resp, [{}, {}])
    expect(out.data.data.rows).toEqual([
      [1, 2],
      [3, 4],
    ])
  })
})
