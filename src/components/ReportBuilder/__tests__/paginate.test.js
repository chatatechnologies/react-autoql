import {
  buildLayoutItems,
  estimateMeasurements,
  getHeadingPages,
  groupIntoRows,
  isPrintable,
  paginate,
} from '../layout/paginate'
import { getPageGeometry } from '../layout/pageGeometry'

const atomic = (id, height, keepWithNext = false) => ({ type: 'atomic', ids: [id], height, keepWithNext })
const table = (id, n, { row = 10, header = 20, chrome = 10, tail = 20, continued = 10 } = {}) => ({
  type: 'table',
  id,
  chrome,
  header,
  tail,
  continued,
  rows: new Array(n).fill(row),
})
const opts = { contentHeight: 204, safety: 4 } // capacity 200

const cellsOf = (pages) => pages.map((page) => page.cells)

describe('paginate', () => {
  it('keeps blocks that fit on one page', () => {
    expect(cellsOf(paginate([atomic('a', 50), atomic('b', 50)], opts))).toStrictEqual([
      [
        { kind: 'blocks', ids: ['a'] },
        { kind: 'blocks', ids: ['b'] },
      ],
    ])
  })

  it('moves a whole block that doesn’t fit to the next page', () => {
    const pages = paginate([atomic('a', 150), atomic('b', 100)], opts)
    expect(pages.map((p) => p.cells.map((c) => c.ids[0]))).toStrictEqual([['a'], ['b']])
  })

  it('flags a block taller than a page instead of losing it', () => {
    const pages = paginate([atomic('a', 500)], opts)
    expect(pages).toHaveLength(1)
    expect(pages[0].overflow).toBe(true)
  })

  it('never makes a blank page from a page break', () => {
    const pages = paginate(
      [{ type: 'break' }, atomic('a', 10), { type: 'break' }, { type: 'break' }, atomic('b', 10)],
      opts,
    )
    expect(pages.map((p) => p.cells.map((c) => c.ids[0]))).toStrictEqual([['a'], ['b']])
  })

  it('always returns at least one page', () => {
    expect(paginate([], opts)).toStrictEqual([{ cells: [], overflow: false }])
  })

  it('keeps a heading with what follows it', () => {
    const pages = paginate([atomic('filler', 150), atomic('h', 20, true), atomic('chart', 100)], opts)
    expect(pages.map((p) => p.cells.map((c) => c.ids[0]))).toStrictEqual([['filler'], ['h', 'chart']])
  })

  it('splits a long table across pages, repeating its header', () => {
    // capacity 200: first piece = chrome 10 + header 20 + rows + continued 10 → 16 rows
    const pages = paginate([table('t', 30)], { ...opts, repeatTableHeaders: true })
    const pieces = pages.map((p) => p.cells[0])
    expect(pieces).toStrictEqual([
      { kind: 'table', id: 't', from: 0, to: 16, showHeader: true, isLast: false },
      { kind: 'table', id: 't', from: 16, to: 30, showHeader: true, isLast: true },
    ])
  })

  it('shows the header only on the first piece when repeating is off', () => {
    const pages = paginate([table('t', 30)], { ...opts, repeatTableHeaders: false })
    expect(pages.map((p) => p.cells[0].showHeader)).toStrictEqual([true, false])
    expect(pages[1].cells[0].from).toBe(pages[0].cells[0].to)
  })

  it('starts a table on a fresh page rather than leave a stub of fewer than 3 rows', () => {
    const pages = paginate([atomic('a', 160), table('t', 10)], opts)
    expect(pages[0].cells).toStrictEqual([{ kind: 'blocks', ids: ['a'] }])
    expect(pages[1].cells[0]).toMatchObject({ id: 't', from: 0 })
  })

  it('never leaves the last piece with fewer than 3 rows', () => {
    // 17 rows: 16 would fit on page 1, leaving 1 widow; control hands 2 more to page 2.
    const pages = paginate([table('t', 17)], opts)
    const pieces = pages.map((p) => p.cells[0])
    expect(pieces.map((c) => c.to - c.from)).toStrictEqual([14, 3])
  })

  it('covers every row exactly once', () => {
    const pages = paginate([table('t', 200)], opts)
    const covered = []
    pages.forEach((p) =>
      p.cells.forEach((c) => covered.push(...Array.from({ length: c.to - c.from }, (_, i) => c.from + i))),
    )
    expect(covered).toStrictEqual(Array.from({ length: 200 }, (_, i) => i))
    expect(pages[pages.length - 1].cells[0].isLast).toBe(true)
    expect(pages.slice(0, -1).every((p) => !p.cells[0].isLast)).toBe(true)
  })

  it('places an empty table as one piece', () => {
    expect(paginate([table('t', 0)], opts)[0].cells).toStrictEqual([
      { kind: 'table', id: 't', from: 0, to: 0, showHeader: true, isLast: true },
    ])
  })
})

