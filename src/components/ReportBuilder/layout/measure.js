import { RB } from '../constants'

// Reads block heights from the offscreen measurer, which lays every printable block out at the page's
// content width exactly as a page renders it. The markers it looks for:
//   [data-measure-id]         one block cell (display: flow-root, so its height includes margins)
//   [data-measure-split]      on a cell whose table may flow across pages
//   [data-measure-table]      that table; rows are tbody tr[data-row], the total is tr[data-total]
//   [data-measure-tail]       what only a table's last piece has below it (caption, interpretation)
//   [data-measure-continued]  the "continued" note that ends every other piece
//   [data-measure-flow]       on a cell whose text may go on over the next page, between its pieces
// Returns null when nothing has layout (jsdom, or a builder inside a display:none parent).

const heightOf = (el) => (el ? el.getBoundingClientRect().height : 0)

// A text's pieces as the page draws them (model/richText's chunks): the formatted text's blocks, a list's items
// in place of the list. Each is as tall as the distance to the next, so the gaps between them are counted too.
const readFlow = (cell, cellRect) => {
  const rich = cell.querySelector(`.${RB}-rich`)
  if (!rich) {
    return null
  }
  const pieces = []
  Array.from(rich.children).forEach((el) => {
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      pieces.push(...Array.from(el.children).filter((item) => item.tagName === 'LI'))
    } else {
      pieces.push(el)
    }
  })
  if (!pieces.length) {
    return null
  }
  const tops = pieces.map((el) => el.getBoundingClientRect().top)
  const last = pieces[pieces.length - 1].getBoundingClientRect()
  const head = tops[0] - cellRect.top
  return {
    // Above the text on every page's piece: the block's padding.
    head,
    chunks: pieces.map((el, index) => (index < pieces.length - 1 ? tops[index + 1] - tops[index] : last.height)),
    // Below the last piece: padding, and an analysis's Auto Analyze line.
    tail: cellRect.bottom - last.bottom,
    // Below any other piece: padding, as above.
    end: head,
    // A heading in the text goes on to the next page with what follows it.
    keep: pieces.map((el) => /^H[1-6]$/.test(el.tagName)),
  }
}

export const hasLayout = (root) => !!root && root.getBoundingClientRect().width > 0

const readTable = (cell, cellRect, continued) => {
  const table = cell.querySelector('[data-measure-table]')
  if (!table) {
    return null
  }
  const tableRect = table.getBoundingClientRect()
  const thead = table.querySelector('thead')
  const tail = cell.querySelector('[data-measure-tail]')
  const headerTop = thead ? thead.getBoundingClientRect().top : tableRect.top
  const contentBottom = tail ? tail.getBoundingClientRect().bottom : tableRect.bottom

  return {
    // Around the table on every piece: the block's padding and title.
    chrome: headerTop - cellRect.top + (cellRect.bottom - contentBottom),
    header: heightOf(thead),
    rows: Array.from(table.querySelectorAll('tbody tr[data-row]')).map(heightOf),
    // Below the last piece only.
    tail: heightOf(table.querySelector('tr[data-total]')) + heightOf(tail),
    continued,
  }
}

export const readMeasurements = (root) => {
  if (!hasLayout(root)) {
    return null
  }
  const continued = heightOf(root.querySelector('[data-measure-continued]'))
  const measurements = { blocks: {}, tables: {}, flows: {} }

  root.querySelectorAll('[data-measure-id]').forEach((cell) => {
    const id = cell.getAttribute('data-measure-id')
    const rect = cell.getBoundingClientRect()
    measurements.blocks[id] = rect.height
    if (cell.hasAttribute('data-measure-split')) {
      const table = readTable(cell, rect, continued)
      if (table) {
        measurements.tables[id] = table
      }
    }
    if (cell.hasAttribute('data-measure-flow')) {
      const flow = readFlow(cell, rect)
      if (flow) {
        measurements.flows[id] = flow
      }
    }
  })
  return measurements
}
