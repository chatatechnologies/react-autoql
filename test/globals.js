try {
  const React = require('react')
  global.React = React
} catch (err) {
  console.error(
    'test setup: failed to require("react"). Install React (e.g. npm i --save-dev react@16 react-dom@16) or run `npm ci --legacy-peer-deps` in CI.',
  )
  throw err
}
