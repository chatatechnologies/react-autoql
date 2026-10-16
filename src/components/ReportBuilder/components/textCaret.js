// Where a click on formatted text lands in the source it was made from, so an editor that swaps the formatted
// text for its source can put the caret where the click was.

// The formatted text before the point clicked, or null when the browser can't say or the point is outside
// `container`.
export const renderedTextBefore = (container, x, y) => {
  if (!container || typeof document === 'undefined') return null
  let node = null
  let offset = 0
  if (typeof document.caretRangeFromPoint === 'function') {
    const range = document.caretRangeFromPoint(x, y)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  } else if (typeof document.caretPositionFromPoint === 'function') {
    const position = document.caretPositionFromPoint(x, y)
    if (position) {
      node = position.offsetNode
      offset = position.offset
    }
  }
  if (!node || !container.contains(node)) return null
  try {
    const range = document.createRange()
    range.setStart(container, 0)
    range.setEnd(node, offset)
    return range.toString()
  } catch (error) {
    return null
  }
}

// The offset in `source` (Markdown) just after `printed`, the text it printed as up to some point: each
// printed character is found in turn, skipping whitespace and whatever Markdown didn't print (list markers,
// ** and _, # marks, escapes). A point after a space goes on to the next word. When the printed text can't
// be followed, the end of the source.
export const sourceOffsetAfter = (source, printed) => {
  const text = String(source ?? '')
  const before = String(printed ?? '')
  let at = 0
  for (const char of before) {
    if (/\s/.test(char)) continue
    const found = text.indexOf(char, at)
    if (found === -1) return text.length
    at = found + char.length
  }
  if (/\s$/.test(before)) {
    while (at < text.length && /\s/.test(text[at])) at += 1
  }
  return at
}
