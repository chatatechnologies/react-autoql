import { uniqueValues, uniqueValueCount } from './arrayUtils'

// These replaced `array.filter(onlyUnique)` from autoql-fe-utils. The contract that matters at the
// call sites (pivot header extraction, histogram bucketing, chart number indices) is: input order is
// preserved and the first occurrence wins. NaN is the one documented divergence.
describe('uniqueValues', () => {
  test('dedupes while preserving input order', () => {
    expect(uniqueValues(['c', 'a', 'c', 'b', 'a'])).toEqual(['c', 'a', 'b'])
  })

  test('keeps the first occurrence, not the last', () => {
    expect(uniqueValues([3, 1, 3])).toEqual([3, 1])
  })

  test('matches filter(onlyUnique) for mixed primitives', () => {
    const onlyUnique = (value, index, self) => self.indexOf(value) === index
    const input = [0, '0', false, null, undefined, '', 0, null, 'a', 'a', 2, 2]

    expect(uniqueValues(input)).toEqual(input.filter(onlyUnique))
  })

  test('does not coerce between types', () => {
    expect(uniqueValues([1, '1'])).toEqual([1, '1'])
  })

  test('treats object values by reference, like indexOf does', () => {
    const shared = { a: 1 }
    expect(uniqueValues([shared, shared, { a: 1 }])).toEqual([shared, { a: 1 }])
  })

  test('keeps one NaN, where filter(onlyUnique) dropped them all', () => {
    // The one intentional divergence, and it goes the opposite way to what you might expect:
    // indexOf(NaN) is always -1 so onlyUnique never matched, while Set uses SameValueZero.
    expect(uniqueValues([NaN, NaN, 1])).toEqual([NaN, 1])
    expect([NaN, NaN, 1].filter((value, index, self) => self.indexOf(value) === index)).toEqual([1])
  })

  test('returns an empty array for non-array input', () => {
    expect(uniqueValues(undefined)).toEqual([])
    expect(uniqueValues(null)).toEqual([])
    expect(uniqueValues('abc')).toEqual([])
    expect(uniqueValues({ 0: 'a', length: 1 })).toEqual([])
  })

  test('returns a new array rather than mutating the input', () => {
    const input = [1, 1, 2]
    const result = uniqueValues(input)

    expect(result).not.toBe(input)
    expect(input).toEqual([1, 1, 2])
  })
})

describe('uniqueValueCount', () => {
  test('counts distinct values', () => {
    expect(uniqueValueCount(['a', 'b', 'a', 'c'])).toBe(3)
  })

  test('agrees with uniqueValues().length', () => {
    const input = [1, 2, 2, 3, 3, 3, null, null, undefined]
    expect(uniqueValueCount(input)).toBe(uniqueValues(input).length)
  })

  test('counts repeated NaN once', () => {
    // filter(onlyUnique).length was 0 here. Only reachable if a numerical column contains NaN.
    expect(uniqueValueCount([NaN, NaN, NaN])).toBe(1)
  })

  test('returns 0 for an empty array and for non-array input', () => {
    expect(uniqueValueCount([])).toBe(0)
    expect(uniqueValueCount(undefined)).toBe(0)
    expect(uniqueValueCount(null)).toBe(0)
    expect(uniqueValueCount('abc')).toBe(0)
  })
})
