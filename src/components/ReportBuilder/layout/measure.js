// Reads block heights from the offscreen measurer, which lays every printable block out at the page's
// content width exactly as a page renders it. The markers it looks for:
//   [data-measure-id]         one block cell (display: flow-root, so its height includes margins)
//   [data-measure-split]      on a cell whose table may flow across pages
//   [data-measure-table]      that table; rows are tbody tr[data-row], the total is tr[data-total]
//   [data-measure-tail]       what only a table's last piece has below it (caption, interpretation)
//   [data-measure-continued]  the "continued" note that ends every other piece
// Returns null when nothing has layout (jsdom, or a builder inside a display:none parent).

const heightOf = (el) => (el ? el.getBoundingClientRect().height : 0)

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
  const measurements = { blocks: {}, tables: {} }

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
  })
  return measurements
}
