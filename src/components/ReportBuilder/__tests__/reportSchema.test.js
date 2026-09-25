import {
  createBlock,
  createEmptyReport,
  DEFAULT_PAGE_SETUP,
  isNewerSchema,
  normalizeReport,
  REPORT_SCHEMA_VERSION,
  snapTableRows,
} from '../model/reportSchema'
import {
  duplicateBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  resetBlockStyle,
  updateBlock,
  updateBlockStyle,
} from '../model/reportOperations'

describe('createEmptyReport', () => {
  it('is a versioned, empty, plain-JSON template', () => {
    const report = createEmptyReport()
    expect(report).toStrictEqual({
      schemaVersion: REPORT_SCHEMA_VERSION,
      title: '',
      blocks: [],
      page: DEFAULT_PAGE_SETUP,
    })
    expect(JSON.parse(JSON.stringify(report))).toStrictEqual(report)
  })

  it('has no paper-size setting — reports are Letter', () => {
    expect(createEmptyReport().page).not.toHaveProperty('size')
  })
})

describe('snapTableRows', () => {
  it.each([
    [25, 25],
    [30, 25],
    [100, 100],
    [500, 100],
    [3, 10],
    ['50', 50],
    [undefined, 25],
    ['x', 25],
  ])('%p rows becomes %p', (input, expected) => {
    expect(snapTableRows(input)).toBe(expected)
  })
})

describe('normalizeReport', () => {
  it('treats anything that is not an object as an empty report', () => {
    expect(normalizeReport(undefined)).toStrictEqual(createEmptyReport())
    expect(normalizeReport([])).toStrictEqual(createEmptyReport())
  })

  it('fills defaults and gives every block an id', () => {
    const report = normalizeReport({ blocks: [{ type: 'text', text: 'Hi' }] })
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    expect(report.page).toStrictEqual(DEFAULT_PAGE_SETUP)
    expect(report.blocks[0]).toMatchObject({ type: 'text', text: 'Hi', width: 'full' })
    expect(typeof report.blocks[0].id).toBe('string')
  })

  it('falls back to Section for a heading level it does not offer', () => {
    const [block] = normalizeReport({ blocks: [{ id: 'h', type: 'heading', text: 'X', level: 7 }] }).blocks
    expect(block.level).toBe(2)
  })

  it('keeps only valid style values, and drops the style when nothing is left', () => {
    const [kept, dropped] = normalizeReport({
      blocks: [
        { id: 'a', type: 'text', style: { size: 'large', color: '#DD6A6A', align: 'center', weight: 'heavy' } },
        { id: 'b', type: 'text', style: { color: 'red', font: 'theme', align: 'left' } },
      ],
    }).blocks
    expect(kept.style).toStrictEqual({ size: 'large', color: '#DD6A6A', align: 'center' })
    expect(dropped).not.toHaveProperty('style')
  })

  it('snaps and caps a data block’s rows, and strips any style from it', () => {
    const [block] = normalizeReport({
      blocks: [{ id: 'd', type: 'data', rows: 5000, style: { color: '#16181C' }, source: null }],
    }).blocks
    expect(block.rows).toBe(100)
    expect(block).not.toHaveProperty('style')
  })

  it('keeps a data block’s chosen display type only when it is a name', () => {
    const [chosen, empty, bad] = normalizeReport({
      blocks: [
        { id: 'a', type: 'data', source: null, displayType: 'bar' },
        { id: 'b', type: 'data', source: null, displayType: '' },
        { id: 'c', type: 'data', source: null, displayType: 42 },
      ],
    }).blocks
    expect(chosen.displayType).toBe('bar')
    expect(empty).not.toHaveProperty('displayType')
    expect(bad).not.toHaveProperty('displayType')
  })

  it('accepts tile and question sources, and nothing else', () => {
    const blocks = normalizeReport({
      blocks: [
        { id: 't', type: 'data', source: { type: 'tile', dashboardId: 7, tileKey: 'k1' } },
        { id: 'q', type: 'data', source: { type: 'query', query: 'sales by region' } },
        { id: 'x', type: 'data', source: { type: 'query', query: '   ' } },
        { id: 'y', type: 'data', source: { type: 'tile', dashboardId: 7 } },
      ],
    }).blocks
    expect(blocks[0].source).toMatchObject({ type: 'tile', dashboardId: '7', tileKey: 'k1' })
    expect(blocks[1].source).toStrictEqual({ type: 'query', query: 'sales by region' })
    expect(blocks[2].source).toBeNull()
    expect(blocks[3].source).toBeNull()
  })

  it('keeps unknown blocks and fields, so a report from a newer version survives a save', () => {
    const input = {
      schemaVersion: 1,
      title: 'Q3',
      futureField: { x: 1 },
      blocks: [{ id: 'z', type: 'analysis', scope: 'report' }],
    }
    const report = normalizeReport(input)
    expect(report.futureField).toStrictEqual({ x: 1 })
    expect(report.blocks[0]).toStrictEqual({ id: 'z', type: 'analysis', scope: 'report' })
  })

  it('validates page setup values and resets bad ones', () => {
    const { page } = normalizeReport({ page: { orientation: 'sideways', margins: 'wide', coverPage: 'yes' } })
    expect(page.orientation).toBe('portrait')
    expect(page.margins).toBe('wide')
    expect(page.coverPage).toBe(false)
  })

  it('round-trips through JSON unchanged', () => {
    const report = normalizeReport({
      title: 'Board pack',
      blocks: [
        createBlock('heading', { level: 1 }),
        createBlock('text'),
        createBlock('data'),
        createBlock('pagebreak'),
      ],
    })
    expect(JSON.parse(JSON.stringify(report))).toStrictEqual(report)
    expect(normalizeReport(report)).toStrictEqual(report)
  })

  it('flags a report written by a newer schema', () => {
    expect(isNewerSchema({ schemaVersion: REPORT_SCHEMA_VERSION + 1 })).toBe(true)
    expect(isNewerSchema(createEmptyReport())).toBe(false)
  })
})

