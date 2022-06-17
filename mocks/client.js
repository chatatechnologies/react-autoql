const crypto = require('crypto')
// import { JSDOM } from 'jsdom'

// const dom = new JSDOM()
// global.document = dom.window.document
// global.window = dom.window

Object.defineProperty(global.self, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
  },
})
