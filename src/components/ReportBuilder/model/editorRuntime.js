// The text editor's packages (TipTap, ProseMirror, marked) call a few methods browsers added in 2021–22:
// Array.prototype.at, findLast and findLastIndex, and Object.hasOwn. This package is built for older browsers too,
// so before the editor is first used, a browser without one gets it here, as the standard has it. Where they're built
// in, nothing changes.

const lengthOf = (list) => Math.min(Math.max(Math.trunc(Number(list.length)) || 0, 0), Number.MAX_SAFE_INTEGER)

const ARRAY_METHODS = {
  at(index) {
    const list = Object(this)
    const length = lengthOf(list)
    const relative = Math.trunc(Number(index)) || 0
    const k = relative < 0 ? length + relative : relative
    return k < 0 || k >= length ? undefined : list[k]
  },
  findLast(predicate, thisArg) {
    const list = Object(this)
    for (let i = lengthOf(list) - 1; i >= 0; i -= 1) {
      if (predicate.call(thisArg, list[i], i, list)) {
        return list[i]
      }
    }
    return undefined
  },
  findLastIndex(predicate, thisArg) {
    const list = Object(this)
    for (let i = lengthOf(list) - 1; i >= 0; i -= 1) {
      if (predicate.call(thisArg, list[i], i, list)) {
        return i
      }
    }
    return -1
  },
}

const OBJECT_METHODS = {
  hasOwn: (object, key) => {
    if (object === null || object === undefined) {
      throw new TypeError('Cannot convert undefined or null to object')
    }
    return Object.prototype.hasOwnProperty.call(Object(object), key)
  },
}

const addMissing = (target, methods) => {
  Object.keys(methods).forEach((name) => {
    if (typeof target[name] !== 'function') {
      Object.defineProperty(target, name, { value: methods[name], writable: true, configurable: true })
    }
  })
}

let prepared = false

// Called before the editor's packages are: once is enough.
export const prepareEditorRuntime = () => {
  if (prepared) {
    return
  }
  prepared = true
  addMissing(Array.prototype, ARRAY_METHODS)
  addMissing(Object, OBJECT_METHODS)
}