describe('groupIntoRows and buildLayoutItems', () => {
  const SOURCE = { type: 'query', query: 'revenue by region' }
  const blocks = [
    { id: 'h', type: 'heading', text: 'Revenue', level: 1, width: 'full' },
    { id: 'x', type: 'heading', text: '  ', level: 2, width: 'full' },
    { id: 'l', type: 'data', width: 'half', source: SOURCE },
    { id: 'r', type: 'data', width: 'half', source: SOURCE },
    { id: 'lone', type: 'data', width: 'half', source: SOURCE },
    { id: 'pb', type: 'pagebreak' },
    { id: 't', type: 'data', width: 'full', source: SOURCE },
  ]

  it('pairs consecutive half-width blocks, and leaves an unpaired one alone', () => {
    expect(groupIntoRows(blocks).map((row) => row.map((b) => b.id))).toStrictEqual([
      ['h'],
      ['x'],
      ['l', 'r'],
      ['lone'],
      ['pb'],
      ['t'],
    ])
  })

  it('leaves out empty headings and text, and data blocks with nothing to show yet', () => {
    expect(isPrintable(blocks[1])).toBe(false)
    expect(isPrintable({ type: 'text', text: '' })).toBe(false)
    expect(isPrintable(blocks[0])).toBe(true)
    expect(isPrintable({ type: 'data', source: null })).toBe(false)
    expect(isPrintable({ type: 'data', source: { type: 'query', query: 'x' } })).toBe(true)
  })

  it('builds atomic rows, page breaks and splittable tables', () => {
    const measurements = {
      blocks: { h: 30, l: 200, r: 250, lone: 100, t: 400 },
      tables: { t: { chrome: 10, header: 20, rows: [10, 10], tail: 20, continued: 10 } },
    }
    const items = buildLayoutItems({ blocks, views: { t: { split: true } }, measurements })
    expect(items).toStrictEqual([
      { type: 'atomic', ids: ['h'], height: 30, keepWithNext: true },
      { type: 'atomic', ids: ['l', 'r'], height: 250, keepWithNext: false },
      { type: 'atomic', ids: ['lone'], height: 100, keepWithNext: false },
      { type: 'break' },
      { type: 'table', id: 't', chrome: 10, header: 20, rows: [10, 10], tail: 20, continued: 10 },
    ])
  })
})

describe('getHeadingPages', () => {
  it('numbers each heading by the content page it lands on', () => {
    const blocks = [
      { id: 'h1', type: 'heading' },
      { id: 'a', type: 'text' },
      { id: 'h2', type: 'heading' },
    ]
    const pages = [
      {
        cells: [
          { kind: 'blocks', ids: ['h1'] },
          { kind: 'blocks', ids: ['a'] },
        ],
      },
      { cells: [{ kind: 'blocks', ids: ['h2'] }] },
    ]
    expect(getHeadingPages(pages, blocks)).toStrictEqual({ h1: 1, h2: 2 })
  })
})

describe('estimateMeasurements', () => {
  it('estimates every block so layout works without a DOM', () => {
    const { contentWidthPx } = getPageGeometry({ orientation: 'portrait', margins: 'normal' })
    const blocks = [
      { id: 'h', type: 'heading', level: 1 },
      { id: 'p', type: 'text', text: 'x'.repeat(500) },
      { id: 't', type: 'data', width: 'full' },
      { id: 'c', type: 'data', width: 'half' },
    ]
    const views = {
      t: { kind: 'table', state: 'ready', rows: new Array(40).fill([]) },
      c: { kind: 'chart', state: 'ready' },
    }
    const m = estimateMeasurements({ blocks, views, contentWidthPx })

    expect(m.blocks.h).toBeGreaterThan(0)
    expect(m.blocks.p).toBeGreaterThan(m.blocks.h)
    expect(m.tables.t.rows).toHaveLength(40)
    expect(m.blocks.c).toBeGreaterThan(200)
  })
})

describe('getPageGeometry', () => {
  it('is Letter, with margins and running header/footer taken out of the content area', () => {
    const portrait = getPageGeometry({ orientation: 'portrait', margins: 'normal', header: true, footer: true })
    expect(portrait).toMatchObject({ widthIn: 8.5, heightIn: 11, marginIn: 0.75, contentWidthPx: 672 })
    expect(portrait.contentHeightPx).toBe(Math.round((11 - 1.5 - 0.55 - 0.35) * 96))

    const landscape = getPageGeometry({ orientation: 'landscape', margins: 'narrow' })
    expect(landscape).toMatchObject({ widthIn: 11, heightIn: 8.5, contentWidthPx: 960, headerIn: 0, footerIn: 0 })
  })
})
