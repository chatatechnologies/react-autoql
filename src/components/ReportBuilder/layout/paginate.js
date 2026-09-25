import { CHART_HEIGHT_PX } from '../constants'

// Lays a report out onto pages from measured heights. Pure: the preview measures real DOM, and falls
// back to estimateMeasurements when there's no layout (tests, or a builder hidden with display:none).

const sum = (values) => values.reduce((total, v) => total + v, 0)

// A block prints only if it has something to show: empty headings and text, and data blocks with no
// source yet, are left out.
export const isPrintable = (block) => {
  if (block.type === 'heading' || block.type === 'text') {
    return !!(block.text || '').trim()
  }
  if (block.type === 'data') {
    return !!block.source
  }
  return block.type === 'pagebreak'
}

// Consecutive half-width blocks sit side by side as one row. The editor sheet uses the same pairing.
export const groupIntoRows = (blocks) => {
  const rows = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    const next = blocks[i + 1]
    const pairable = (b) => b && b.type !== 'pagebreak' && b.width === 'half'
    if (pairable(block) && pairable(next)) {
      rows.push([block, next])
      i += 2
    } else {
      rows.push([block])
      i += 1
    }
  }
  return rows
}

// views[id].split marks a full-width table that may flow across pages.
export const buildLayoutItems = ({ blocks, views, measurements }) =>
  groupIntoRows(blocks.filter(isPrintable)).map((row) => {
    const [first] = row
    if (row.length === 1 && first.type === 'pagebreak') {
      return { type: 'break' }
    }
    if (row.length === 1 && views?.[first.id]?.split && measurements.tables?.[first.id]) {
      return { type: 'table', id: first.id, ...measurements.tables[first.id] }
    }
    return {
      type: 'atomic',
      ids: row.map((block) => block.id),
      height: Math.max(...row.map((block) => measurements.blocks?.[block.id] || 0)),
      keepWithNext: row.length === 1 && first.type === 'heading',
    }
  })

// How many of a table's remaining rows fit in `room`, leaving space for what ends the piece: the
// tail (total, caption, interpretation) if it's the last piece, otherwise "Continued on next page".
const fitRows = (item, at, room, header) => {
  let height = item.chrome + header
  let fit = 0
  while (at + fit < item.rows.length) {
    const withRow = height + item.rows[at + fit]
    const end = at + fit + 1 === item.rows.length ? item.tail : item.continued
    if (withRow + end > room) {
      break
    }
    height = withRow
    fit += 1
  }
  return fit
}

export const paginate = (items, { contentHeight, repeatTableHeaders = true, minRows = 3, safety = 4 }) => {
  const capacity = Math.max(1, contentHeight - safety)
  const pages = []
  let page = { cells: [], overflow: false }
  let used = 0

  const breakPage = () => {
    if (page.cells.length) {
      pages.push(page)
      page = { cells: [], overflow: false }
      used = 0
    }
  }

  // What must share a page with a heading: the next block, or a table's first few rows.
  const leadHeight = (item) => {
    if (!item || item.type === 'break') return 0
    if (item.type === 'table') return item.chrome + item.header + sum(item.rows.slice(0, minRows))
    return item.height
  }

  items.forEach((item, index) => {
    if (item.type === 'break') {
      breakPage()
      return
    }

    if (item.type === 'atomic') {
      const need = item.height + (item.keepWithNext ? leadHeight(items[index + 1]) : 0)
      if (used > 0 && need > capacity - used) {
        breakPage()
      }
      page.cells.push({ kind: 'blocks', ids: item.ids })
      used += item.height
      if (item.height > capacity) {
        page.overflow = true
      }
      return
    }

    const n = item.rows.length
    if (n === 0) {
      const height = item.chrome + item.header + item.tail
      if (used > 0 && height > capacity - used) {
        breakPage()
      }
      page.cells.push({ kind: 'table', id: item.id, from: 0, to: 0, showHeader: true, isLast: true })
      used += height
      return
    }

    let at = 0
    while (at < n) {
      const showHeader = at === 0 || repeatTableHeaders
      const header = showHeader ? item.header : 0
      const remaining = n - at
      let fit = fitRows(item, at, capacity - used, header)

      // Too little room here for a useful piece: start the table on a fresh page instead.
      if (fit < Math.min(minRows, remaining) && used > 0) {
        breakPage()
        continue
      }
      if (fit === 0) {
        fit = 1 // a single row taller than a page
        page.overflow = true
      }
      // Widow control: never leave the last piece with fewer than minRows.
      const left = remaining - fit
      if (left > 0 && left < minRows && fit > minRows) {
        fit = Math.max(minRows, fit - (minRows - left))
      }

      const to = at + fit
      const isLast = to >= n
      page.cells.push({ kind: 'table', id: item.id, from: at, to, showHeader, isLast })
      used += item.chrome + header + sum(item.rows.slice(at, to)) + (isLast ? item.tail : item.continued)
      at = to
      if (!isLast) {
        breakPage()
      }
    }
  })

  if (page.cells.length || !pages.length) {
    pages.push(page)
  }
  return pages
}

// The content page each heading lands on, counted from 1.
export const getHeadingPages = (pages, blocks) => {
  const headingIds = new Set(blocks.filter((block) => block.type === 'heading').map((block) => block.id))
  const result = {}
  pages.forEach((page, index) => {
    page.cells.forEach((cell) => {
      ;(cell.ids || []).forEach((id) => {
        if (headingIds.has(id) && result[id] == null) {
          result[id] = index + 1
        }
      })
    })
  })
  return result
}

const HEADING_PX = { 1: 34, 2: 28, 3: 22 }
const TEXT_LINE_PX = 18
const TABLE = { chrome: 30, header: 26, row: 22, tail: 40, continued: 20 }

// Heights to lay out with when the DOM can't be measured. Deliberately generous: a too-tall
// estimate costs white space, a too-short one clips content off the page.
export const estimateMeasurements = ({ blocks, views, contentWidthPx }) => {
  const charsPerLine = Math.max(20, Math.floor(contentWidthPx / 7))
  const measurements = { blocks: {}, tables: {} }

  blocks.forEach((block) => {
    const view = views?.[block.id]
    const half = block.width === 'half'
    switch (block.type) {
      case 'heading':
        measurements.blocks[block.id] = HEADING_PX[block.level] || HEADING_PX[2]
        break
      case 'text': {
        const lines = (block.text || '')
          .split('\n')
          .reduce(
            (total, line) => total + Math.max(1, Math.ceil(line.length / (half ? charsPerLine / 2 : charsPerLine))),
            0,
          )
        measurements.blocks[block.id] = lines * TEXT_LINE_PX + 12
        break
      }
      case 'data': {
        if (view?.kind === 'table' && view.state === 'ready') {
          const rows = new Array(view.rows.length).fill(TABLE.row)
          measurements.tables[block.id] = { ...TABLE, rows }
          measurements.blocks[block.id] = TABLE.chrome + TABLE.header + sum(rows) + TABLE.tail
        } else if (view?.kind === 'chart' && view.state === 'ready') {
          measurements.blocks[block.id] = (half ? CHART_HEIGHT_PX.half : CHART_HEIGHT_PX.full) + 60
        } else {
          measurements.blocks[block.id] = 96
        }
        break
      }
      default:
        measurements.blocks[block.id] = 0
    }
  })
  return measurements
}
