// Text wraps differently once a web font replaces its fallback, so layout is measured after fonts load.
// Browsers without the Font Loading API (and jsdom) resolve straight away.

export const DEFAULT_FONT_TIMEOUT = 3000

export const waitForFonts = (
  doc = typeof document !== 'undefined' ? document : undefined,
  timeout = DEFAULT_FONT_TIMEOUT,
) => {
  const ready = doc?.fonts?.ready
  if (!ready || typeof ready.then !== 'function') {
    return Promise.resolve(false)
  }
  let timer
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeout)
  })
  return Promise.race([
    ready.then(
      () => true,
      () => false,
    ),
    timedOut,
  ]).then((loaded) => {
    clearTimeout(timer)
    return loaded
  })
}

// Asks for the faces a stack names, so they start loading before anything is measured. Faces the host
// never loaded (no @font-face) resolve empty, which is fine: the stack's fallbacks are used.
export const loadFontStack = (stack, doc = typeof document !== 'undefined' ? document : undefined) => {
  if (!stack || !doc?.fonts?.load) {
    return Promise.resolve()
  }
  const [first] = stack.split(',')
  return Promise.all([doc.fonts.load(`400 12pt ${first}`), doc.fonts.load(`700 12pt ${first}`)]).then(
    () => undefined,
    () => undefined,
  )
}
