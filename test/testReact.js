// React is a peer dependency only, so it is never installed in this repo: a second copy breaks hooks in a host app
// that links this package. Tests get React 16 (the version the enzyme adapter supports) from a pinned install
// outside the repo, which jest finds through `modulePaths`.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const TEST_REACT_VERSION = '16.14.0'
const TEST_REACT_DIR = path.join(os.homedir(), '.cache', 'react-autoql', `test-react-${TEST_REACT_VERSION}`)
const TEST_REACT_MODULES = path.join(TEST_REACT_DIR, 'node_modules')

const isInstalled = () =>
  ['react', 'react-dom'].every((name) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(TEST_REACT_MODULES, name, 'package.json'), 'utf8'))
      return pkg.version === TEST_REACT_VERSION
    } catch (error) {
      return false
    }
  })

const ensureTestReact = () => {
  if (isInstalled()) {
    return
  }

  fs.mkdirSync(TEST_REACT_DIR, { recursive: true })
  console.log(`Installing React ${TEST_REACT_VERSION} for tests in ${TEST_REACT_DIR}`)
  execSync(
    `npm install --prefix "${TEST_REACT_DIR}" --no-audit --no-fund ` +
      `react@${TEST_REACT_VERSION} react-dom@${TEST_REACT_VERSION}`,
    { stdio: 'inherit' },
  )
}

module.exports = { TEST_REACT_MODULES, ensureTestReact }
