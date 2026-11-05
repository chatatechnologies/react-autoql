import { filterLocksKey, normalizeFilterLocks, summarizeFilterLocks } from '../model/filterLocks'
import { createEmptyReport, normalizeReport } from '../model/reportSchema'
import { setSessionFilterLocks } from '../model/reportOperations'

// A report's filter lock (RW-351): the AutoQL session filter locks every question in it is asked with, kept at its
// root as `sessionFilterLocks` in the shape FilterLockPopover makes them.

const BROWN = {
  key: 'household',
  value: 'Brown Family',
  filter_type: 'include',
  canonical_key: 'household_name',
  format_txt: 'Brown Family',
  show_message: 'Household',
}
const NGUYEN = { ...BROWN, value: 'Nguyen Family', format_txt: 'Nguyen Family' }

describe('normalizeFilterLocks', () => {
  it('keeps what the query API reads and what is shown, and drops the picker’s own flag', () => {
    expect(normalizeFilterLocks([{ ...BROWN, isSession: true, extra: 1 }])).toStrictEqual([BROWN])
  })

  it('drops anything that isn’t a lock', () => {
    expect(
      normalizeFilterLocks([
        null,
        'Brown',
        { value: 'Brown' },
        { key: 'household' },
        { key: 'household', value: '' },
        BROWN,
      ]),
    ).toStrictEqual([BROWN])
    expect(normalizeFilterLocks(undefined)).toStrictEqual([])
    expect(normalizeFilterLocks({ ...BROWN })).toStrictEqual([])
  })
})

describe('summarizeFilterLocks', () => {
  it('reads as the first value and how many more', () => {
    expect(summarizeFilterLocks([])).toBe('')
    expect(summarizeFilterLocks([BROWN])).toBe('Brown Family')
    expect(summarizeFilterLocks([BROWN, NGUYEN, { ...BROWN, value: 'Zhou', format_txt: undefined }])).toBe(
      'Brown Family +2',
    )
    expect(summarizeFilterLocks([{ key: 'household', value: 'Zhou' }])).toBe('Zhou')
  })
})

describe('filterLocksKey', () => {
  it('is the same for the same values in any order, and differs otherwise', () => {
    expect(filterLocksKey([BROWN, NGUYEN])).toBe(filterLocksKey([NGUYEN, { ...BROWN, isSession: true }]))
    expect(filterLocksKey([BROWN])).not.toBe(filterLocksKey([NGUYEN]))
    expect(filterLocksKey([])).toBe('')
  })
})

describe('a report’s filter lock', () => {
  it('survives normalizing, and a report without one never gains the field', () => {
    const report = normalizeReport({ ...createEmptyReport({ title: 'Review' }), sessionFilterLocks: [BROWN] })
    expect(report.sessionFilterLocks).toStrictEqual([BROWN])
    expect('sessionFilterLocks' in normalizeReport(createEmptyReport())).toBe(false)
    expect('sessionFilterLocks' in normalizeReport({ ...createEmptyReport(), sessionFilterLocks: [] })).toBe(false)
    expect('sessionFilterLocks' in normalizeReport({ ...createEmptyReport(), sessionFilterLocks: ['x'] })).toBe(false)
  })

  it('is set and taken away with setSessionFilterLocks', () => {
    const report = createEmptyReport({ title: 'Review' })
    const locked = setSessionFilterLocks(report, [{ ...BROWN, isSession: true }])
    expect(locked.sessionFilterLocks).toStrictEqual([BROWN])
    expect(locked.title).toBe('Review')
    expect(report).not.toHaveProperty('sessionFilterLocks')

    const unlocked = setSessionFilterLocks(locked, [])
    expect(unlocked).not.toHaveProperty('sessionFilterLocks')
    expect(unlocked).toStrictEqual(report)
  })
})
