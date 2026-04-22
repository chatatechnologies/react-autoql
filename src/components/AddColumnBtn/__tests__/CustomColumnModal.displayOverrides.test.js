import { QueryOutput } from '../../QueryOutput/QueryOutput'

describe('CustomColumnModal display_overrides helpers', () => {
  it('deduplicates overrides by normalized SQL signature', () => {
    const qo = new QueryOutput({})
    const firstOverride = { name: 'A', display_name: 'Alpha', table_column: 'A' }
    const secondOverride = { name: 'A', display_name: 'Alpha', table_column: ' A ' }

    const keys = [firstOverride, secondOverride].map((o) => qo.normalizeSqlForOverrideMatch(o.table_column))
    const uniques = [...new Set(keys)]
    expect(uniques.length).toBe(1)
  })

  it('normalizes display_override table_column for signature', () => {
    const qo = new QueryOutput({})
    const badOverride = { name: 'Tot', display_name: 'Total', table_column: 'tot' }
    const sig = qo.normalizeSqlForOverrideMatch(badOverride.table_column)
    expect(sig).toContain('tot')
  })

  it('applyDisplayOverridesToResponse returns original response when provided invalid overrides', () => {
    const qo = new QueryOutput({})
    const response = { data: { data: { columns: [{ name: 'A' }], fe_req: { display_overrides: null } } } }
    const next = qo.applyDisplayOverridesToResponse(response, response.data.data.fe_req.display_overrides)
    expect(next).toBe(response)
  })
})