describe('createBlock', () => {
  it('builds each block type as the details layer inserts it', () => {
    expect(createBlock('heading', { level: 3 })).toMatchObject({ type: 'heading', text: '', level: 3, width: 'full' })
    expect(createBlock('heading')).toMatchObject({ level: 2 })
    expect(createBlock('data')).toMatchObject({ type: 'data', source: null, rows: 25, width: 'full' })
    expect(Object.keys(createBlock('pagebreak')).sort()).toStrictEqual(['id', 'type'])
    expect(createBlock('nope')).toBeNull()
  })
})

describe('report operations', () => {
  const base = () =>
    normalizeReport({
      blocks: [
        { id: 'a', type: 'text', text: 'A' },
        { id: 'b', type: 'text', text: 'B' },
        { id: 'c', type: 'text', text: 'C', style: { size: 'huge', background: '#EDF4DC' } },
      ],
    })
  const ids = (report) => report.blocks.map((block) => block.id)

  it('inserts after the given block, or at the end', () => {
    const block = { id: 'n', type: 'pagebreak' }
    expect(ids(insertBlock(base(), block, 'a'))).toStrictEqual(['a', 'n', 'b', 'c'])
    expect(ids(insertBlock(base(), block))).toStrictEqual(['a', 'b', 'c', 'n'])
    expect(ids(insertBlock(base(), block, 'missing'))).toStrictEqual(['a', 'b', 'c', 'n'])
  })

  it('moves within bounds only', () => {
    expect(ids(moveBlock(base(), 'b', -1))).toStrictEqual(['b', 'a', 'c'])
    expect(ids(moveBlock(base(), 'a', -1))).toStrictEqual(['a', 'b', 'c'])
    expect(ids(moveBlock(base(), 'c', 1))).toStrictEqual(['a', 'b', 'c'])
  })

  it('duplicates with a new id, right after the original', () => {
    const { report, id } = duplicateBlock(base(), 'a')
    expect(ids(report)).toStrictEqual(['a', id, 'b', 'c'])
    expect(report.blocks[1]).toMatchObject({ type: 'text', text: 'A' })
    expect(id).not.toBe('a')
  })

  it('removes, updates and snaps rows through updateBlock', () => {
    expect(ids(removeBlock(base(), 'b'))).toStrictEqual(['a', 'c'])
    const withData = insertBlock(base(), { id: 'd', type: 'data', rows: 25, source: null })
    expect(updateBlock(withData, 'd', { rows: 60 }).blocks.find((b) => b.id === 'd').rows).toBe(50)
  })

  it('merges style changes, and "" removes a key', () => {
    const report = updateBlockStyle(base(), 'c', { size: '', color: '#16181C' })
    expect(report.blocks[2].style).toStrictEqual({ background: '#EDF4DC', color: '#16181C' })
  })

  it('resets a block to the theme', () => {
    expect(resetBlockStyle(base(), 'c').blocks[2]).not.toHaveProperty('style')
  })

  it('never mutates its input', () => {
    const report = base()
    const snapshot = JSON.stringify(report)
    insertBlock(report, { id: 'n', type: 'pagebreak' }, 'a')
    moveBlock(report, 'b', 1)
    duplicateBlock(report, 'a')
    updateBlockStyle(report, 'c', { size: 'small' })
    resetBlockStyle(report, 'c')
    removeBlock(report, 'a')
    expect(JSON.stringify(report)).toBe(snapshot)
  })
})
