const { DashboardTile } = require('../src/components/Dashboard/DashboardTile/DashboardTile')

describe('DashboardTile.isServerError', () => {
  const instance = new DashboardTile({ tile: { i: 1, query: '' }, setParamsForTile: () => {} })
  const fn = instance.isServerError.bind(instance)

  test('returns true for numeric 5xx status', () => {
    expect(fn({ status: 502 })).toBe(true)
  })

  test('returns true when message contains internal server error', () => {
    expect(fn({ data: { message: 'Internal Server Error: something went wrong' } })).toBe(true)
  })

  test('returns true when reference_id ends with .500', () => {
    expect(fn({ data: { reference_id: 'abc.def.500' } })).toBe(true)
  })

  test('returns false for non-server responses (200)', () => {
    expect(fn({ status: 200 })).toBe(false)
  })

  test('returns false for empty/unknown response', () => {
    expect(fn({})).toBe(false)
  })
})
