import { randomFillSync } from 'crypto'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: (arr) => {
      if (!(arr && typeof arr.length === 'number')) {
        throw new TypeError('Expected an array-like object')
      }
      const buf = new Uint8Array(arr.length)
      randomFillSync(buf)
      if (typeof arr.set === 'function') {
        arr.set(buf)
      } else {
        for (let i = 0; i < buf.length; i++) arr[i] = buf[i]
      }
      return arr
    },
  }
}

export {}
