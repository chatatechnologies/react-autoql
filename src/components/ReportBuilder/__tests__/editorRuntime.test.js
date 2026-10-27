// The methods the text editor's packages need from browsers newer than some this package supports: added only
// where they're missing, as the standard has them.

const NEEDED = [
  [Array.prototype, 'at'],
  [Array.prototype, 'findLast'],
  [Array.prototype, 'findLastIndex'],
  [Object, 'hasOwn'],
]

// A fresh copy of the module, which adds them once.
const prepare = () => {
  jest.isolateModules(() => {
    require('../model/editorRuntime').prepareEditorRuntime()
  })
}

describe('the editor’s runtime', () => {
  const builtIn = new Map()

  beforeEach(() => {
    NEEDED.forEach(([target, name]) => {
      builtIn.set(name, Object.getOwnPropertyDescriptor(target, name))
      delete target[name]
    })
  })

  afterEach(() => {
    NEEDED.forEach(([target, name]) => {
      delete target[name]
      const descriptor = builtIn.get(name)
      if (descriptor) {
        Object.defineProperty(target, name, descriptor)
      }
    })
  })

  it('adds what an older browser lacks, the way built-ins are added', () => {
    prepare()
    const list = [1, 2, 3, 4]
    expect(list.at(0)).toBe(1)
    expect(list.at(-1)).toBe(4)
    expect(list.at(1.7)).toBe(2)
    expect(list.at(4)).toBeUndefined()
    expect(list.at(-5)).toBeUndefined()
    expect(list.findLast((n) => n % 2 === 1)).toBe(3)
    expect(list.findLastIndex((n) => n % 2 === 1)).toBe(2)
    expect(list.findLast((n) => n > 9)).toBeUndefined()
    expect(list.findLastIndex((n) => n > 9)).toBe(-1)
    expect(Object.hasOwn({ a: 1 }, 'a')).toBe(true)
    expect(Object.hasOwn({ a: 1 }, 'toString')).toBe(false)
    expect(() => Object.hasOwn(null, 'a')).toThrow(TypeError)
    NEEDED.forEach(([target, name]) => {
      expect(Object.getOwnPropertyDescriptor(target, name)).toMatchObject({ enumerable: false, writable: true })
    })
    // Nothing new turns up when an array's indexes are walked.
    const seen = []
    for (const key in list) {
      seen.push(key)
    }
    expect(seen).toEqual(['0', '1', '2', '3'])
  })

  it('leaves ones the browser has alone', () => {
    const own = function at() {}
    Object.defineProperty(Array.prototype, 'at', { value: own, writable: true, configurable: true })
    prepare()
    expect(Array.prototype.at).toBe(own)
  })
})
