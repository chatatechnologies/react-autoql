import { buildPermissionsDetailsFromRow } from 'autoql-fe-utils'

describe('buildPermissionsDetailsFromRow', () => {
  test('converts object-mapped row into permissions.details entries', () => {
    const columns = [{ name: 'id' }, { name: 'created_at', type: 'date' }, { name: 'name' }]

    const date = new Date('2020-01-02T03:04:05.000Z')
    const row = { id: 42, created_at: date, name: 'Alice' }

    const result = buildPermissionsDetailsFromRow(columns, row)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ insertion: 'OPTIONAL', columns: ['id'], op: '=', values: ['42'] })
    expect(result[1].columns).toEqual(['created_at'])
    expect(result[1].op).toBe('=')
    expect(result[1].values[0]).toBe(date.toISOString())
    expect(result[2]).toEqual({ insertion: 'OPTIONAL', columns: ['name'], op: '=', values: ['Alice'] })
  })

  test('handles null and undefined values', () => {
    const columns = [{ name: 'a' }, { name: 'b' }]
    const row = { a: null, b: undefined }
    const res = buildPermissionsDetailsFromRow(columns, row)
    expect(res[0]).toEqual({ insertion: 'OPTIONAL', columns: ['a'], op: 'is', values: ['NULL'] })
    expect(res[1]).toEqual({ insertion: 'OPTIONAL', columns: ['b'], op: 'is', values: ['NULL'] })
  })

  test('handles array-form rows', () => {
    const columns = [{ name: 'x' }, { name: 'y' }]
    const row = [10, 'foo']
    const res = buildPermissionsDetailsFromRow(columns, row)
    expect(res[0].values[0]).toBe('10')
    expect(res[1].values[0]).toBe('foo')
  })

  test('handles string date values', () => {
    const columns = [{ name: 'd', type: 'date' }]
    const row = { d: '2021-05-06' }
    const res = buildPermissionsDetailsFromRow(columns, row)
    expect(res[0].op).toBe('=')
    expect(res[0].values[0]).toBe('2021-05-06')
  })
})
