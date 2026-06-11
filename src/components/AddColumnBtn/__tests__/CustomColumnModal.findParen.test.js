import CustomColumnModal from '../CustomColumnModal'

describe('CustomColumnModal parsing helpers', () => {
  test('findMatchingParen handles nested COALESCE/NULLIF without truncation', () => {
    const instance = new CustomColumnModal({ columns: [], queryResponse: { data: { data: { available_selects: [] } } } })

    const sql = `(COALESCE(avg(dbo.HistoricalGameOddComb.spread_profit) / NULLIF(100, 0), 0) * 100 + COALESCE(avg(dbo.HistoricalGameOddComb.spread_profit) / NULLIF(100, 0), 0) * 100 - COALESCE(avg(dbo.HistoricalGameOddComb.spread_profit) / NULLIF(100, 0), 0) * 100 * COALESCE(avg(dbo.HistoricalGameOddComb.spread_profit) / NULLIF(100, 0), 0) * COALESCE(COAL / NULLIF(SCE(100 / avg(dbo.HistoricalGameOddComb.spread_profit) / NULLIF(100, 0), 0), 0), 0) * 100)`

    const lower = sql.toLowerCase()
    const coIdx = lower.indexOf('coalesce(')
    expect(coIdx).toBeGreaterThanOrEqual(0)

    const openIdx = coIdx + 'coalesce'.length
    const closeIdx = instance.findMatchingParen(sql, openIdx)
    expect(closeIdx).toBeGreaterThan(openIdx)

    const inner = sql.substring(openIdx + 1, closeIdx)
    // The parsing should not leave truncated tokens like 'COAL' or 'SCE' as standalone artifacts
    expect(inner).not.toMatch(/\bCOAL\b/)
    expect(inner).not.toMatch(/\bSCE\b/)
  })
})
