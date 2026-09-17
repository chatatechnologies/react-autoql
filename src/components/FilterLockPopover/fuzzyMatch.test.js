import { fuzzyMatch, fuzzyScore } from './fuzzyMatch'

const names = ['Smith Family', 'Anderson Charities', 'Chen Family Foundation', 'Chen', 'smith holdings']

describe('fuzzyScore', () => {
  test('returns every character range for an exact match', () => {
    expect(fuzzyScore('Chen', 'chen')).toEqual({ name: 'Chen', score: 1000000, ranges: [[0, 4]] })
  })

  test('ranks an exact match above a prefix match', () => {
    expect(fuzzyScore('Chen', 'chen').score).toBeGreaterThan(fuzzyScore('Chen Family Foundation', 'chen').score)
  })

  test('ranks a word-boundary run above a mid-word run', () => {
    const boundary = fuzzyScore('Anderson Charities', 'ch')
    const midWord = fuzzyScore('Marching Band', 'ch')
    expect(boundary.score).toBeGreaterThan(midWord.score)
  })

  test('matches a scattered subsequence and reports each range', () => {
    expect(fuzzyScore('Chen Family Foundation', 'cff').ranges).toEqual([
      [0, 1],
      [5, 6],
      [12, 13],
    ])
  })

  test('returns null when the query is not a subsequence', () => {
    expect(fuzzyScore('Chen', 'xyz')).toBeNull()
  })

  test('treats an empty query as a match with no ranges', () => {
    expect(fuzzyScore('Chen', '  ')).toEqual({ name: 'Chen', score: 0, ranges: [] })
  })
})

describe('fuzzyMatch', () => {
  test('returns the full list sorted alphabetically when the query is empty', () => {
    expect(fuzzyMatch(names, '').map((r) => r.name)).toEqual([
      'Anderson Charities',
      'Chen',
      'Chen Family Foundation',
      'Smith Family',
      'smith holdings',
    ])
  })

  test('drops values the query cannot match', () => {
    expect(fuzzyMatch(names, 'smith').map((r) => r.name)).toEqual(['Smith Family', 'smith holdings'])
  })

  test('is case insensitive', () => {
    expect(fuzzyMatch(names, 'SMITH').map((r) => r.name)).toEqual(['Smith Family', 'smith holdings'])
  })

  test('prefers the shorter name on an otherwise equal match', () => {
    expect(fuzzyMatch(names, 'chen').map((r) => r.name)).toEqual(['Chen', 'Chen Family Foundation'])
  })

  test('ignores non-strings and blanks', () => {
    expect(fuzzyMatch(['Chen', null, 42, '   ', undefined], '').map((r) => r.name)).toEqual(['Chen'])
  })

  test('returns an empty array when there is no list', () => {
    expect(fuzzyMatch(undefined, 'chen')).toEqual([])
    expect(fuzzyMatch(null, '')).toEqual([])
  })
})
