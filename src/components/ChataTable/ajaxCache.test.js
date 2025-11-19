import AjaxCache from './ajaxCache'

describe('AjaxCache maxEntries handling and eviction', () => {
  test('defaults to 50 when maxEntries is 0', () => {
    const c = new AjaxCache({ maxEntries: 0 })
    expect(c._maxEntries).toBe(50)
  })

  test('defaults to 50 when maxEntries is negative', () => {
    const c = new AjaxCache({ maxEntries: -5 })
    expect(c._maxEntries).toBe(50)
  })

  test('evicts least-recently-used entries when over limit', () => {
    const c = new AjaxCache({ maxEntries: 2, ttl: 0 })
    c.set('a', 1)
    c.set('b', 2)
    // At this point cache has ['a','b']
    c.set('c', 3)
    // Should have evicted 'a'
    expect(c.has('a')).toBe(false)
    expect(c.has('b')).toBe(true)
    expect(c.has('c')).toBe(true)
    expect(c.size).toBeLessThanOrEqual(2)
  })

  test('get bumps entry recency so it is not evicted', () => {
    const c = new AjaxCache({ maxEntries: 2, ttl: 0 })
    c.set('a', 1)
    c.set('b', 2)
    // Access 'a' to mark it recent
    expect(c.get('a')).toBe(1)
    // Add 'c' which should evict the least recent (which should be 'b')
    c.set('c', 3)
    expect(c.has('a')).toBe(true)
    expect(c.has('b')).toBe(false)
    expect(c.has('c')).toBe(true)
  })
})
describe('AjaxCache', () => {
  describe('persistent cache', () => {
    test('get/set/has/delete work correctly', () => {
      const cache = new AjaxCache()
      const key = 'test-key'
      const value = { rows: [1, 2, 3] }

      expect(cache.has(key)).toBe(false)
      expect(cache.get(key)).toBeUndefined()

      cache.set(key, value)
      expect(cache.has(key)).toBe(true)
      expect(cache.get(key)).toEqual(value)

      cache.delete(key)
      expect(cache.has(key)).toBe(false)
    })

    test('keys() returns all keys', () => {
      const cache = new AjaxCache()
      cache.set('key1', { data: 1 })
      cache.set('key2', { data: 2 })

      const keys = Array.from(cache.keys())
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys.length).toBe(2)
    })

    test('size property reflects entry count', () => {
      const cache = new AjaxCache()
      expect(cache.size).toBe(0)

      cache.set('key1', { data: 1 })
      expect(cache.size).toBe(1)

      cache.set('key2', { data: 2 })
      expect(cache.size).toBe(2)

      cache.delete('key1')
      expect(cache.size).toBe(1)
    })

    test('undefined key is handled (caller responsibility to provide valid keys)', () => {
      const cache = new AjaxCache()
      expect(cache.get(undefined)).toBeUndefined()
      expect(cache.has(undefined)).toBe(false)
      // Note: caller is responsible for not passing undefined keys; cache doesn't validate
    })
  })

  describe('in-flight tracking', () => {
    test('setInFlight/getInFlight/hasInFlight/deleteInFlight work correctly', () => {
      const cache = new AjaxCache()
      const key = 'in-flight-key'
      const promise = Promise.resolve({ data: 'result' })

      expect(cache.hasInFlight(key)).toBe(false)
      expect(cache.getInFlight(key)).toBeUndefined()

      cache.setInFlight(key, promise)
      expect(cache.hasInFlight(key)).toBe(true)
      expect(cache.getInFlight(key)).toBe(promise)

      cache.deleteInFlight(key)
      expect(cache.hasInFlight(key)).toBe(false)
    })

    test('in-flight and persistent cache are separate', () => {
      const cache = new AjaxCache()
      const key = 'test-key'
      const promise = Promise.resolve({ data: 'result' })

      cache.setInFlight(key, promise)
      expect(cache.hasInFlight(key)).toBe(true)
      expect(cache.has(key)).toBe(false) // persistent cache empty

      cache.set(key, { data: 'cached' })
      expect(cache.hasInFlight(key)).toBe(true) // still in-flight
      expect(cache.has(key)).toBe(true) // and now persisted
    })
  })

  describe('edge cases', () => {
    test('get returns latest value after multiple sets to same key', () => {
      const cache = new AjaxCache()
      const key = 'key1'

      cache.set(key, { version: 1 })
      expect(cache.get(key).version).toBe(1)

      cache.set(key, { version: 2 })
      expect(cache.get(key).version).toBe(2)
    })

    test('constructor accepts maxEntries and ttl params', () => {
      const cache = new AjaxCache({ maxEntries: 10, ttl: 5000 })
      // Constructor accepts parameters for future use (TTL eviction, LRU limits)
      expect(cache).toBeDefined()
      expect(cache.size).toBe(0)
    })

    test('deletes undefined key gracefully', () => {
      const cache = new AjaxCache()
      cache.set('key1', { data: 1 })
      const result = cache.delete(undefined)
      expect(result).toBe(false)
      expect(cache.size).toBe(1)
    })
  })
})
