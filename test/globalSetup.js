// Runs once before any test file, so `npx jest` works as well as `npm test`
module.exports = () => require('./testReact').ensureTestReact()
