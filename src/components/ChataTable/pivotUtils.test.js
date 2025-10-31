import { sanitizePivotOptions } from './pivotUtils'

describe('sanitizePivotOptions', () => {
  afterEach(() => {
    try {
      delete global.LOCAL_OR_REMOTE
    } catch (e) {
      // ignore
    }
  })

  test('returns a deep clone when isPivot is false', () => {
    const input = { a: 1, nested: { b: 2 } }
    const out = sanitizePivotOptions(input, false)

    expect(out).toEqual(input)
    // ensure it's a deep clone, not the same reference
    expect(out).not.toBe(input)
    expect(out.nested).not.toBe(input.nested)
  })

  test('removes ajax/pagination keys and sets local modes when LOCAL_OR_REMOTE is provided', () => {
    global.LOCAL_OR_REMOTE = { LOCAL: 'local' }

    const input = {
      ajaxRequestFunc: () => {},
      ajaxURL: 'https://example.com',
      paginationMode: 'remote',
      sortMode: 'remote',
    }

    const out = sanitizePivotOptions(input, true)

    expect(out.ajaxRequestFunc).toBeUndefined()
    expect(out.ajaxURL).toBeUndefined()
    expect(out.paginationMode).toBe('local')
    expect(out.sortMode).toBe('local')
  })

  test('removes ajax/pagination keys when LOCAL_OR_REMOTE is not defined but does not force modes', () => {
    // ensure LOCAL_OR_REMOTE is not defined
    try {
      delete global.LOCAL_OR_REMOTE
    } catch (e) {}

    const input = {
      ajaxRequestFunc: () => {},
      ajaxURL: 'https://example.com',
    }

    const out = sanitizePivotOptions(input, true)

    expect(out.ajaxRequestFunc).toBeUndefined()
    expect(out.ajaxURL).toBeUndefined()
    // modes should not be injected by the util when LOCAL_OR_REMOTE is missing
    expect(out.sortMode).toBeUndefined()
    expect(out.filterMode).toBeUndefined()
  })
})
