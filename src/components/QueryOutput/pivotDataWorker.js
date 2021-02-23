export default () => {
  self.addEventListener('message', (e) => {
    if (!e) return
    postMessage('pivot data')
  })
}
