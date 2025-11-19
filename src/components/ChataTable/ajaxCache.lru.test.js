import AjaxCache from './ajaxCache'

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

describe('AjaxCache LRU and TTL behavior', () => {
  test('TTL causes entries to expire', async () => {
    const cache = new AjaxCache({ maxEntries: 5, ttl: 30 })
    cache.set('k1', 'v1')
    expect(cache.get('k1')).toBe('v1')
    // wait longer than ttl
    await sleep(50)
    expect(cache.get('k1')).toBeUndefined()
  })

  test('LRU eviction removes least-recently-used entry', () => {
    const cache = new AjaxCache({ maxEntries: 3, ttl: 1000 * 60 })

    // insert 3 entries: order -> a, b, c
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // access 'a' to mark it recently used; order -> b, c, a
    expect(cache.get('a')).toBe(1)

    // add 'd' -> should evict 'b' (oldest)
    cache.set('d', 4)

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('d')).toBe(4)
  })

  test('set updates recency of an existing key', () => {
    const cache = new AjaxCache({ maxEntries: 2, ttl: 1000 * 60 })
    cache.set('x', 'X')
    cache.set('y', 'Y')
    // set x again to mark it recently used; order becomes y, x -> then add z will evict y
    cache.set('x', 'X2')
    cache.set('z', 'Z')

    expect(cache.get('y')).toBeUndefined()
    expect(cache.get('x')).toBe('X2')
    expect(cache.get('z')).toBe('Z')
  })
})
